import { randomBytes } from "node:crypto";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { ApiError, requireVerified } from "../auth";
import { audit } from "../audit";
import { db } from "../db";
import { aiAvailable, importUsageToday, visionConfigured } from "../ai/gateway";
import { storage } from "../storage";
import { providerCaps } from "./aitasks";
import { detectImportKind, KIND_LABEL, maxImportBytes, MAX_FILES_PER_SESSION, MAX_SESSIONS_ACTIVE, safeFileName, sha256Hex, SUPPORTED_ACCEPT, SUPPORTED_LABEL, type ImportKind } from "./formats";
import { parsePageSpec } from "./chunking";
import { pdfPageCount } from "./pdfslice";
import { queueRecheck, type Progress } from "./pipeline";
import { keyMark } from "./verifylogic";
import type { Page } from "./officetext";

/** Foydalanuvchi bilan ishlaydigan import amallari: sessiya, fayl, savollarni ko'rib chiqish (docs/SMART-IMPORT.md). Barcha amallar egasi bo'yicha cheklangan. */
type Viewer = { id: string; roles?: { role: string }[] };
type Opt = { label: string; text: string };
const MAX_SESSIONS_TOTAL = 100;
const MAX_QUESTION_CHARS = 4000;
const MAX_AUTO_PAGES = 60; // bundan katta PDF uchun sahifalarni foydalanuvchi tanlaydi
const randomHex = () => randomBytes(8).toString("hex");
const asProgress = (v: unknown): Progress => (v && typeof v === "object" && !Array.isArray(v) ? { ...(v as Progress) } : {});
type J = Prisma.InputJsonValue;
const asJson = (v: unknown) => v as J;

export const importConfig = () => ({ maxMb: Math.round(maxImportBytes() / 1024 / 1024), maxFiles: MAX_FILES_PER_SESSION, accept: SUPPORTED_ACCEPT, formats: SUPPORTED_LABEL });

/** Imkoniyatlar holati: UI «BLOCKED» qismlarni halol ko'rsatishi uchun. */
export async function importStatus(userId: string) {
  const st = storage();
  const usage = await importUsageToday(userId).catch(() => null);
  const ai = aiAvailable();
  return {
    ...importConfig(),
    storage: { configured: st.configured(), directUpload: st.configured(), chunkBytes: CHUNK_BYTES },
    ai: { vision: visionConfigured(), text: visionConfigured() || ai.any, web: Boolean(process.env.TAVILY_API_KEY), claude: ai.claude },
    providers: providerCaps(),
    usage,
    blocked: [
      ...(!st.configured() ? ["Fayl saqlash xizmati ulanmagan: yuklash mumkin emas (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)."] : []),
      ...(!visionConfigured() ? ["PDF, skaner va rasmlarni o'qish uchun Gemini ulanmagan (GEMINI_API_KEY): faqat DOCX, XLSX, PPTX, ODF, CSV va TXT fayllari qoidalar bilan o'qiladi."] : []),
      ...(!(visionConfigured() || ai.any) ? ["AI ulanmagan: javoblar faqat fayldagi kalit va hisob bo'yicha tekshiriladi."] : []),
    ],
  };
}

async function own(userId: string, id: string) {
  const s = await db.importSession.findFirst({ where: { id, ownerId: userId } });
  if (!s) throw new ApiError(404, "Import topilmadi.");
  return s;
}

export async function createSession(viewer: Viewer, title?: string) {
  await requireVerified(viewer.id);
  const [active, total] = await Promise.all([
    db.importSession.count({ where: { ownerId: viewer.id, status: { in: ["UPLOADED", "QUEUED", "EXTRACTING", "CLASSIFYING", "VERIFYING"] } } }),
    db.importSession.count({ where: { ownerId: viewer.id } }),
  ]);
  if (active >= MAX_SESSIONS_ACTIVE) throw new ApiError(409, `Bir vaqtda ${MAX_SESSIONS_ACTIVE} tadan ortiq import ishlamasin: avval tugaganlarini kuting yoki bekor qiling.`);
  if (total >= MAX_SESSIONS_TOTAL) throw new ApiError(409, "Importlar soni chegaraga yetdi: eskilarini o'chiring.");
  const s = await db.importSession.create({ data: { ownerId: viewer.id, title: (title?.trim() || "Yangi import").slice(0, 120) } });
  return { id: s.id };
}

// ---------- fayllar ----------
export const roleSchema = z.enum(["AUTO", "QUESTIONS", "ANSWERS"]).default("AUTO");

async function assertCanAdd(sessionId: string, userId: string) {
  const s = await own(userId, sessionId);
  if (!["UPLOADED", "NEEDS_REVIEW", "READY_FOR_USER", "FAILED"].includes(s.status)) throw new ApiError(409, "Import hozir qayta ishlanmoqda: tugagach fayl qo'shishingiz mumkin.");
  const n = await db.importFile.count({ where: { importSessionId: sessionId } });
  if (n >= MAX_FILES_PER_SESSION) throw new ApiError(409, `Bir importga ${MAX_FILES_PER_SESSION} tadan ortiq fayl qo'shib bo'lmaydi.`);
  return s;
}

