import { randomBytes } from "node:crypto";
import type { ImportFile, Prisma } from "@prisma/client";
import { ApiError } from "../auth";
import { db } from "../db";
import { aiAvailable } from "../ai/gateway";
import { tavilyConfigured } from "../ai/tavily";
import { storage } from "../storage";
import { buildTextChunks, extractionRanges, pageRanges, parsePageSpec, pdfPageCountGuess, type ExtractRange } from "./chunking";
import { canReadFiles, canReadText, classifyDocument, classifyText, extractFromFile, extractFromText, extractKeyFromFile, MAX_INLINE_BYTES, verifyBatch } from "./aitasks";
import type { ExtractedDraft, Figure } from "./aischema";
import { bindDocImages, hasImgMark, type DocImageSource } from "./figures";
import { pdfPageCount, slicePdf } from "./pdfslice";
import { buildEvidence, contextEvidence, gatherLocalContext, webContext, type CtxItem } from "./evidence";
import type { ImportKind } from "./formats";
import { parseAnswerKey, type KeyEntry, type LabelStyle } from "./keyparse";
import { checkArithmetic } from "./mathcheck";
import { extractOfficeText, type Page } from "./officetext";
import type { VerifyItem } from "./prompts";
import { classifyPages, parseQuestions, type QType } from "./qparse";
import { contentHash, decide, matchKeys, matchTopic, normGroup, numbersForKey, type Confidence } from "./verifylogic";

/**
 * Asinxron import jarayoni (docs/SMART-IMPORT.md). Yuklash va qayta ishlash ajratilgan: har bir `advanceImport` chaqiruvi BITTA cheklangan ish
 * birligini bajaradi (fayllarni o'qish, bir PDF oralig'i, bir matn bo'lagi, bir tekshiruv paketi) va holatni bazada saqlaydi. Mijoz tugamaguncha
 * qayta chaqiradi; sahifa yopilsa ham jarayon qolgan joyidan davom etadi. Xato bo'lsa, muvaffaqiyatli ajratilgan savollar yo'qolmaydi.
 */
export const ACTIVE_STATUSES = ["UPLOADED", "QUEUED", "EXTRACTING", "CLASSIFYING", "VERIFYING"] as const;
const LEASE_MS = 70_000;
const MAX_TEXT_CHARS = 1_200_000;
const VERIFY_BATCH = 10; // bitta AI chaqiruvidagi savollar (kamroq chaqiruv: limit va kechikish uchun)
const VERIFY_PAR = 2; // bir `advance` chaqiruvida parallel paketlar
const AI_BUDGET_MS = 35_000; // bitta paket uchun AI'ga ajratilgan umumiy vaqt (funksiya chegarasi 60 s)
const MAX_STALLS = 6; // ketma-ket band/limit kutishlari: shundan oshsa jarayon to'xtatiladi
const MAX_AI_WAITS = 2; // limit/band holatida ko'pi bilan shuncha marta kutiladi, so'ng AI'siz davom etiladi
const MAX_UNIT_ATTEMPTS = 2;
const webMax = () => Math.max(0, Number(process.env.IMPORT_WEB_MAX ?? 6));

type Json = Prisma.InputJsonValue;
export type FileMeta = {
  mode?: "RULES" | "AI_TEXT" | "AI_FILE";
  kinds?: { kind: string; from: number; to: number }[];
  ranges?: ExtractRange[];
  /** Foydalanuvchi tanlagan sahifalar («3-14, 655-657»): bo'sh bo'lsa butun fayl. */
  pageSpec?: string;
  /** Test/bo'lim sarlavhalari (indeks = savolning `section % 1000` qiymati) va savollardagi rasm joylari (savol id bo'yicha). */
  groups?: string[]; figures?: Record<string, Figure[]>;
  /** Saqlangan rasm joylari (savol id bo'yicha): brauzer kesgan yoki DOCX'dan olingan rasmlar tayyor. */
  figureUp?: Record<string, number[]>;
  key?: KeyEntry[]; style?: LabelStyle; lastNum?: number; sec?: number;
  attempts?: Record<string, number>; failed?: number[];
  structDone?: boolean; classified?: boolean; keyDone?: boolean;
  subject?: string | null; grade?: string | null; topic?: string | null;
};
export type Progress = { label?: string; warnings?: string[]; web?: number; aiBlocked?: string; aiFails?: number; waits?: number; stalls?: number; keysMatched?: boolean; topicsDone?: boolean };

const meta = (f: { docKinds: unknown }): FileMeta => ((f.docKinds && typeof f.docKinds === "object" && !Array.isArray(f.docKinds)) ? (f.docKinds as FileMeta) : {});
const prog = (s: { progress: unknown }): Progress => ((s.progress && typeof s.progress === "object" && !Array.isArray(s.progress)) ? { ...(s.progress as Progress) } : {});
const isOffice = (k: string) => ["docx", "xlsx", "pptx", "odt", "ods", "odp", "csv", "txt"].includes(k);
const ERR_WAIT = new Set(["rate_limited", "provider_busy", "daily_limit"]);
const short = (s: string, n = 220) => (s.length > n ? s.slice(0, n - 1) + "…" : s);
const newId = (p: string) => p + randomBytes(10).toString("hex");

export type StepResult = { status: string; step: string; label: string; done: number; total: number; finished: boolean; wait?: number; message?: string; busy?: boolean };
type Unit = { label: string; done: number; total: number } | null;

async function setMeta(f: ImportFile, m: FileMeta, extra: Prisma.ImportFileUpdateInput = {}) {
  await db.importFile.update({ where: { id: f.id }, data: { docKinds: m as unknown as Json, ...extra } });
}
async function setProgress(sessionId: string, p: Progress, data: Prisma.ImportSessionUpdateInput = {}) {
  await db.importSession.update({ where: { id: sessionId }, data: { progress: p as unknown as Json, ...data } });
}
const addWarning = (p: Progress, w: string) => { p.warnings = [...new Set([...(p.warnings ?? []), short(w)])].slice(-12); };

