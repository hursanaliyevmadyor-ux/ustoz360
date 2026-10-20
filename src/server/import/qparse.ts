import { canonLabel, detectLabelStyle, isKeyLine, KEY_HEADING, LETTER_CLASS, parseAnswerKey, type KeyEntry, type LabelStyle } from "./keyparse";
import type { Page } from "./officetext";

/**
 * Matndan savollarni qoidalar bilan ajratish (AI'siz, deterministik). Word/Excel/PowerPoint/TXT kabi matnli hujjatlarda ishlaydi:
 *   1. Savol matni?   A) variant   B) variant ...    |   jadval: № | Savol | A | B | C | D | Javob   |   «Javob: B» qatorlari.
 * Savol matni o'zgartirilmaydi (faqat ortiqcha bo'sh joylar tozalanadi). Tushunib bo'lmagan joy to'qilmaydi: incomplete deb belgilanadi.
 */
export type QType = "SINGLE" | "MULTI" | "MATCHING" | "ORDERING" | "SHORT" | "SITUATIONAL" | "UNKNOWN";
export type Opt = { label: string; text: string };
export type DraftQuestion = {
  number: number | null; text: string; options: Opt[]; page: string | null; section: number; qtype: QType;
  inlineAnswer: string[] | null; incomplete: boolean; note?: string;
};
export type PageStat = { label: string; questions: number; keyLines: number; chars: number };
export type RuleParse = {
  questions: DraftQuestion[]; keyEntries: KeyEntry[]; style: LabelStyle;
  /** Savolga o'xshash boshlanishlar soni (ajratilgani bilan solishtirish uchun). */
  candidates: number;
  perPage: PageStat[];
};