/** Bir xil fayl boshqa importda ham bormi (dublikat aniqlash): bloklamaydi, foydalanuvchiga ko'rsatiladi. */
async function duplicateElsewhere(userId: string, sessionId: string, checksum: string) {
  const d = await db.importFile.findFirst({ where: { checksum, importSessionId: { not: sessionId }, session: { ownerId: userId } }, select: { importSessionId: true, session: { select: { title: true, createdAt: true } } } });
  return d ? { sessionId: d.importSessionId, title: d.session.title, at: d.session.createdAt.toISOString() } : null;
}

/** Kichik fayllar: multipart orqali. Serverda tur, tarkib va hajm tekshiriladi, fayl shaxsiy bucket'ga yoziladi. */
export async function addFile(viewer: Viewer, sessionId: string, file: { name: string; bytes: Uint8Array }, role: z.infer<typeof roleSchema> = "AUTO") {
  await requireVerified(viewer.id);
  const st = storage();
  if (!st.configured()) throw new ApiError(503, "Fayl saqlash xizmati ulanmagan: yuklash vaqtincha mavjud emas.", "storage_unconfigured");
  const s = await assertCanAdd(sessionId, viewer.id);
  const det = detectImportKind(file.name, file.bytes);
  if (!det.ok) throw new ApiError(400, det.error, det.code);
  const checksum = sha256Hex(file.bytes);
  if (await db.importFile.findFirst({ where: { importSessionId: sessionId, checksum }, select: { id: true } })) throw new ApiError(409, "Bu fayl shu importga allaqachon qo'shilgan.", "duplicate");
  const path = `import/${viewer.id}/${sessionId}/${randomHex()}-${safeFileName(file.name)}`;
  await st.put(path, file.bytes, det.mime);
  try {
    const pages = det.kind === "pdf" ? await pdfPageCount(file.bytes) : null;
    const f = await db.importFile.create({ data: { importSessionId: sessionId, role, fileName: safeFileName(file.name), mime: det.mime, kind: det.kind, sizeBytes: file.bytes.length, storagePath: path, checksum, parseStatus: "UPLOADED", pageCount: pages } });
    await reopenIfNeeded(s.id, s.status);
    await audit(viewer.id, "import.file_add", { session: sessionId, file: f.id, kind: det.kind, size: file.bytes.length });
    return { id: f.id, kind: det.kind, duplicateOf: await duplicateElsewhere(viewer.id, sessionId, checksum) };
  } catch (e) {
    await st.remove(path).catch(() => undefined);
    throw e;
  }
}

/** Katta fayl bo'laklarga bo'linib yuboriladi (hosting so'rov hajmi chegarasi ≈4,5 MB): har bir bo'lak shu hajmdan oshmaydi. */
export const CHUNK_BYTES = 3 * 1024 * 1024;
export const prepareSchema = z.object({ name: z.string().trim().min(1).max(200), size: z.number().int().min(1), role: roleSchema.optional() });

/** Katta fayl: yozuv yaratiladi (PENDING_UPLOAD), brauzer bo'laklarni `uploadChunk` bilan yuboradi, so'ng `completeUpload` yig'ib tekshiradi. */
export async function prepareUpload(viewer: Viewer, sessionId: string, input: z.infer<typeof prepareSchema>) {
  await requireVerified(viewer.id);
  const st = storage();
  if (!st.configured()) throw new ApiError(503, "Fayl saqlash xizmati ulanmagan: yuklash vaqtincha mavjud emas.", "storage_unconfigured");
  await assertCanAdd(sessionId, viewer.id);
  if (input.size > maxImportBytes()) throw new ApiError(400, `Fayl ${Math.round(maxImportBytes() / 1024 / 1024)} MB dan oshmasin.`, "too_big");
  const ext = detectImportKind(input.name, new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]));
  if (!ext.ok && ["unsupported", "legacy"].includes(ext.code)) throw new ApiError(400, ext.error, ext.code);
  const name = safeFileName(input.name);
  const path = `import/${viewer.id}/${sessionId}/${randomHex()}-${name}`;
  const chunks = Math.ceil(input.size / CHUNK_BYTES);
  const f = await db.importFile.create({ data: { importSessionId: sessionId, role: input.role ?? "AUTO", fileName: name, mime: "application/octet-stream", kind: "pending", sizeBytes: input.size, storagePath: path, checksum: `pending-${randomHex()}`, parseStatus: "PENDING_UPLOAD", total: chunks } });
  return { fileId: f.id, chunkBytes: CHUNK_BYTES, chunks };
}

export async function uploadChunk(viewer: Viewer, sessionId: string, fileId: string, n: number, bytes: Uint8Array) {
  await own(viewer.id, sessionId);
  const f = await db.importFile.findFirst({ where: { id: fileId, importSessionId: sessionId, parseStatus: "PENDING_UPLOAD" } });
  if (!f) throw new ApiError(404, "Yuklanayotgan fayl topilmadi.");
  if (!Number.isInteger(n) || n < 0 || n >= f.total) throw new ApiError(400, "Bo'lak raqami noto'g'ri.");
  if (bytes.length === 0 || bytes.length > CHUNK_BYTES + 1024) throw new ApiError(400, "Bo'lak hajmi noto'g'ri.");
  const st = storage();
  const part = `${f.storagePath}.part${n}`;
  await st.remove(part).catch(() => undefined); // qayta yuborilgan bo'lak eskisining ustiga yoziladi
  await st.put(part, bytes, "application/octet-stream");
  return { ok: true as const, n };
}