// ---------- savollarni saqlash ----------
/** Ajratilgan savollarni saqlaydi (dublikatlar tashlanadi). Savol yonidagi javob belgisi AnswerVerification.keyAnswer ga yoziladi. */
async function appendQuestions(sessionId: string, file: ImportFile, fileIndex: number, drafts: ExtractedDraft[], m: FileMeta, ai: boolean, docImages?: DocImageSource) {
  if (!drafts.length) return 0;
  const last = await db.extractedQuestion.findFirst({ where: { importSessionId: sessionId }, orderBy: { seq: "desc" }, select: { seq: true } });
  let seq = (last?.seq ?? 0) + 1;
  const existing = new Set((await db.extractedQuestion.findMany({ where: { importSessionId: sessionId }, select: { contentHash: true } })).map((x) => x.contentHash));
  const qRows: Prisma.ExtractedQuestionCreateManyInput[] = [];
  const vRows: Prisma.AnswerVerificationCreateManyInput[] = [];
  for (const d of drafts) {
    const hash = contentHash(`${normGroup(d.group)}|${d.text}`, d.options);
    if (existing.has(hash)) continue;
    existing.add(hash);
    let section = d.section;
    if (ai && d.group) { // sarlavhali testlar (ko'p testli to'plam): bo'lim — test sarlavhasi bo'yicha
      m.groups ??= [];
      let gi = m.groups.findIndex((g) => normGroup(g) === normGroup(d.group));
      if (gi < 0) { m.groups.push(d.group); gi = m.groups.length - 1; }
      section = gi;
    } else if (ai) { // sarlavhasiz AI natijasida bo'limlar raqamlashning qayta boshlanishi bo'yicha aniqlanadi
      if (d.number === 1 && (m.lastNum ?? 0) > 1) m.sec = (m.sec ?? 0) + 1;
      if (d.number !== null) m.lastNum = d.number;
      section = m.sec ?? 0;
    }
    const id = newId("iq");
    let text = d.text, options = d.options, figures = d.figures, uncertain = !!d.uncertain, note = d.note ?? null;
    // DOCX ichidagi rasmlar: matndagi o'z joyida `[[RASM:n]]` bo'lib qoladi, rasm baytlari darhol saqlanadi.
    if (hasImgMark(text) || options.some((o) => hasImgMark(o.text))) {
      if (docImages) {
        const b = await bindDocImages(text, options, { ...docImages, qid: id });
        text = b.text; options = b.options; figures = [...figures, ...b.figures];
        if (b.up.length) { (m.figureUp ??= {})[id] = b.up; }
        if (b.missing) { uncertain = true; note = [note, "Savolda faylga joylangan rasm bor, lekin uni ko'chirib bo'lmadi (format qo'llab-quvvatlanmaydi yoki juda katta): asl faylga qarang."].filter(Boolean).join(" "); }
      } else { text = text.replace(/\[\[IMG:\d{1,4}\]\]/g, "").trim(); options = options.map((o) => ({ ...o, text: o.text.replace(/\[\[IMG:\d{1,4}\]\]/g, "").trim() })); }
    }
    if (figures.length) (m.figures ??= {})[id] = figures;
    qRows.push({
      id, importSessionId: sessionId, fileId: file.id, number: d.number, seq: seq++, section: fileIndex * 1000 + section,
      originalText: text, options: options as unknown as Json, qtype: d.qtype,
      subjectGuess: d.subject ?? null, topicGuess: d.topic ?? null, grade: d.grade ?? null, difficulty: d.difficulty ?? "MEDIUM",
      sourcePage: d.page, ocrUncertain: uncertain, note,
      reviewStatus: d.incomplete ? "INCOMPLETE" : "PENDING", contentHash: hash,
    });
    // Faylda javob yonida berilgan izoh (bo'lsa) saqlanadi: tekshiruvdan keyin ham yo'qolmaydi va savolga izoh bo'lib ko'chadi.
    vRows.push({ id: newId("av"), questionId: id, evidence: [] as unknown as Json, ...(d.inlineAnswer ? { keyAnswer: d.inlineAnswer as unknown as Json, keySource: "INLINE" } : {}), ...(d.explanation ? { providerMetadata: { keyExplanation: d.explanation } as unknown as Json } : {}) });
  }
  if (qRows.length) {
    await db.extractedQuestion.createMany({ data: qRows });
    await db.answerVerification.createMany({ data: vRows });
  }
  return qRows.length;
}

const draftFromRule = (q: ReturnType<typeof parseQuestions>["questions"][number]): ExtractedDraft => ({ ...q, subject: null, topic: null, grade: null, difficulty: "MEDIUM", uncertain: false, group: null, figures: [] });

/** Kalit yozuvlarini qo'shadi. Sarlavhali (test nomi bilan) jadvallarning bo'limi sarlavha bo'yicha, sarlavhasizlarniki raqamlash qayta boshlanishi bo'yicha. */
const appendKey = (m: FileMeta, items: { number: number; answers: string[]; group?: string | null; explanation?: string }[]) => {
  const key = m.key ?? [];
  let section = key.length ? key[key.length - 1].section : 0, last = key.length ? key[key.length - 1].number : 0;
  for (const it of items) {
    const ex = it.explanation ? { explanation: it.explanation } : {};
    if (it.group) {
      const prev = key.find((e) => e.group && normGroup(e.group) === normGroup(it.group));
      if (prev) section = prev.section; else { section = key.length ? Math.max(...key.map((e) => e.section)) + 1 : 0; }
      key.push({ number: it.number, answers: it.answers, section, group: it.group, ...ex });
    } else {
      if (it.number === 1 && last > 1) section++;
      key.push({ number: it.number, answers: it.answers, section, ...ex });
    }
    last = it.number;
  }
  m.key = key;
};

// ---------- bosqichlar ----------
async function stepParse(files: ImportFile[], p: Progress): Promise<Unit> {
  const todo = files.filter((f) => f.parseStatus === "UPLOADED");
  if (!todo.length) return null;
  const st = storage();
  for (const f of todo) {
    const kind = f.kind as ImportKind;
    try {
      const bytes = await st.get(f.storagePath);
      if (isOffice(kind)) {
        const doc = extractOfficeText(kind, new Uint8Array(bytes));
        if (!doc) { await db.importFile.update({ where: { id: f.id }, data: { parseStatus: "FAILED", parseError: "Faylni o'qib bo'lmadi: ichki tuzilma buzilgan yoki qo'llab-quvvatlanmaydi." } }); continue; }
        let total = 0;
        const pages: Page[] = [];
        for (const pg of doc.pages) { if (total + pg.text.length > MAX_TEXT_CHARS) { addWarning(p, `«${f.fileName}»: matn juda uzun, faqat boshi (${pages.length} bo'lim) o'qildi.`); break; } pages.push(pg); total += pg.text.length; }
        await db.importFile.update({ where: { id: f.id }, data: { parseStatus: "PARSED", pages: pages as unknown as Json, textChars: total, pageCount: pages.length, note: doc.note ?? null } });
        if (!pages.length) addWarning(p, `«${f.fileName}»: ${doc.note ?? "matn topilmadi"}`);
      } else {
        if (!canReadFiles()) { await db.importFile.update({ where: { id: f.id }, data: { parseStatus: "BLOCKED", parseError: "PDF va rasmlarni o'qish uchun Gemini ulanmagan (GEMINI_API_KEY). Matnli fayl (DOCX, XLSX, TXT) yuklab ko'ring." } }); continue; }
        // PDF kesib yuboriladi (hajm cheklovi bo'lakka tegishli); rasm va kesib bo'lmaydigan PDF butunligicha yuboriladi.
        const exact = kind === "pdf" ? await pdfPageCount(new Uint8Array(bytes)) : null;
        if (bytes.length > MAX_INLINE_BYTES && exact === null) { await db.importFile.update({ where: { id: f.id }, data: { parseStatus: "BLOCKED", parseError: "Fayl AI tahlili uchun juda katta (14 MB gacha) yoki ochib bo'lmadi. Hajmini kichraytiring yoki qismlarga bo'ling." } }); continue; }
        const pc = kind === "pdf" ? exact ?? pdfPageCountGuess(new Uint8Array(bytes)) : 1;
        await db.importFile.update({ where: { id: f.id }, data: { parseStatus: "PARSED", pageCount: pc || null } });
      }
    } catch (e) {
      await db.importFile.update({ where: { id: f.id }, data: { parseStatus: "FAILED", parseError: e instanceof ApiError ? e.message : "Faylni saqlash xizmatidan o'qib bo'lmadi." } });
    }
  }
  return { label: "Fayllar o'qildi", done: todo.length, total: files.length };
}