const L = LETTER_CLASS;
const LABELS = "ABCDEFGHIJ";
const QSTART = /^\s*(?:(?:savol|вопрос|question|topshiriq|masala|test|№|n°|#)\s*)?(\d{1,4})\s*[.)\]:\-–—]\s*(.*)$/i;
const OPT = new RegExp(`^\\s*\\(?([${L}])\\s*[).:\\-–]\\s*(.*)$`);
const ANSWER_LINE = new RegExp(`^\\s*(?:to['’ʻ‘\`]?g['’ʻ‘\`]?ri\\s+javob|javob|jav\\.?|answer|правильный\\s+ответ|ответ|kalit|key)\\s*[:=\\-–]\\s*\\(?[${L}]\\)?(?:\\s*[,;&и]\\s*\\(?[${L}]\\)?)*`, "i");
const LETTER_G = new RegExp(`[${L}]`, "g");
const SECTION_HEAD = /^\s*(?:(?:variant|test|bilet|вариант|билет)\s*[№#-]?\s*\d{1,3}|\d{1,3}\s*[-–]?\s*(?:variant|test|bilet|вариант))\s*[:.]?\s*$/i;
const MULTI_HINT = /(bir\s+nechta|barcha\s+to['’ʻ‘`]?g['’ʻ‘`]?ri|ikkita\s+to['’ʻ‘`]?g['’ʻ‘`]?ri|несколько|все\s+правильные|all\s+correct|select\s+all)/i;
const MATCH_HINT = /(moslang|moslashtiring|juftlang|соотнесите|сопоставьте|match\b)/i;
const ORDER_HINT = /(tartibga\s+keltiring|ketma-ketlikda|ketma-ket\s+joylashtiring|расположите|последовательност|arrange\s+in\s+order)/i;
const SITUATION_HINT = /^\s*(vaziyat|ситуация|case|keys)\b/i;
const MARK_END = /\s*(?:\*|✓|✔|\(\+\)|\(to['’ʻ‘`]?g['’ʻ‘`]?ri\)|\(правильн\w+\))\s*$/i;

const clean = (s: string) => s.replace(/ /g, " ").replace(/[ \t]+/g, " ").trim();

/** Bir qatordagi «A) .. B) .. C) ..» variantlarni ajratadi (A dan boshlanib ketma-ket bo'lsa). */
export function splitInlineOptions(line: string, style: LabelStyle): { head: string; opts: Opt[] } | null {
  const re = new RegExp(`(?:^|\\s)\\(?([${L}])\\s*[).]\\s`, "g");
  const marks: { idx: number; start: number; end: number; label: string }[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(line))) {
    const lab = canonLabel(m[1], style);
    if (lab) marks.push({ idx: LABELS.indexOf(lab), start: m.index + (/^\s/.test(m[0]) ? 1 : 0), end: m.index + m[0].length, label: lab });
  }
  const first = marks.findIndex((x) => x.idx === 0);
  if (first < 0) return null;
  const chain = [marks[first]];
  for (let i = first + 1; i < marks.length; i++) if (marks[i].idx === chain[chain.length - 1].idx + 1) chain.push(marks[i]);
  if (chain.length < 2) return null;
  const opts = chain.map((c, i) => ({ label: c.label, text: clean(line.slice(c.end, i + 1 < chain.length ? chain[i + 1].start : line.length)) }));
  return { head: clean(line.slice(0, chain[0].start)), opts };
}

function markedAnswer(text: string): { text: string; marked: boolean } {
  const t = text.trim();
  if (/^\*\s*\S/.test(t)) return { text: clean(t.replace(/^\*\s*/, "")), marked: true };
  if (MARK_END.test(t)) return { text: clean(t.replace(MARK_END, "")), marked: true };
  return { text: clean(t), marked: false };
}

export function inferType(text: string, opts: Opt[], answers: string[] | null): QType {
  if (SITUATION_HINT.test(text) && opts.length >= 2) return "SITUATIONAL";
  // Variant ajratilgan bo'lsa (hatto bitta bo'lsa ham) bu tanlovli savol: kam variant «incomplete» sifatida belgilanadi.
  if (opts.length >= 1) return MULTI_HINT.test(text) || (answers?.length ?? 0) > 1 ? "MULTI" : "SINGLE";
  if (MATCH_HINT.test(text)) return "MATCHING";
  if (ORDER_HINT.test(text)) return "ORDERING";
  if (/_{3,}|\.{4,}|…{2,}|yozing|kiriting|напишите|write\b/i.test(text) || /\?\s*$/.test(text)) return "SHORT";
  return "UNKNOWN";
}

const isIncomplete = (q: { text: string; qtype: QType; options: Opt[] }) =>
  q.text.length < 2 || (["SINGLE", "MULTI", "SITUATIONAL"].includes(q.qtype) && (q.options.length < 2 || q.options.some((o) => !o.text)));

// ---------- jadval ko'rinishi ----------
const HEAD_NUM = /^(?:№|n°|#|no\.?|t\/?r|raqam|nomer|номер)$/i;
const HEAD_Q = /(savol|question|вопрос|topshiriq|masala|test)/i;
const HEAD_ANS = /^(?:javob|to['’ʻ‘`]?g['’ʻ‘`]?ri(?:\s+javob)?|answer|ответ|kalit|key|жавоб)$/i;
const HEAD_OPT = new RegExp(`^(?:(?:variant|вариант)\\s*)?\\(?([${L}])\\)?\\.?(?:\\s*(?:variant|вариант))?$`, "i");

/** «№ | Savol | A | B | C | D | Javob» ko'rinishidagi jadval qatorlaridan savollar. null: jadval savol jadvaliga o'xshamaydi. */
export function parseTableRows(rows: string[][], style: LabelStyle, page: string | null): DraftQuestion[] | null {
  if (rows.length < 2) return null;
  let numCol = -1, qCol = -1, ansCol = -1, start = 0;
  const optCols: { col: number; label: string }[] = [];
  // Birinchi qator raqam bilan boshlansa, bu sarlavha emas, ma'lumot qatori.
  const headerLike = !/^\d{1,4}$/.test((rows[0][0] ?? "").trim());
  if (headerLike) rows[0].map((c) => c.trim()).forEach((h, i) => {
    if (HEAD_NUM.test(h)) numCol = i;
    else if (HEAD_ANS.test(h)) ansCol = i;
    else {
      const m = HEAD_OPT.exec(h), lab = m ? canonLabel(m[1], style) : null;
      if (lab) optCols.push({ col: i, label: lab }); else if (HEAD_Q.test(h) && qCol < 0) qCol = i;
    }
  });
  if (qCol >= 0 && optCols.length >= 2) start = 1;
  else {
    // sarlavhasiz jadval: [raqam, savol, variant1..N, (javob)]
    const body = rows.filter((r) => r.length >= 4 && /^\d{1,4}$/.test(r[0].trim()));
    if (body.length < Math.max(2, Math.floor(rows.length * 0.7))) return null;
    const width = Math.max(...body.map((r) => r.length));
    const single = new RegExp(`^[${L}]$`);
    // Oxirgi ustun faqat variantlar matni harf emas bo'lganda javob ustuni deb olinadi (aks holda «a | b | c» variantlar bo'lishi mumkin).
    const optsAreLetters = body.every((r) => r.slice(2, width - 1).every((c) => single.test(c.trim())));
    const lastIsAns = !optsAreLetters && body.every((r) => r.length === width && single.test((r[width - 1] ?? "").trim()));
    numCol = 0; qCol = 1; ansCol = lastIsAns ? width - 1 : -1;
    optCols.length = 0;
    for (let c = 2; c < (lastIsAns ? width - 1 : width); c++) optCols.push({ col: c, label: LABELS[c - 2] });
    if (optCols.length < 2) return null;
    start = 0;
  }
  const out: DraftQuestion[] = [];
  for (let i = start; i < rows.length; i++) {
    const r = rows[i];
    const text = clean(r[qCol] ?? "");
    if (!text) continue;
    const num = numCol >= 0 && /^\d{1,4}$/.test((r[numCol] ?? "").trim()) ? Number((r[numCol] ?? "").trim()) : null;
    const options = optCols.map((o) => ({ label: o.label, text: clean(r[o.col] ?? "") })).filter((o) => o.text);
    let inline: string[] | null = null;
    if (ansCol >= 0) {
      const raw = clean(r[ansCol] ?? "");
      const letters = [...raw.matchAll(new RegExp(`(?<![\\p{L}])[${L}](?![\\p{L}])`, "gu"))].map((x) => canonLabel(x[0], style)).filter((x): x is string => !!x);
      if (letters.length) inline = [...new Set(letters)].sort();
      else { const k = options.findIndex((o) => o.text.toLowerCase() === raw.toLowerCase()); if (k >= 0) inline = [options[k].label]; }
    }
    const qtype = inferType(text, options, inline);
    out.push({ number: num, text, options, page, section: 0, qtype, inlineAnswer: inline, incomplete: isIncomplete({ text, qtype, options }) });
  }
  return out.length ? out : null;
}

// ---------- sahifani elementlarga ajratish ----------
type Item = { kind: "line"; text: string; key: boolean } | { kind: "table"; qs: DraftQuestion[] };

function pageItems(page: Page, style: LabelStyle): Item[] {
  const raw = page.text.split("\n");
  const items: Item[] = [];
  for (let i = 0; i < raw.length; i++) {
    if (raw[i].includes(" | ")) {
      const block: string[] = [];
      let j = i;
      while (j < raw.length && raw[j].includes(" | ")) { block.push(raw[j]); j++; }
      const qs = block.length >= 2 ? parseTableRows(block.map((b) => b.split(" | ")), style, page.label) : null;
      if (qs) { items.push({ kind: "table", qs }); i = j - 1; continue; }
      // savol jadvali emas: «A) x | B) y» ko'rinishidagi variant qatorlarini alohida qatorlarga ajratamiz
      const segs = raw[i].split(" | ").map((s) => s.trim()).filter(Boolean);
      if (segs.length >= 2 && segs.every((s) => OPT.test(s))) { for (const s of segs) items.push({ kind: "line", text: s, key: false }); continue; }
    }
    items.push({ kind: "line", text: raw[i], key: false });
  }
  // Sarlavhasiz kalit: kamida 3 ta ketma-ket «raqam-harf» qatorlari
  let run: number[] = [];
  const flush = () => { if (run.length >= 3) for (const k of run) (items[k] as { key: boolean }).key = true; run = []; };
  items.forEach((it, k) => {
    if (it.kind !== "line") { flush(); return; }
    const t = it.text.trim();
    if (!t) return;
    if (isKeyLine(t)) run.push(k); else flush();
  });
  flush();
  return items;
}

// ---------- asosiy ajratish ----------
export function parseQuestions(pages: Page[]): RuleParse {
  const optSample = pages.map((p) => p.text).join("\n").match(new RegExp(`^\\s*\\(?[${L}]\\s*[).]`, "gm"))?.join("") ?? "";
  const style = detectLabelStyle(optSample);
  const questions: DraftQuestion[] = [];
  const keyLines: string[] = [];
  const perPage: PageStat[] = [];
  const S = { cur: null as DraftQuestion | null, open: null as Opt | null, expect: 0, lastNum: 0, section: 0, inKey: false, candidates: 0 };

  const finish = () => {
    const q = S.cur;
    if (q) {
      q.text = clean(q.text);
      q.options = q.options.map((o) => ({ label: o.label, text: clean(o.text) }));
      q.qtype = inferType(q.text, q.options, q.inlineAnswer);
      q.incomplete = isIncomplete(q);
      if (q.text) questions.push(q);
    }
    S.cur = null; S.open = null; S.expect = 0;
  };
  const begin = (num: number, text: string, page: string) => {
    finish();
    if (num === 1 && S.lastNum > 1) S.section++;
    S.lastNum = num; S.candidates++;
    const inl = splitInlineOptions(text, style);
    const q: DraftQuestion = { number: num, text: inl ? inl.head : text, options: [], page, section: S.section, qtype: "UNKNOWN", inlineAnswer: null, incomplete: false };
    if (inl) { q.options = inl.opts.map((o) => ({ ...o })); S.expect = inl.opts.length; S.open = q.options[q.options.length - 1] ?? null; }
    S.cur = q;
  };
  const addOption = (idx: number, text: string) => {
    const q = S.cur;
    if (!q || idx < 0 || idx >= LABELS.length) return;
    const mk = markedAnswer(text);
    const o: Opt = { label: LABELS[idx], text: mk.text };
    q.options.push(o);
    if (mk.marked) q.inlineAnswer = [...new Set([...(q.inlineAnswer ?? []), o.label])].sort();
    S.open = o; S.expect = idx + 1;
  };

  for (const page of pages) {
    const stat: PageStat = { label: page.label, questions: 0, keyLines: 0, chars: page.text.length };
    perPage.push(stat);
    for (const it of pageItems(page, style)) {
      if (it.kind === "table") {
        finish();
        for (const q of it.qs) {
          if (q.number === 1 && S.lastNum > 1) S.section++;
          if (q.number !== null) S.lastNum = q.number;
          q.section = S.section; S.candidates++; stat.questions++;
          questions.push(q);
        }
        continue;
      }
      const t = it.text.trim();
      if (!t) continue;

      if (KEY_HEADING.test(t)) { finish(); S.inKey = true; continue; }
      if (S.inKey) {
        if (isKeyLine(t)) { keyLines.push(t); stat.keyLines++; continue; }
        if (t.length <= 40) continue;
        S.inKey = false;
      }
      if (it.key) { finish(); keyLines.push(t); stat.keyLines++; continue; }
      if (SECTION_HEAD.test(t)) { finish(); S.section++; S.lastNum = 0; continue; }

      const q = S.cur;
      // «Javob: B» qatori
      const am = ANSWER_LINE.exec(t);
      if (am && q) {
        const tail = am[0].slice(am[0].search(/[:=\-–]/) + 1);
        const letters = [...new Set([...tail.matchAll(LETTER_G)].map((x) => canonLabel(x[0], style)).filter((x): x is string => !!x))].sort();
        q.inlineAnswer = letters.length ? letters : null;
        continue;
      }
      // variant
      if (q) {
        // Bir qatorda bir nechta variant («A) 5 B) 6 C) 7») avval tekshiriladi, so'ng oddiy variant qatori.
        const inl = splitInlineOptions(t, style);
        if (inl && inl.opts[0].label === LABELS[S.expect]) {
          if (inl.head && S.expect === 0) q.text += " " + inl.head;
          for (const o of inl.opts) addOption(LABELS.indexOf(o.label), o.text);
          continue;
        }
        const om = OPT.exec(t);
        if (om) {
          const lab = canonLabel(om[1], style);
          const idx = lab ? LABELS.indexOf(lab) : -1;
          if (idx >= 0 && idx === S.expect) { addOption(idx, om[2]); continue; }
        }
      }
      // yangi savol
      const qm = QSTART.exec(t);
      if (qm) {
        const num = Number(qm[1]);
        const plausible = !q ? num <= 500 : num === S.lastNum + 1 || num === 1 || (num > S.lastNum && num <= S.lastNum + 2);
        if (plausible && num <= 500) { begin(num, qm[2], page.label); stat.questions++; continue; }
      }
      // davomi
      if (q) {
        if (S.open && q.options.length) S.open.text += " " + t;
        else q.text += (q.text ? " " : "") + t;
      }
    }
  }
  finish();

  const key = keyLines.length ? parseAnswerKey(keyLines.join("\n"), style) : { entries: [] as KeyEntry[], style };
  return { questions, keyEntries: key.entries, style, candidates: S.candidates, perPage };
}

/** Sahifalarni mazmun turi bo'yicha belgilaydi: QUESTIONS | ANSWER_KEY | THEORY (savolsiz, uzun matn) va oraliqlarga birlashtiradi. */
export type DocKind = "QUESTIONS" | "ANSWER_KEY" | "THEORY" | "OTHER";
export function classifyPages(perPage: PageStat[]): { kind: DocKind; from: number; to: number }[] {
  const kinds: DocKind[] = perPage.map((p) => (p.questions > 0 ? "QUESTIONS" : p.keyLines >= 3 ? "ANSWER_KEY" : p.chars > 400 ? "THEORY" : "OTHER"));
  const out: { kind: DocKind; from: number; to: number }[] = [];
  kinds.forEach((k, i) => { const last = out[out.length - 1]; if (last && last.kind === k) last.to = i + 1; else out.push({ kind: k, from: i + 1, to: i + 1 }); });
  return out;
}