/** Bo'laklarni yig'adi va haqiqiy tur, hajm, dublikatni tekshiradi; noto'g'ri bo'lsa hammasi o'chiriladi. */
export async function completeUpload(viewer: Viewer, sessionId: string, fileId: string) {
  const s = await own(viewer.id, sessionId);
  const f = await db.importFile.findFirst({ where: { id: fileId, importSessionId: sessionId, parseStatus: "PENDING_UPLOAD" } });
  if (!f) throw new ApiError(404, "Yuklanayotgan fayl topilmadi.");
  const st = storage();
  const parts = Array.from({ length: f.total }, (_, i) => `${f.storagePath}.part${i}`);
  const cleanup = async () => { await Promise.all([...parts, f.storagePath].map((p) => st.remove(p).catch(() => undefined))); };
  const discard = async (msg: string, code?: string): Promise<never> => {
    await cleanup();
    await db.importFile.delete({ where: { id: f.id } }).catch(() => undefined);
    throw new ApiError(400, msg, code);
  };
  const buffers: Buffer[] = [];
  try { for (const p of parts) buffers.push(await st.get(p)); } catch { return discard("Fayl bo'laklari to'liq yetib bormadi. Qayta yuklab ko'ring.", "upload_missing"); }
  const bytes = Buffer.concat(buffers);
  if (bytes.length !== f.sizeBytes) return discard("Yuklangan fayl hajmi e'lon qilinganga mos kelmadi. Qayta yuklab ko'ring.", "size_mismatch");
  const det = detectImportKind(f.fileName, new Uint8Array(bytes));
  if (!det.ok) return discard(det.error, det.code);
  const checksum = sha256Hex(new Uint8Array(bytes));
  if (await db.importFile.findFirst({ where: { importSessionId: sessionId, checksum, id: { not: f.id } }, select: { id: true } })) return discard("Bu fayl shu importga allaqachon qo'shilgan.", "duplicate");
  await st.put(f.storagePath, new Uint8Array(bytes), det.mime);
  await Promise.all(parts.map((p) => st.remove(p).catch(() => undefined)));
  const pages = det.kind === "pdf" ? await pdfPageCount(new Uint8Array(bytes)) : null;
  await db.importFile.update({ where: { id: f.id }, data: { mime: det.mime, kind: det.kind, sizeBytes: bytes.length, checksum, parseStatus: "UPLOADED", total: 0, cursor: 0, pageCount: pages } });
  await reopenIfNeeded(s.id, s.status);
  await audit(viewer.id, "import.file_add", { session: sessionId, file: f.id, kind: det.kind, size: bytes.length, chunks: f.total });
  return { id: f.id, kind: det.kind, duplicateOf: await duplicateElsewhere(viewer.id, sessionId, checksum) };
}

/** Tugagan importga fayl qo'shilsa: yangi fayl uchun jarayon qayta ochiladi, avvalgi natijalar saqlanadi. */
async function reopenIfNeeded(sessionId: string, status: string) {
  if (status === "UPLOADED") return;
  const s = await db.importSession.findUnique({ where: { id: sessionId }, select: { progress: true } });
  const p = asProgress(s?.progress);
  p.keysMatched = false; p.topicsDone = false;
  await db.importSession.update({ where: { id: sessionId }, data: { status: "UPLOADED", step: "PARSE", completedAt: null, error: null, lockedUntil: null, progress: asJson(p) } });
}

export async function setFileRole(viewer: Viewer, sessionId: string, fileId: string, role: z.infer<typeof roleSchema>) {
  return setFileOptions(viewer, sessionId, fileId, { role });
}

/** Fayl sozlamalari: vazifasi (savollar / javoblar kaliti) va o'qiladigan sahifalar («3-14, 655-657»; bo'sh = butun fayl). */
export async function setFileOptions(viewer: Viewer, sessionId: string, fileId: string, o: { role?: z.infer<typeof roleSchema>; pages?: string | null }) {
  const s = await own(viewer.id, sessionId);
  if (!["UPLOADED", "NEEDS_REVIEW", "READY_FOR_USER", "FAILED"].includes(s.status)) throw new ApiError(409, "Import qayta ishlanmoqda.");
  const f = await db.importFile.findFirst({ where: { id: fileId, importSessionId: sessionId }, select: { id: true, kind: true, pageCount: true, docKinds: true } });
  if (!f) throw new ApiError(404, "Fayl topilmadi.");
  const data: Prisma.ImportFileUpdateInput = {};
  if (o.role) data.role = o.role;
  if (o.pages !== undefined) {
    if (f.kind !== "pdf") throw new ApiError(400, "Sahifalarni tanlash faqat PDF fayllar uchun.");
    const text = (o.pages ?? "").trim();
    const spec = parsePageSpec(text, f.pageCount ?? 5000);
    if (text && !spec) throw new ApiError(400, `Sahifalar noto'g'ri yozilgan${f.pageCount ? ` (fayl ${f.pageCount} bet)` : ""}. Masalan: 3-14, 655-657`, "bad_pages");
    const prev = (f.docKinds && typeof f.docKinds === "object" && !Array.isArray(f.docKinds) ? f.docKinds : {}) as Record<string, unknown>;
    const next = { ...prev }; if (text) next.pageSpec = text; else delete next.pageSpec;
    // Sahifalar o'zgarsa, oldingi tuzilma va oraliqlar yaroqsiz: qayta hisoblanadi.
    delete next.structDone; delete next.ranges;
    data.docKinds = asJson(next); data.cursor = 0; data.total = 0;
  }
  await db.importFile.update({ where: { id: fileId }, data });
  return { ok: true as const };
}