/** PDF tuzilmasi: sahifa oraliqlari va mazmun turlari (bitta fayl — bitta AI chaqiruvi). */
async function stepStruct(userId: string, files: ImportFile[], p: Progress): Promise<Unit> {
  const f = files.find((x) => x.parseStatus === "PARSED" && !isOffice(x.kind) && !meta(x).structDone);
  if (!f) return null;
  const m = meta(f);
  m.structDone = true;
  if (f.kind === "image") { m.ranges = [{ from: 0, to: 0 }]; await setMeta(f, m, { total: 1 }); return { label: `Rasm tayyor: ${f.fileName}`, done: 1, total: 1 }; }
  // Foydalanuvchi sahifalarni tanlagan bo'lsa (katta to'plamlar): tuzilmani aniqlash o'tkazib yuboriladi, faqat shu sahifalar o'qiladi.
  const spec = parsePageSpec(m.pageSpec, f.pageCount || 5000);
  if (spec) {
    m.ranges = extractionRanges([], f.pageCount ?? 0, spec);
    await setMeta(f, m, { total: m.ranges.length });
    return { label: `Tanlangan sahifalar: ${f.fileName} (${m.pageSpec})`, done: 1, total: 1 };
  }
  try {
    const bytes = await storage().get(f.storagePath);
    const r = await classifyDocument(userId, { bytes: new Uint8Array(bytes), mime: f.mime });
    const total = r.data.pageCount && r.data.pageCount > 0 ? Math.round(r.data.pageCount) : f.pageCount ?? 0;
    const sections = r.data.sections.map((s) => ({ kind: String(s.kind).toUpperCase(), from: s.fromPage ?? 0, to: s.toPage ?? 0 }));
    m.kinds = sections;
    m.subject = r.data.subject ?? null; m.grade = r.data.grade ?? null;
    const onlyKey = sections.length > 0 && sections.every((s) => /ANSWER_KEY|OTHER/.test(s.kind)) && sections.some((s) => /ANSWER_KEY/.test(s.kind));
    const toAnswers = onlyKey && f.role === "AUTO";
    const qs = extractionRanges(sections.map((s) => ({ kind: s.kind, fromPage: s.from, toPage: s.to })), total);
    m.ranges = qs.length ? qs : [{ from: 0, to: 0 }];
    if (sections.length && !sections.some((s) => /QUESTIONS|EXERCISES|ANSWER_KEY/.test(s.kind))) addWarning(p, `«${f.fileName}»: hujjatda savollar aniqlanmadi (nazariy yoki metodik material bo'lishi mumkin).`);
    await setMeta(f, m, { total: toAnswers ? 1 : m.ranges.length, pageCount: total || f.pageCount, ...(toAnswers && { role: "ANSWERS" }) });
    return { label: `Hujjat tuzilishi aniqlandi: ${f.fileName}`, done: 1, total: 1 };
  } catch (e) {
    if (e instanceof ApiError && ERR_WAIT.has(e.code ?? "")) throw e;
    // Tuzilmani aniqlab bo'lmadi: butun fayl bitta oraliq (yoki taxminiy sahifa soni bo'yicha bo'laklar) sifatida o'qiladi.
    const guess = f.pageCount ?? 0;
    m.ranges = guess > 8 ? pageRanges(guess, 8) : [{ from: 0, to: 0 }];
    addWarning(p, `«${f.fileName}»: hujjat tuzilishini aniqlab bo'lmadi, butun fayl o'qiladi.`);
    await setMeta(f, m, { total: m.ranges.length });
    return { label: `Tuzilma aniqlanmadi: ${f.fileName}`, done: 1, total: 1 };
  }
}

/** Birlik xatosini qayd etadi: ikkinchi muvaffaqiyatsizlikdan keyin birlik o'tkazib yuboriladi (qolgan savollar saqlanadi). */
async function unitFailed(f: ImportFile, m: FileMeta, key: string, what: string, e: unknown, p: Progress) {
  m.attempts = { ...(m.attempts ?? {}), [key]: (m.attempts?.[key] ?? 0) + 1 };
  if (m.attempts[key] >= MAX_UNIT_ATTEMPTS) {
    m.failed = [...(m.failed ?? []), f.cursor];
    addWarning(p, `«${f.fileName}»: ${what} o'qib bo'lmadi (${e instanceof ApiError ? e.message : "xatolik"}).`);
    await setMeta(f, m, { cursor: f.cursor + 1 });
  } else await setMeta(f, m);
}

/** DOCX'dagi rasmlar: faqat matnda `[[IMG:k]]` belgisi bo'lsa fayl qayta o'qiladi. O'qib bo'lmasa, belgilar olib tashlanadi va ogohlantirish qo'shiladi. */
async function loadDocImages(userId: string, sessionId: string, f: ImportFile, pages: Page[], p: Progress): Promise<DocImageSource | undefined> {
  if (f.kind !== "docx" || !pages.some((x) => hasImgMark(x.text))) return undefined;
  try {
    const bytes = await storage().get(f.storagePath);
    const doc = extractOfficeText("docx", new Uint8Array(bytes), { media: true });
    if (doc?.media?.size) return { owner: userId, sessionId, images: doc.media };
  } catch { /* quyida ogohlantiriladi */ }
  addWarning(p, `«${f.fileName}»: fayldagi rasmlarni o'qib bo'lmadi, savollarda rasmlar yo'q.`);
  return undefined;
}