export async function removeFile(viewer: Viewer, sessionId: string, fileId: string) {
  const s = await own(viewer.id, sessionId);
  if (!["UPLOADED", "NEEDS_REVIEW", "READY_FOR_USER", "FAILED"].includes(s.status)) throw new ApiError(409, "Import qayta ishlanmoqda.");
  const f = await db.importFile.findFirst({ where: { id: fileId, importSessionId: sessionId } });
  if (!f) throw new ApiError(404, "Fayl topilmadi.");
  await db.extractedQuestion.deleteMany({ where: { importSessionId: sessionId, fileId } });
  await storage().remove(f.storagePath).catch(() => undefined);
  await db.importFile.delete({ where: { id: fileId } });
  await audit(viewer.id, "import.file_remove", { session: sessionId, file: fileId });
  return { ok: true as const };
}

export async function startImport(viewer: Viewer, sessionId: string, title?: string) {
  await requireVerified(viewer.id);
  const s = await own(viewer.id, sessionId);
  if (s.status !== "UPLOADED") throw new ApiError(409, "Import allaqachon boshlangan.");
  const files = await db.importFile.findMany({ where: { importSessionId: sessionId }, select: { parseStatus: true, kind: true, fileName: true, pageCount: true, docKinds: true } });
  if (!files.length) throw new ApiError(400, "Avval kamida bitta fayl yuklang.");
  if (files.some((f) => f.parseStatus === "PENDING_UPLOAD")) throw new ApiError(409, "Ba'zi fayllar hali yuklanmagan.");
  // Katta PDF to'plamlari (masalan, 600+ bet): butun fayl emas, kerakli sahifalar tanlanadi (AI limiti va tezlik uchun).
  const big = files.find((f) => f.kind === "pdf" && (f.pageCount ?? 0) > MAX_AUTO_PAGES && !parsePageSpec((f.docKinds as { pageSpec?: string } | null)?.pageSpec, f.pageCount ?? 5000));
  if (big) throw new ApiError(400, `«${big.fileName}» katta (${big.pageCount} bet). Kerakli sahifalarni yozing (masalan: 3-14, 655-657): savollar va ularning javoblar kaliti sahifalari.`, "pages_required");
  await db.importSession.update({ where: { id: sessionId }, data: { status: "QUEUED", step: "PARSE", error: null, ...(title?.trim() && { title: title.trim().slice(0, 120) }) } });
  await audit(viewer.id, "import.start", { session: sessionId, files: files.length });
  return { ok: true as const };
}

export async function cancelSession(viewer: Viewer, sessionId: string) {
  const s = await own(viewer.id, sessionId);
  if (!["QUEUED", "EXTRACTING", "CLASSIFYING", "VERIFYING"].includes(s.status)) throw new ApiError(409, "Bu importni bekor qilib bo'lmaydi.");
  await db.importSession.update({ where: { id: sessionId }, data: { status: "CANCELED", lockedUntil: null } });
  return { ok: true as const };
}

/** Importni va uning fayllarini o'chirish. Saqlangan shaxsiy testlar (to'plamlar) saqlanib qoladi. */
export async function deleteSession(viewer: Viewer, sessionId: string) {
  await own(viewer.id, sessionId);
  const files = await db.importFile.findMany({ where: { importSessionId: sessionId }, select: { storagePath: true } });
  const st = storage();
  if (st.configured()) await Promise.all(files.map((f) => st.remove(f.storagePath).catch(() => undefined)));
  await db.importSession.delete({ where: { id: sessionId } });
  await audit(viewer.id, "import.delete", { session: sessionId, files: files.length });
  return { ok: true as const };
}

// ---------- ko'rinishlar ----------
export async function listSessions(viewer: Viewer) {
  const rows = await db.importSession.findMany({ where: { ownerId: viewer.id }, orderBy: { createdAt: "desc" }, take: 60, include: { _count: { select: { files: true, questions: true } }, collections: { select: { id: true } } } });
  return rows.map((s) => ({ id: s.id, title: s.title, status: s.status, subject: s.subject, files: s._count.files, questions: s._count.questions, collectionIds: s.collections.map((c) => c.id), createdAt: s.createdAt.toISOString(), updatedAt: s.updatedAt.toISOString(), label: asProgress(s.progress).label ?? null }));
}

const FILTERS: Record<string, string[]> = { ready: ["READY"], review: ["NEEDS_REVIEW", "INCOMPLETE", "UNSUPPORTED", "PENDING"], noanswer: ["NO_ANSWER"], conflict: ["CONFLICT"] };

export async function getSession(viewer: Viewer, id: string) {
  const s = await own(viewer.id, id);
  const [files, byStatus, byDecision, extractedByFile, collections, bySection] = await Promise.all([
    db.importFile.findMany({ where: { importSessionId: id }, orderBy: { createdAt: "asc" }, select: { id: true, fileName: true, kind: true, role: true, sizeBytes: true, parseStatus: true, parseError: true, pageCount: true, note: true, docKinds: true, cursor: true, total: true } }),
    db.extractedQuestion.groupBy({ by: ["reviewStatus"], where: { importSessionId: id }, _count: { _all: true } }),
    db.extractedQuestion.groupBy({ by: ["userDecision"], where: { importSessionId: id }, _count: { _all: true } }),
    db.extractedQuestion.groupBy({ by: ["fileId"], where: { importSessionId: id }, _count: { _all: true } }),
    db.personalQuestionCollection.findMany({ where: { importSessionId: id, ownerId: viewer.id }, select: { id: true, title: true } }),
    db.extractedQuestion.groupBy({ by: ["section"], where: { importSessionId: id }, _count: { _all: true }, orderBy: { section: "asc" } }),
  ]);
  // Test sarlavhalari: bo'lim = fayl tartibi * 1000 + sarlavha indeksi (fayllar yaratilish tartibida).
  const groups = bySection.flatMap((x) => { const title = metaOf(files[Math.floor(x.section / 1000)] as FileInfo | undefined).groups?.[x.section % 1000]; return title ? [{ section: x.section, title, count: x._count._all }] : []; });
  const n = Object.fromEntries(byStatus.map((x) => [x.reviewStatus, x._count._all])) as Record<string, number>;
  const dec = Object.fromEntries(byDecision.map((x) => [x.userDecision ?? "NONE", x._count._all])) as Record<string, number>;
  const total = Object.values(n).reduce((a, b) => a + b, 0);
  const p = asProgress(s.progress);
  const ex = new Map(extractedByFile.map((x) => [x.fileId, x._count._all]));
  const withKey = await db.answerVerification.count({ where: { question: { importSessionId: id }, keySource: { not: null } } });
  return {
    id: s.id, title: s.title, status: s.status, step: s.step, subject: s.subject, error: s.error, label: p.label ?? null, warnings: p.warnings ?? [], aiBlocked: p.aiBlocked ?? null,
    createdAt: s.createdAt.toISOString(), updatedAt: s.updatedAt.toISOString(), completedAt: s.completedAt?.toISOString() ?? null,
    files: files.map((f) => ({ id: f.id, fileName: f.fileName, kind: f.kind, kindLabel: KIND_LABEL[f.kind as ImportKind] ?? f.kind, role: f.role, sizeBytes: f.sizeBytes, parseStatus: f.parseStatus, parseError: f.parseError, pageCount: f.pageCount, note: f.note, docKinds: (f.docKinds as { kinds?: unknown } | null)?.kinds ?? null, pageSpec: (f.docKinds as { pageSpec?: string } | null)?.pageSpec ?? null, groups: ((f.docKinds as { groups?: string[] } | null)?.groups ?? []).length, extracted: ex.get(f.id) ?? 0, progress: f.total ? { done: Math.min(f.cursor, f.total), total: f.total } : null })),
    counts: { total, ready: n.READY ?? 0, review: (n.NEEDS_REVIEW ?? 0) + (n.INCOMPLETE ?? 0) + (n.UNSUPPORTED ?? 0) + (n.PENDING ?? 0), noAnswer: n.NO_ANSWER ?? 0, conflict: n.CONFLICT ?? 0, unsupported: n.UNSUPPORTED ?? 0, incomplete: n.INCOMPLETE ?? 0, approved: dec.APPROVED ?? 0, removed: dec.REMOVED ?? 0, withKey },
    collections, groups,
  };
}

type QFull = Awaited<ReturnType<typeof loadQuestions>>[number];
const loadQuestions = (where: Prisma.ExtractedQuestionWhereInput, take?: number, skip?: number) => db.extractedQuestion.findMany({ where, orderBy: { seq: "asc" }, take, skip, include: { verification: true } });

const labelsOf = (v: unknown): string[] | null => (Array.isArray(v) ? (v as unknown[]).map(String) : null);
const effOptions = (q: { options: unknown; editedOptions: unknown }): Opt[] => ((q.editedOptions ?? q.options) as Opt[] | null) ?? [];

type FileInfo = { id: string; fileName: string; docKinds?: unknown };
type FigureMeta = { groups?: string[]; figures?: Record<string, unknown[]> };
const metaOf = (f?: FileInfo): FigureMeta => (f?.docKinds && typeof f.docKinds === "object" && !Array.isArray(f.docKinds) ? (f.docKinds as FigureMeta) : {});