/** Savollarni ajratish: bitta ish birligi. */
async function stepExtract(userId: string, sessionId: string, files: ImportFile[], p: Progress): Promise<Unit> {
  const idxOf = (f: ImportFile) => files.findIndex((x) => x.id === f.id);
  for (const f of files.filter((x) => x.parseStatus === "PARSED" && x.role !== "ANSWERS")) {
    const m = meta(f);
    const kind = f.kind as ImportKind;
    if (isOffice(kind)) {
      const pages = (f.pages as unknown as Page[] | null) ?? [];
      if (!m.mode) {
        const parsed = parseQuestions(pages);
        const complete = parsed.questions.filter((q) => !q.incomplete).length;
        const good = parsed.questions.length > 0 && complete / Math.max(parsed.candidates, parsed.questions.length) >= 0.7;
        m.style = parsed.style; m.key = parsed.keyEntries; m.kinds = classifyPages(parsed.perPage);
        if (good || !canReadText()) {
          m.mode = "RULES";
          if (!good && parsed.candidates > parsed.questions.length) addWarning(p, `«${f.fileName}»: qoidalar bilan ${parsed.questions.length} ta savol ajratildi; AI ulanmagani uchun qolganlarini aniqlab bo'lmadi.`);
          const docImages = await loadDocImages(userId, sessionId, f, pages, p);
          const n = await appendQuestions(sessionId, f, idxOf(f), parsed.questions.map(draftFromRule), m, false, docImages);
          const keyOnly = parsed.keyEntries.length >= 3 && parsed.questions.length === 0 && f.role === "AUTO";
          await setMeta(f, m, { cursor: 1, total: 1, ...(keyOnly && { role: "ANSWERS" }) });
          if (!n && !parsed.keyEntries.length) addWarning(p, `«${f.fileName}»: savol topilmadi.`);
          return { label: `Savollar ajratildi: ${f.fileName} (${n} ta)`, done: 1, total: 1 };
        }
        m.mode = "AI_TEXT"; // qoidalar yetarli emas: AI bilan bo'laklab ajratiladi
        const chunks = buildTextChunks(pages);
        await setMeta(f, m, { cursor: 0, total: chunks.length });
        return { label: `AI bilan ajratishga tayyorlandi: ${f.fileName}`, done: 0, total: chunks.length };
      }
      if (m.mode === "AI_TEXT" && f.cursor < f.total) {
        const chunk = buildTextChunks(pages)[f.cursor];
        try {
          if (!chunk) { await setMeta(f, m, { cursor: f.total }); return { label: "Matn bo'laklari tugadi", done: f.total, total: f.total }; }
          const r = await extractFromText(userId, chunk.text, { hint: `Fayl: ${f.fileName}`, style: m.style });
          const docImages = await loadDocImages(userId, sessionId, f, [{ label: "", text: chunk.text }], p);
          await appendQuestions(sessionId, f, idxOf(f), r.questions, m, true, docImages);
          if (r.answerKey.length) appendKey(m, r.answerKey);
          r.warnings.slice(0, 3).forEach((w) => addWarning(p, `«${f.fileName}»: ${w}`));
          await setMeta(f, m, { cursor: f.cursor + 1 });
        } catch (e) {
          if (e instanceof ApiError && ERR_WAIT.has(e.code ?? "")) throw e;
          await unitFailed(f, m, `c${f.cursor}`, `${f.cursor + 1}-bo'lakni`, e, p);
        }
        return { label: `Savollar ajratilmoqda: ${f.fileName} (${Math.min(f.cursor + 1, f.total)}/${f.total})`, done: Math.min(f.cursor + 1, f.total), total: f.total };
      }
      continue;
    }
    // PDF / rasm
    if (!m.structDone || f.cursor >= f.total) continue;
    const rg: ExtractRange = (m.ranges ?? [{ from: 0, to: 0 }])[f.cursor] ?? { from: 0, to: 0 };
    try {
      const bytes = new Uint8Array(await storage().get(f.storagePath));
      // PDF: faqat shu oraliqdagi sahifalar AI'ga yuboriladi (butun fayl emas).
      let input: { bytes: Uint8Array; mime: string } = { bytes, mime: f.mime };
      let excerpt = false;
      if (f.kind === "pdf" && rg.from) {
        try { input = { bytes: (await slicePdf(bytes, rg.from, rg.to || rg.from)).bytes, mime: f.mime }; excerpt = true; }
        catch { if (bytes.length > MAX_INLINE_BYTES) throw new ApiError(413, "Fayl AI tahlili uchun juda katta (14 MB gacha) va uni sahifalarga bo'lib bo'lmadi.", "too_big_for_ai"); }
      }
      const range = { fromPage: rg.from || undefined, toPage: rg.to || undefined, excerpt };
      m.mode = "AI_FILE";
      if (rg.kind === "K") {
        // Javoblar kaliti sahifalari: faqat kalit jadvallari o'qiladi (test sarlavhasi bilan).
        const k = await extractKeyFromFile(userId, input, m.style, range);
        if (k.key.length) appendKey(m, k.key);
      } else {
        const r = await extractFromFile(userId, input, { ...range, hint: `Fayl: ${f.fileName}`, style: m.style });
        await appendQuestions(sessionId, f, idxOf(f), r.questions, m, true);
        if (r.answerKey.length) appendKey(m, r.answerKey);
        r.warnings.slice(0, 3).forEach((w) => addWarning(p, `«${f.fileName}»: ${w}`));
      }
      await setMeta(f, m, { cursor: f.cursor + 1 });
    } catch (e) {
      if (e instanceof ApiError && ERR_WAIT.has(e.code ?? "")) throw e;
      await unitFailed(f, m, `r${f.cursor}`, rg.from ? `${rg.from}-${rg.to}-sahifalarni` : "faylni", e, p);
    }
    return { label: `Savollar ajratilmoqda: ${f.fileName} (${Math.min(f.cursor + 1, f.total)}/${f.total})`, done: Math.min(f.cursor + 1, f.total), total: f.total };
  }
  return null;
}

/** Javoblar kaliti: alohida fayllar o'qiladi, so'ng barcha kalit manbalari savollarga moslashtiriladi (bir marta). */
async function stepKeys(userId: string, sessionId: string, files: ImportFile[], p: Progress): Promise<Unit> {
  const aFile = files.find((f) => f.parseStatus === "PARSED" && f.role === "ANSWERS" && !meta(f).keyDone);
  if (aFile) {
    const m = meta(aFile);
    m.keyDone = true;
    try {
      if (isOffice(aFile.kind)) {
        const parsed = parseAnswerKey(((aFile.pages as unknown as Page[] | null) ?? []).map((x) => x.text).join("\n"));
        m.key = parsed.entries; m.style = parsed.style;
      } else {
        const bytes = new Uint8Array(await storage().get(aFile.storagePath));
        m.key = [];
        const spec = aFile.kind === "pdf" ? parsePageSpec(m.pageSpec, aFile.pageCount || 5000) : null;
        if (spec) {
          // Katta kalit fayli: tanlangan sahifalar bo'lak-bo'lak o'qiladi (bir chaqiruvda ko'pi bilan 4 bo'lak).
          const parts = extractionRanges([{ kind: "ANSWER_KEY", fromPage: 1, toPage: 100000 }], aFile.pageCount ?? 0, spec).slice(0, 4);
          for (const rg of parts) {
            const s = await slicePdf(bytes, rg.from, rg.to);
            appendKey(m, (await extractKeyFromFile(userId, { bytes: s.bytes, mime: aFile.mime }, undefined, { fromPage: rg.from, toPage: rg.to, excerpt: true })).key);
          }
        } else appendKey(m, (await extractKeyFromFile(userId, { bytes, mime: aFile.mime })).key);
      }
      if (!m.key?.length) addWarning(p, `«${aFile.fileName}»: javoblar kaliti topilmadi.`);
      await setMeta(aFile, m, { cursor: 1, total: 1 });
    } catch (e) {
      if (e instanceof ApiError && ERR_WAIT.has(e.code ?? "")) throw e;
      addWarning(p, `«${aFile.fileName}»: javoblar kalitini o'qib bo'lmadi (${e instanceof ApiError ? e.message : "xatolik"}).`);
      await setMeta(aFile, m, { cursor: 1, total: 1 });
    }
    return { label: `Javoblar kaliti o'qildi: ${aFile.fileName}`, done: 1, total: 1 };
  }
  if (p.keysMatched) return null;

  const qs = await db.extractedQuestion.findMany({ where: { importSessionId: sessionId }, orderBy: { seq: "asc" }, select: { id: true, fileId: true, number: true, section: true, verification: { select: { keyAnswer: true, keySource: true, providerMetadata: true } } } });
  const qfiles = files.filter((f) => f.role !== "ANSWERS" && f.parseStatus === "PARSED");
  const afiles = files.filter((f) => f.role === "ANSWERS" && f.parseStatus === "PARSED");
  let sep = 0, matched = 0;
  for (const f of qfiles) {
    const mine = qs.filter((q) => q.fileId === f.id);
    if (!mine.length) continue;
    const own = meta(f).key ?? [];
    // fayl ichida kalit bo'limi bo'lmasa, alohida javoblar kaliti fayllari tartib bo'yicha biriktiriladi
    const keyFile = !own.length ? afiles[sep++] : undefined;
    const entries = own.length ? own : keyFile ? meta(keyFile).key ?? [] : [];
    const groups = meta(f).groups;
    // Savol raqamlari ko'rinmasa bo'limdagi tartib raqami bo'yicha moslanadi.
    const nums = numbersForKey(mine);
    const km = matchKeys(mine.map((q, i) => ({ number: nums[i], section: q.section, group: groups?.[q.section % 1000] ?? null, inlineAnswer: q.verification?.keySource === "INLINE" ? (q.verification.keyAnswer as string[] | null) : null })), entries);
    for (let i = 0; i < mine.length; i++) {
      const k = km[i], q = mine[i];
      // Izoh: kalit yozuvidagi izoh, bo'lmasa savol yonidagi izoh (yaratilganda saqlangan) qoladi.
      const prevExpl = ((q.verification?.providerMetadata ?? {}) as { keyExplanation?: string }).keyExplanation;
      const expl = k.explanation ?? prevExpl;
      const same = q.verification?.keySource === k.keySource && JSON.stringify(q.verification?.keyAnswer ?? null) === JSON.stringify(k.key) && (expl ?? null) === (prevExpl ?? null);
      if (same && !k.conflict) continue;
      // Kalit o'zgargan savol qayta tekshiriladi (verifiedAt bo'shatiladi): yangi qo'shilgan kalit fayli ham hisobga olinadi.
      await db.answerVerification.update({ where: { questionId: q.id }, data: { keyAnswer: (k.key ?? undefined) as Json | undefined, keySource: k.keySource, verifiedAt: null, providerMetadata: { ...(k.conflict && { keyConflict: k.conflict }), keyFile: keyFile?.fileName ?? null, ...(expl && { keyExplanation: expl }) } as unknown as Json } });
      matched++;
    }
  }
  p.keysMatched = true;
  return { label: matched ? "Javoblar kaliti savollarga moslashtirildi" : "Javoblar kaliti tekshirildi", done: 1, total: 1 };
}

/** Fan/mavzuni bazadagi mavzularga moslash; matnli hujjat uchun bir marta AI bilan fan taxmini. */
async function stepTopics(userId: string, sessionId: string, files: ImportFile[], p: Progress): Promise<Unit> {
  const f = files.find((x) => x.parseStatus === "PARSED" && x.role !== "ANSWERS" && isOffice(x.kind) && !meta(x).classified && canReadText());
  if (f) {
    const m = meta(f); m.classified = true;
    try {
      const sample = ((f.pages as unknown as Page[] | null) ?? []).map((x) => x.text).join("\n").slice(0, 2500);
      if (sample.trim()) { const r = await classifyText(userId, sample); m.subject = r.data.subject ?? null; m.grade = r.data.grade ?? null; }
    } catch (e) { if (e instanceof ApiError && ERR_WAIT.has(e.code ?? "")) throw e; }
    await setMeta(f, m);
    return { label: `Fan aniqlanmoqda: ${f.fileName}`, done: 1, total: 1 };
  }
  if (p.topicsDone) return null;
  const topics = (await db.topic.findMany({ select: { id: true, name: true, subject: { select: { name: true } } } })).map((t) => ({ id: t.id, name: t.name, subject: t.subject.name }));
  const qs = await db.extractedQuestion.findMany({ where: { importSessionId: sessionId, topicId: null }, select: { id: true, fileId: true, subjectGuess: true, topicGuess: true, grade: true } });
  const byFile = new Map(files.map((x) => [x.id, meta(x)]));
  for (const q of qs) {
    const fm = q.fileId ? byFile.get(q.fileId) : undefined;
    const subject = q.subjectGuess ?? fm?.subject ?? null;
    const t = matchTopic({ subject, topic: q.topicGuess ?? fm?.topic ?? null }, topics);
    const data: Prisma.ExtractedQuestionUpdateInput = {};
    if (t) data.topicId = t.id;
    if (subject && !q.subjectGuess) data.subjectGuess = subject;
    if (!q.grade && fm?.grade) data.grade = fm.grade;
    if (Object.keys(data).length) await db.extractedQuestion.update({ where: { id: q.id }, data });
  }
  const subj = [...byFile.values()].map((x) => x.subject).find(Boolean) ?? qs.find((q) => q.subjectGuess)?.subjectGuess ?? null;
  if (subj) await db.importSession.update({ where: { id: sessionId }, data: { subject: subj } });
  p.topicsDone = true;
  return { label: "Fan va mavzular moslashtirildi", done: 1, total: 1 };
}

type QRow = Prisma.ExtractedQuestionGetPayload<{ include: { verification: true } }>;
type Opt = { label: string; text: string };
const effText = (q: QRow) => q.editedText ?? q.originalText;
const effOptions = (q: QRow): Opt[] => ((q.editedOptions ?? q.options) as Opt[] | null) ?? [];
const SUPPORT_ORDER: ("WEB" | "HUB" | "LIBRARY")[] = ["WEB", "HUB", "LIBRARY"];
type AiOut = { answer: string[]; confidence: Confidence; explanation: string | null; usedSources: string[]; needsExternal: boolean; model: string; provider: string };
type Work = { q: QRow; computed: string[] | null; compNote: { expression: string; value: number } | null; ctx: CtxItem[]; ai?: AiOut; passes: string[]; aiTried: boolean };
const isChoice = (q: QRow) => ["SINGLE", "SITUATIONAL"].includes(q.qtype) && effOptions(q).length >= 2 && q.reviewStatus !== "INCOMPLETE";
/** Savolda rasm/jadval/formula joyi (`[[RASM:n]]`) bor: AI matn bilan uni ko'ra olmaydi, shuning uchun mustaqil «yechilmaydi». */
const hasFigure = (q: QRow) => /\[\[RASM:\d{1,2}\]\]/.test(effText(q));