function questionView(q: QFull, fileName: (id: string | null) => string, file?: FileInfo) {
  const v = q.verification;
  const fm = metaOf(file);
  return {
    group: fm.groups?.[q.section % 1000] ?? null, figures: fm.figures?.[q.id] ?? [],
    id: q.id, seq: q.seq, number: q.number, text: q.editedText ?? q.originalText, original: q.editedText !== null ? q.originalText : null,
    options: effOptions(q), qtype: q.qtype, edited: q.editedText !== null || q.editedOptions !== null,
    reviewStatus: q.reviewStatus, decision: q.userDecision, ocrUncertain: q.ocrUncertain, note: q.note,
    sourcePage: q.sourcePage, fileId: q.fileId, fileName: fileName(q.fileId), topicId: q.topicId, subjectGuess: q.subjectGuess, topicGuess: q.topicGuess, grade: q.grade, difficulty: q.difficulty,
    answer: {
      key: labelsOf(v?.keyAnswer), keySource: v?.keySource ?? null, proposed: labelsOf(v?.proposedAnswer), final: labelsOf(v?.finalAnswer),
      origin: v?.answerOrigin ?? "NONE", status: v?.verificationStatus ?? "UNVERIFIED", confidence: v?.confidence ?? null, explanation: v?.explanation ?? null,
      verifiedAt: v?.verifiedAt?.toISOString() ?? null, note: ((v?.providerMetadata as { note?: string } | null)?.note) ?? null,
    },
  };
}

export async function listQuestions(viewer: Viewer, id: string, q: { filter?: string; page?: number; fileId?: string; section?: number }) {
  await own(viewer.id, id);
  const take = 100, skip = Math.max(0, ((q.page ?? 1) - 1) * take);
  const f = q.filter && q.filter !== "all" ? q.filter : null;
  const where: Prisma.ExtractedQuestionWhereInput = { importSessionId: id };
  if (q.fileId) where.fileId = q.fileId;
  if (q.section !== undefined && Number.isInteger(q.section)) where.section = q.section;
  if (f === "approved") where.userDecision = "APPROVED";
  else if (f === "removed") where.userDecision = "REMOVED";
  else if (f && FILTERS[f]) { where.reviewStatus = { in: FILTERS[f] }; where.userDecision = null; }
  else if (!f) where.OR = [{ userDecision: null }, { userDecision: { not: "REMOVED" } }];
  const [rows, count, files] = await Promise.all([loadQuestions(where, take, skip), db.extractedQuestion.count({ where }), db.importFile.findMany({ where: { importSessionId: id }, select: { id: true, fileName: true, docKinds: true } })]);
  const name = (fid: string | null) => files.find((x) => x.id === fid)?.fileName ?? "Fayl";
  return { total: count, page: q.page ?? 1, pages: Math.max(1, Math.ceil(count / take)), items: rows.map((r) => questionView(r, name, files.find((x) => x.id === r.fileId))) };
}

export async function getQuestion(viewer: Viewer, id: string, qid: string) {
  await own(viewer.id, id);
  const q = (await loadQuestions({ id: qid, importSessionId: id }, 1))[0];
  if (!q) throw new ApiError(404, "Savol topilmadi.");
  const files = await db.importFile.findMany({ where: { importSessionId: id }, select: { id: true, fileName: true, kind: true, docKinds: true } });
  const f = files.find((x) => x.id === q.fileId);
  return { ...questionView(q, (fid) => files.find((x) => x.id === fid)?.fileName ?? "Fayl", f), evidence: (q.verification?.evidence as unknown[] | null) ?? [], file: f ? { id: f.id, fileName: f.fileName, kind: f.kind } : null };
}

// ---------- tahrirlash va qaror ----------
export const editSchema = z.object({
  text: z.string().trim().min(2, "Savol matni juda qisqa").max(MAX_QUESTION_CHARS).optional(),
  options: z.array(z.string().trim().min(1, "Variant bo'sh bo'lmasin").max(1000)).min(2, "Kamida 2 ta variant kerak").max(10).optional(),
  topicId: z.string().min(1).nullable().optional(),
  difficulty: z.enum(["EASY", "MEDIUM", "HARD"]).optional(),
});