/** AI chaqiruvi belgilangan vaqtda tugamasa, kutib turmasdan xato qaytaradi (foydalanuvchi uzoq kutib qolmasligi uchun). */
function within<T>(pr: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new ApiError(504, "AI javobi kechikdi.", "ai_timeout")), Math.max(1000, ms));
    pr.then((v) => { clearTimeout(t); resolve(v); }, (e) => { clearTimeout(t); reject(e); });
  });
}
const errText = (e: unknown) => (e instanceof ApiError ? e.message : "xatolik");

/**
 * Savollar paketini (VERIFY_BATCH tagacha) tekshiradi va natijani yozadi. Limit/band holatida (AI hech narsa qaytarmagan bo'lsa) hech narsa yozmasdan
 * `wait` qaytaradi, paket keyinroq qayta uriniladi. AI ishlamasa tez «o'chiriladi» (p.aiBlocked): qolgan savollar fayldagi kalit bo'yicha darhol ko'rib chiqiladi.
 */
async function verifyGroup(userId: string, files: ImportFile[], batch: QRow[], p: Progress): Promise<{ wait: ApiError | null; count: number }> {
  const aiOn = (canReadText() || aiAvailable().any) && !p.aiBlocked;

  const works: Work[] = await Promise.all(batch.map(async (q) => {
    const w: Work = { q, computed: null, compNote: null, ctx: [], passes: [], aiTried: false };
    if (isChoice(q)) {
      const options = effOptions(q);
      const mc = checkArithmetic(effText(q), options);
      if (mc && mc.match.length === 1) { w.computed = [options[mc.match[0]].label]; w.compNote = { expression: mc.expression, value: mc.value }; w.passes.push("computed"); }
      else if (aiOn && !hasFigure(q)) w.ctx = await gatherLocalContext(userId, effText(q)).catch(() => []);
    }
    return w;
  }));

  const needAi = works.filter((w) => !w.computed && isChoice(w.q) && !hasFigure(w.q));
  const toItem = (w: Work): VerifyItem => ({ id: w.q.id, text: effText(w.q), options: effOptions(w.q), context: w.ctx.map((c) => ({ id: c.id, source: `${c.source}${c.url ? `, ${c.url}` : ""}`, text: c.text })) });
  const apply = (w: Work, r: { answer?: string | string[] | null; confidence?: string | null; explanation?: string | null; usedSources?: string[] | null; needsExternal?: boolean | null }, model: string, provider: string) => {
    const ans = (Array.isArray(r.answer) ? r.answer : r.answer ? [r.answer] : []).map((x) => x.replace(/[^A-Za-z]/g, "").toUpperCase().slice(0, 1)).filter(Boolean);
    const conf = (["high", "medium", "low"].includes(String(r.confidence)) ? r.confidence : "low") as Confidence;
    w.ai = { answer: ans, confidence: ans.length ? conf : "low", explanation: r.explanation ?? null, usedSources: r.usedSources ?? [], needsExternal: !!r.needsExternal, model, provider };
  };

  let limitNote: string | null = null;
  if (aiOn && needAi.length) {
    const t0 = Date.now();
    const budget = () => AI_BUDGET_MS - (Date.now() - t0);
    try {
      const r = await within(verifyBatch(userId, needAi.map(toItem)), budget());
      p.aiFails = 0; p.waits = 0;
      for (const w of needAi) {
        w.aiTried = true; w.passes.push(r.provider);
        const x = r.data.results.find((y) => y.id === w.q.id);
        if (x) apply(w, x, r.model, r.provider);
      }
    } catch (e) {
      if (e instanceof ApiError && e.code === "daily_limit") { p.aiBlocked = e.message; limitNote = e.message; }
      else if (e instanceof ApiError && ERR_WAIT.has(e.code ?? "")) return { wait: e, count: 0 };
      else {
        // Boshqa xato (kalit/model noto'g'ri, tarmoq, kechikish): ikki marta ketma-ket bo'lsa AI o'chiriladi, qolgan savollar kutdirilmaydi.
        p.aiFails = (p.aiFails ?? 0) + 1;
        addWarning(p, `AI tekshiruvi bajarilmadi: ${errText(e)}`);
        if (p.aiFails >= 2) p.aiBlocked = "AI tekshiruvi hozir ishlamayapti.";
      }
    }
    // Ikkinchi bosqichlar ixtiyoriy: xato yoki kechikishda birinchi natija saqlanadi, kutib turilmaydi.
    if (needAi.some((w) => w.aiTried)) {
      try {
        // 1) tashqi manba kerak bo'lgan savollar (internet, byudjet doirasida)
        for (const w of needAi) {
          if (!w.ai?.needsExternal || !tavilyConfigured() || (p.web ?? 0) >= webMax() || budget() < 12_000) continue;
          const web = await within(webContext(userId, effText(w.q)), Math.min(10_000, budget()));
          p.web = (p.web ?? 0) + 1;
          if (!web.length) continue;
          w.ctx = [...w.ctx, ...web];
          const r2 = await within(verifyBatch(userId, [toItem(w)]), budget());
          const x2 = r2.data.results.find((y) => y.id === w.q.id);
          if (x2) { apply(w, x2, r2.model, r2.provider); w.passes.push("web"); }
        }
        // 2) murakkab, ishonchsiz yoki kalit bilan farq qiladigan savollar kuchli model bilan qayta tekshiriladi.
        const hard = needAi.filter((w) => w.ai && (w.ai.confidence !== "high" || w.q.qtype === "SITUATIONAL" || (w.q.verification?.keyAnswer && JSON.stringify(w.q.verification.keyAnswer) !== JSON.stringify(w.ai.answer)))).slice(0, 6);
        if (hard.length && budget() >= 12_000 && (aiAvailable().claude || process.env.IMPORT_COMPLEX_MODEL)) {
          const r3 = await within(verifyBatch(userId, hard.map(toItem), { heavy: true }), budget());
          for (const w of hard) { const x3 = r3.data.results.find((y) => y.id === w.q.id); if (x3 && x3.answer) { apply(w, x3, r3.model, r3.provider); w.passes.push(`${r3.provider}-heavy`); } }
        }
      } catch (e) {
        if (e instanceof ApiError && e.code === "daily_limit") { p.aiBlocked = e.message; limitNote = e.message; }
      }
    }
  }

  const fileName = (id: string | null) => files.find((f) => f.id === id)?.fileName ?? "Fayl";
  await Promise.all(works.map(async (w) => {
    const q = w.q, options = effOptions(q);
    const key = (q.verification?.keyAnswer as string[] | null) ?? null;
    const keySource = (q.verification?.keySource as "INLINE" | "SEPARATE_FILE" | null) ?? null;
    const meta0 = (q.verification?.providerMetadata ?? {}) as { keyConflict?: string; keyFile?: string | null; keyExplanation?: string };
    const usedIds = w.ai?.usedSources ?? [];
    const used = w.ctx.filter((c) => usedIds.includes(c.id));
    const support = SUPPORT_ORDER.find((k) => used.some((c) => c.kind === k)) ?? null;
    const d = decide({
      qtype: q.qtype as QType, incomplete: q.reviewStatus === "INCOMPLETE", options, ocrUncertain: q.ocrUncertain, key, keySource,
      ai: w.ai ? { answer: w.ai.answer, confidence: w.ai.confidence } : null, aiTried: w.aiTried, computed: w.computed, support,
    });
    const figNote = hasFigure(q) && !w.computed ? "Savolda rasm/jadval bor: AI uni ko'ra olmaydi, javobni asl rasmga qarab o'zingiz tasdiqlang." : null;
    const note = [d.note, meta0.keyConflict, figNote].filter(Boolean).join(" ");
    const evidence = buildEvidence({
      fileName: fileName(q.fileId), page: q.sourcePage, key, keySource, keyFileName: meta0.keyFile ?? null,
      computed: w.compNote, aiExplanation: w.ai?.explanation ?? null, aiModel: w.ai?.model ?? null, ctx: contextEvidence(used, usedIds), keyExplanation: meta0.keyExplanation ?? null,
    });
    await db.answerVerification.update({
      where: { questionId: q.id },
      data: {
        proposedAnswer: (d.proposed ?? undefined) as Json | undefined, answerOrigin: d.origin,
        // Fayldagi izoh (muallifning o'zi yozgani) birinchi o'rinda; bo'lmasa AI yoki hisob izohi.
        explanation: meta0.keyExplanation ?? w.ai?.explanation ?? (w.compNote ? `${w.compNote.expression} = ${w.compNote.value}` : null),
        evidence: evidence as unknown as Json, verificationStatus: d.verificationStatus, confidence: d.confidence, verifiedAt: new Date(),
        providerMetadata: { passes: w.passes, provider: w.ai?.provider ?? null, model: w.ai?.model ?? null, aiTried: w.aiTried, note: note || null, keyFile: meta0.keyFile ?? null, ...(meta0.keyConflict && { keyConflict: meta0.keyConflict }), ...(meta0.keyExplanation && { keyExplanation: meta0.keyExplanation }), ...(limitNote && { limit: limitNote }) } as unknown as Json,
      },
    });
    await db.extractedQuestion.update({ where: { id: q.id }, data: { reviewStatus: d.reviewStatus, note: note ? short(note, 400) : q.note } });
  }));
  return { wait: null, count: works.length };
}