const LABELS = "ABCDEFGHIJ";
export async function editQuestion(viewer: Viewer, id: string, qid: string, patch: z.infer<typeof editSchema>) {
  await own(viewer.id, id);
  const q = await db.extractedQuestion.findFirst({ where: { id: qid, importSessionId: id }, include: { verification: true } });
  if (!q) throw new ApiError(404, "Savol topilmadi.");
  const data: Prisma.ExtractedQuestionUncheckedUpdateInput = {};
  const opts = patch.options ? patch.options.map((text, i) => ({ label: LABELS[i], text })) : null;
  if (patch.text !== undefined) data.editedText = patch.text === q.originalText ? null : patch.text;
  if (opts) data.editedOptions = JSON.stringify(opts) === JSON.stringify(q.options) ? Prisma.DbNull : asJson(opts);
  if (patch.difficulty) data.difficulty = patch.difficulty;
  if (patch.topicId !== undefined) {
    if (patch.topicId && !(await db.topic.findUnique({ where: { id: patch.topicId }, select: { id: true } }))) throw new ApiError(404, "Mavzu topilmadi.");
    data.topicId = patch.topicId;
  }
  const contentChanged = patch.text !== undefined || !!opts;
  if (contentChanged) {
    const optionCount = (opts ?? effOptions(q)).length;
    // Savol o'zgargach javob tekshiruvi eskirgan: «Tayyor» holati olib tashlanadi, tasdiq bekor qilinadi.
    data.reviewStatus = optionCount < 2 ? "INCOMPLETE" : q.reviewStatus === "READY" || q.reviewStatus === "INCOMPLETE" || q.reviewStatus === "PENDING" ? "NEEDS_REVIEW" : q.reviewStatus;
    if (optionCount >= 2 && ["UNKNOWN", "SHORT"].includes(q.qtype)) data.qtype = "SINGLE";
    data.userDecision = null;
    if (q.verification?.finalAnswer) {
      const lbl = labelsOf(q.verification.finalAnswer) ?? [];
      const keep = lbl.every((l) => (opts ?? effOptions(q)).some((o) => o.label === l));
      if (!keep) await db.answerVerification.update({ where: { questionId: qid }, data: { finalAnswer: Prisma.DbNull } });
    }
  }
  await db.extractedQuestion.update({ where: { id: qid }, data });
  return { ok: true as const };
}

export const confirmSchema = z.object({ answer: z.string().trim().regex(/^[A-J]$/).optional(), vouch: z.boolean().optional() });

/** «To'g'ri»: o'qituvchi javobni o'zi ko'rib chiqib qabul qiladi. Hech narsa avtomatik tasdiqlanmaydi. */
export async function confirmQuestion(viewer: Viewer, id: string, qid: string, input: z.infer<typeof confirmSchema>) {
  await own(viewer.id, id);
  const q = await db.extractedQuestion.findFirst({ where: { id: qid, importSessionId: id }, include: { verification: true } });
  if (!q) throw new ApiError(404, "Savol topilmadi.");
  const options = effOptions(q);
  if (options.length < 2) throw new ApiError(400, "Avval variantlarni to'ldiring (kamida 2 ta).");
  if (!["SINGLE", "SITUATIONAL"].includes(q.qtype)) throw new ApiError(400, "Bu turdagi savolni mavjud testlarda ishlatib bo'lmaydi (faqat bitta to'g'ri javobli savollar).", "unsupported_type");
  const v = q.verification;
  const label = input.answer ?? labelsOf(v?.proposedAnswer)?.[0] ?? labelsOf(v?.keyAnswer)?.[0];
  if (!label || !options.some((o) => o.label === label)) throw new ApiError(400, "To'g'ri variantni tanlang.");
  const vouch = input.vouch !== false;
  const confirmed = v?.verificationStatus === "CONFIRMED" && (labelsOf(v.proposedAnswer) ?? []).includes(label);
  const basis = !vouch ? "UNVERIFIED" : confirmed ? "VERIFIED" : "USER_SET";
  const prev = ((v?.providerMetadata ?? {}) as Record<string, unknown>);
  await db.answerVerification.upsert({
    where: { questionId: qid },
    create: { questionId: qid, finalAnswer: [label], verificationStatus: "USER_CONFIRMED", answerOrigin: "USER", evidence: [], providerMetadata: asJson({ basis }) },
    update: { finalAnswer: [label], verificationStatus: confirmed ? "CONFIRMED" : vouch ? "USER_CONFIRMED" : v?.verificationStatus ?? "UNVERIFIED", providerMetadata: asJson({ ...prev, basis, confirmedAt: new Date().toISOString() }) },
  });
  await db.extractedQuestion.update({ where: { id: qid }, data: { userDecision: "APPROVED" } });
  return { ok: true as const, answer: label, basis };
}

/** Faqat «Tayyor» (kalit mustaqil tasdiqlangan yoki hisoblangan) savollarni birdaniga qabul qilish. Qolganlari alohida ko'rib chiqiladi. */
export async function confirmAllReady(viewer: Viewer, id: string) {
  await own(viewer.id, id);
  const rows = await db.extractedQuestion.findMany({ where: { importSessionId: id, reviewStatus: "READY", userDecision: null, qtype: { in: ["SINGLE", "SITUATIONAL"] }, verification: { is: { verificationStatus: "CONFIRMED" } } }, include: { verification: true } });
  let n = 0;
  for (const q of rows) {
    const label = labelsOf(q.verification?.proposedAnswer)?.[0];
    if (!label || !effOptions(q).some((o) => o.label === label)) continue;
    await db.answerVerification.update({ where: { questionId: q.id }, data: { finalAnswer: [label], providerMetadata: asJson({ ...((q.verification?.providerMetadata ?? {}) as Record<string, unknown>), basis: "VERIFIED", confirmedAt: new Date().toISOString(), bulk: true }) } });
    await db.extractedQuestion.update({ where: { id: q.id }, data: { userDecision: "APPROVED" } });
    n++;
  }
  return { confirmed: n };
}