/**
 * Savollarni tekshirish: bir chaqiruvda bir nechta paket parallel (kechikishni kamaytiradi). AI ishlamasa yoki band bo'lsa uzoq kutilmaydi:
 * qisqa kutishdan so'ng AI o'chiriladi va qolgan savollar fayldagi kalit bo'yicha darhol ko'rib chiqiladi («Hammasini qayta tekshirish» bilan keyin to'ldiriladi).
 */
async function stepVerify(userId: string, sessionId: string, files: ImportFile[], p: Progress): Promise<Unit> {
  const aiNow = (canReadText() || aiAvailable().any) && !p.aiBlocked;
  const take = aiNow ? VERIFY_BATCH * VERIFY_PAR : 60;
  const rows: QRow[] = await db.extractedQuestion.findMany({ where: { importSessionId: sessionId, verification: { is: { verifiedAt: null } } }, orderBy: { seq: "asc" }, take, include: { verification: true } });
  if (!rows.length) return null;
  const total = await db.extractedQuestion.count({ where: { importSessionId: sessionId } });
  const left = await db.answerVerification.count({ where: { question: { importSessionId: sessionId }, verifiedAt: null } });

  const groups: QRow[][] = [];
  for (let i = 0; i < rows.length; i += VERIFY_BATCH) groups.push(rows.slice(i, i + VERIFY_BATCH));
  const res = await Promise.allSettled(groups.map((g) => verifyGroup(userId, files, g, p)));
  const okRes = res.flatMap((r) => (r.status === "fulfilled" && !r.value.wait ? [r.value] : []));
  const waits = res.flatMap((r) => (r.status === "fulfilled" && r.value.wait ? [r.value.wait] : []));
  const failed = res.find((r): r is PromiseRejectedResult => r.status === "rejected");
  if (!okRes.length) {
    if (failed && !waits.length) throw failed.reason;
    if (waits.length) {
      p.waits = (p.waits ?? 0) + 1;
      if (p.waits <= MAX_AI_WAITS) throw waits[0];
      // Uzoq kutdirmaymiz: AI band, qolganlari kalit bo'yicha ko'rib chiqiladi.
      p.aiBlocked = `AI xizmati hozir band (${waits[0].message})`;
      addWarning(p, "AI xizmati band bo'lgani uchun qolgan savollar faqat fayldagi kalit bo'yicha ko'rib chiqiladi.");
      return { label: "AI band: qolgan savollar kalit bo'yicha ko'rib chiqiladi", done: Math.min(total, total - left), total };
    }
  }
  const done = Math.min(total, total - left + okRes.reduce((a, r) => a + r.count, 0));
  return { label: p.aiBlocked && !aiNow ? `Javoblar kalit bo'yicha ko'rib chiqilmoqda: ${done}/${total}` : `Javoblar tekshirilmoqda: ${done}/${total}`, done, total };
}

async function finish(sessionId: string, files: ImportFile[], p: Progress): Promise<StepResult> {
  const counts = await db.extractedQuestion.groupBy({ by: ["reviewStatus"], where: { importSessionId: sessionId }, _count: { _all: true } });
  const n = Object.fromEntries(counts.map((c) => [c.reviewStatus, c._count._all])) as Record<string, number>;
  const total = Object.values(n).reduce((a, b) => a + b, 0);
  const bad = files.filter((f) => f.parseStatus === "FAILED" || f.parseStatus === "BLOCKED");
  const flagged = total - (n.READY ?? 0);
  const status = total === 0 && bad.length === files.length ? "FAILED" : flagged > 0 || total === 0 || bad.length ? "NEEDS_REVIEW" : "READY_FOR_USER";
  const error = total === 0 ? (bad.length ? bad.map((f) => `«${f.fileName}»: ${f.parseError ?? "o'qilmadi"}`).join(" ") : "Faylda savol topilmadi.") : null;
  await setProgress(sessionId, { ...p, label: "Tayyor" }, { status, step: "DONE", completedAt: new Date(), lockedUntil: null, error });
  return { status, step: "DONE", label: "Tayyor", done: total, total, finished: true };
}

// ---------- asosiy kirish ----------
export async function advanceImport(userId: string, id: string): Promise<StepResult> {
  const s0 = await db.importSession.findFirst({ where: { id, ownerId: userId } });
  if (!s0) throw new ApiError(404, "Import topilmadi.");
  if (!ACTIVE_STATUSES.includes(s0.status as (typeof ACTIVE_STATUSES)[number])) {
    const total = await db.extractedQuestion.count({ where: { importSessionId: id } });
    return { status: s0.status, step: s0.step, label: prog(s0).label ?? "", done: total, total, finished: true };
  }
  const now = new Date();
  const lease = await db.importSession.updateMany({
    where: { id, ownerId: userId, status: { in: [...ACTIVE_STATUSES] }, OR: [{ lockedUntil: null }, { lockedUntil: { lt: now } }] },
    data: { lockedUntil: new Date(now.getTime() + LEASE_MS), ...(s0.status === "UPLOADED" || s0.status === "QUEUED" ? { status: "EXTRACTING" } : {}) },
  });
  if (lease.count === 0) return { status: s0.status, step: s0.step, label: prog(s0).label ?? "Qayta ishlanmoqda…", done: 0, total: 0, finished: false, busy: true, wait: 3 };

  const p = prog(s0);
  try {
    const files = await db.importFile.findMany({ where: { importSessionId: id }, orderBy: { createdAt: "asc" } });
    if (!files.length) throw new ApiError(400, "Import uchun fayl yo'q.");
    const fresh = () => db.importFile.findMany({ where: { importSessionId: id }, orderBy: { createdAt: "asc" } });
    const steps: [string, string, () => Promise<Unit>][] = [
      ["PARSE", "EXTRACTING", () => stepParse(files, p)],
      ["STRUCT", "EXTRACTING", async () => stepStruct(userId, await fresh(), p)],
      ["EXTRACT", "EXTRACTING", async () => stepExtract(userId, id, await fresh(), p)],
      ["KEYS", "CLASSIFYING", async () => stepKeys(userId, id, await fresh(), p)],
      ["TOPICS", "CLASSIFYING", async () => stepTopics(userId, id, await fresh(), p)],
      ["VERIFY", "VERIFYING", async () => stepVerify(userId, id, await fresh(), p)],
    ];
    for (const [step, status, fn] of steps) {
      const r = await fn();
      if (r) {
        p.stalls = 0;
        await setProgress(id, { ...p, label: r.label }, { status, step, lockedUntil: null, attempts: { increment: 1 } });
        return { status, step, label: r.label, done: r.done, total: r.total, finished: false };
      }
    }
    return await finish(id, await fresh(), p);
  } catch (e) {
    if (e instanceof ApiError && ERR_WAIT.has(e.code ?? "")) {
      if (e.code === "daily_limit") {
        // Limit tugadi: ajratilgan savollar saqlanadi; qolgan bosqichlar keyin «Qayta tekshirish» bilan davom ettiriladi.
        p.aiBlocked = e.message; addWarning(p, e.message);
        await setProgress(id, { ...p, label: "AI limiti tugadi" }, { status: "NEEDS_REVIEW", step: "DONE", lockedUntil: null, error: e.message, completedAt: new Date() });
        const total = await db.extractedQuestion.count({ where: { importSessionId: id } });
        return { status: "NEEDS_REVIEW", step: s0.step, label: "AI limiti tugadi", done: total, total, finished: true, message: e.message };
      }
      // Cheksiz kutish yo'q: ketma-ket bir necha marta band/limit bo'lsa jarayon to'xtatiladi, topilgan savollar saqlanadi, foydalanuvchi keyin davom ettiradi.
      p.stalls = (p.stalls ?? 0) + 1;
      if (p.stalls > MAX_STALLS) {
        const found = await db.extractedQuestion.count({ where: { importSessionId: id } });
        p.aiBlocked = e.message; addWarning(p, "AI xizmati uzoq vaqt band bo'ldi: jarayon to'xtatildi. Topilgan savollar saqlandi, keyinroq «Davom ettirish»ni bosing.");
        await setProgress(id, { ...p, label: "AI band: jarayon to'xtatildi" }, { status: found ? "NEEDS_REVIEW" : "FAILED", step: "DONE", lockedUntil: null, error: found ? null : e.message, completedAt: new Date() });
        return { status: found ? "NEEDS_REVIEW" : "FAILED", step: s0.step, label: "AI band: jarayon to'xtatildi", done: found, total: found, finished: true, message: e.message };
      }
      await setProgress(id, { ...p, label: e.message }, { lockedUntil: null });
      return { status: s0.status, step: s0.step, label: e.message, done: 0, total: 0, finished: false, wait: e.code === "provider_busy" ? 20 : 12, message: e.message };
    }
    console.error("import advance:", (e as Error).message);
    const msg = e instanceof ApiError ? e.message : "Qayta ishlashda kutilmagan xatolik.";
    addWarning(p, msg);
    const fatal = (s0.attempts ?? 0) + 1 >= 60;
    await setProgress(id, { ...p, label: msg }, { lockedUntil: null, attempts: { increment: 1 }, ...(fatal && { status: "FAILED", error: msg }) });
    return { status: fatal ? "FAILED" : s0.status, step: s0.step, label: msg, done: 0, total: 0, finished: fatal, wait: fatal ? undefined : 10, message: msg };
  }
}

/**
 * Sahifa yopilib qolgan (5 daqiqadan beri yangilanmagan) faol importlarni bittadan ish birligi bilan davom ettiradi (Vercel Cron: /api/cron/import-resume).
 * Foydalanuvchi sahifaga qaytganda jarayon baribir o'zi davom etadi; bu faqat qo'shimcha xavfsizlik.
 */
export async function resumeStale(max = 5) {
  const rows = await db.importSession.findMany({
    where: { status: { in: ["QUEUED", "EXTRACTING", "CLASSIFYING", "VERIFYING"] }, updatedAt: { lt: new Date(Date.now() - 5 * 60_000) }, OR: [{ lockedUntil: null }, { lockedUntil: { lt: new Date() } }] },
    orderBy: { updatedAt: "asc" }, take: max, select: { id: true, ownerId: true },
  });
  let resumed = 0;
  for (const r of rows) { try { await advanceImport(r.ownerId, r.id); resumed++; } catch (e) { console.error("import resume:", (e as Error).message); } }
  return { found: rows.length, resumed };
}

/** Savolni (yoki hammasini) qayta tekshirish uchun belgilash; keyingi `advanceImport` chaqiruvlari bajaradi. */
export async function queueRecheck(sessionId: string, questionIds?: string[]) {
  await db.answerVerification.updateMany({ where: { question: { importSessionId: sessionId, ...(questionIds && { id: { in: questionIds } }) } }, data: { verifiedAt: null } });
  const s = await db.importSession.findUnique({ where: { id: sessionId }, select: { progress: true } });
  const p = prog(s ?? { progress: null });
  delete p.aiBlocked; delete p.aiFails; delete p.waits; delete p.stalls;
  await db.importSession.update({ where: { id: sessionId }, data: { status: "VERIFYING", step: "VERIFY", completedAt: null, error: null, lockedUntil: null, progress: p as unknown as Json } });
}