/**
 * «Kalit bo'yicha belgilash»: javoblar kaliti raqam bo'yicha moslashgan, hali qaror qilinmagan savollarga kalitdagi javob «To'g'ri» deb belgilanadi
 * (o'qituvchining bir marta bosgan tugmasi bilan). Ziddiyatli, noaniq o'qilgan, to'liq bo'lmagan savollar o'tkazib yuboriladi: ularni o'zingiz ko'rib chiqasiz.
 */
export async function confirmByKey(viewer: Viewer, id: string) {
  await own(viewer.id, id);
  const rows = await db.extractedQuestion.findMany({ where: { importSessionId: id, userDecision: null, verification: { is: { keySource: { not: null } } } }, include: { verification: true } });
  const skipped = { conflict: 0, uncertain: 0, unsupported: 0, other: 0 };
  let confirmed = 0;
  for (const q of rows) {
    const v = q.verification!;
    const meta = (v.providerMetadata ?? {}) as Record<string, unknown>;
    const r = keyMark({ reviewStatus: q.reviewStatus, ocrUncertain: q.ocrUncertain, options: effOptions(q), keyAnswer: labelsOf(v.keyAnswer), keyConflict: typeof meta.keyConflict === "string" ? meta.keyConflict : null, verificationStatus: v.verificationStatus, proposedAnswer: labelsOf(v.proposedAnswer) });
    if (!r.mark) { if (r.reason === "conflict") skipped.conflict++; else if (r.reason === "uncertain") skipped.uncertain++; else if (r.reason === "unsupported") skipped.unsupported++; else skipped.other++; continue; }
    await db.answerVerification.update({
      where: { questionId: q.id },
      data: { finalAnswer: [r.label], verificationStatus: r.independent ? "CONFIRMED" : "USER_CONFIRMED", providerMetadata: asJson({ ...meta, basis: r.independent ? "VERIFIED" : "USER_SET", confirmedAt: new Date().toISOString(), byKey: true }) },
    });
    await db.extractedQuestion.update({ where: { id: q.id }, data: { userDecision: "APPROVED" } });
    confirmed++;
  }
  return { confirmed, skipped, total: rows.length };
}

export async function setDecision(viewer: Viewer, id: string, qid: string, decision: "REMOVED" | null) {
  await own(viewer.id, id);
  const r = await db.extractedQuestion.updateMany({ where: { id: qid, importSessionId: id }, data: { userDecision: decision } });
  if (!r.count) throw new ApiError(404, "Savol topilmadi.");
  return { ok: true as const };
}

/** Savolni (yoki hammasini) qayta tekshirishga yuboradi: jarayon qolgan joyidan davom etadi. */
export async function recheck(viewer: Viewer, id: string, qid?: string) {
  await requireVerified(viewer.id);
  const s = await own(viewer.id, id);
  if (["QUEUED", "EXTRACTING", "CLASSIFYING", "VERIFYING"].includes(s.status)) throw new ApiError(409, "Import hozir qayta ishlanmoqda.");
  if (qid) {
    const q = await db.extractedQuestion.findFirst({ where: { id: qid, importSessionId: id }, select: { id: true } });
    if (!q) throw new ApiError(404, "Savol topilmadi.");
  }
  await queueRecheck(id, qid ? [qid] : undefined);
  if (qid) await db.extractedQuestion.update({ where: { id: qid }, data: { userDecision: null } });
  return { ok: true as const };
}

// ---------- asl fayl ko'rinishi ----------
/** Asl fayl: PDF/rasm uchun qisqa muddatli imzolangan havola (sahifaga o'tish #page=N), matnli fayllar uchun ajratilgan matn. */
export async function filePreview(viewer: Viewer, id: string, fileId: string, page?: string) {
  await own(viewer.id, id);
  const f = await db.importFile.findFirst({ where: { id: fileId, importSessionId: id } });
  if (!f) throw new ApiError(404, "Fayl topilmadi.");
  if (["pdf", "image"].includes(f.kind)) {
    if (!storage().configured()) throw new ApiError(503, "Fayl saqlash xizmati ulanmagan.", "storage_unconfigured");
    const n = page ? Number(/\d+/.exec(page)?.[0]) : NaN;
    const url = await storage().signedUrl(f.storagePath, 3600);
    return { kind: f.kind, fileName: f.fileName, url: f.kind === "pdf" && Number.isFinite(n) && n > 0 ? `${url}#page=${n}` : url, text: null as string | null, label: page ?? null };
  }
  const pages = (f.pages as unknown as Page[] | null) ?? [];
  const hit = (page && pages.find((p) => p.label === page)) || null;
  const text = hit ? hit.text : pages.map((p) => `[${p.label}]\n${p.text}`).join("\n\n").slice(0, 20000);
  // DOCX ichidagi rasm belgisi (`[[IMG:k]]`) ko'rsatishda tushunarli «[rasm]» bo'ladi.
  return { kind: f.kind, fileName: f.fileName, url: null as string | null, text: text.replace(/\[\[IMG:\d{1,4}\]\]/g, "[rasm]"), label: hit?.label ?? page ?? null };
}
