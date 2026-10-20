import { randomBytes } from "node:crypto";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { ApiError, requireVerified } from "../auth";
import { audit } from "../audit";
import { db } from "../db";
import { notify } from "../notify";
import { startFixedPractice } from "../practice";
import { attachFigures, figMeta, figuresReady, removeFigures } from "./figures";
import { FALLBACK_SUBJECT, FALLBACK_TOPIC } from "./verifylogic";

/**
 * «Mening testlarim»: foydalanuvchining shaxsiy savollar to'plami. Savollar `Question` jadvalida (ownerId + collectionId, status DRAFT, source IMPORT):
 * shuning uchun mavjud mashq va diagnostika dvigatellari ularni o'zgarishsiz ishlata oladi, global tasdiqlangan savollar bilan aralashmaydi.
 */
type Viewer = { id: string };
type Opt = { label: string; text: string };
const id = (p: string) => p + randomBytes(10).toString("hex");
const LABELS = "ABCDEFGHIJ";
const asJson = (v: unknown) => v as Prisma.InputJsonValue;
const TX = { maxWait: 15_000, timeout: 60_000 } as const;
const ACTIVE_SESSION = ["UPLOADED", "QUEUED", "EXTRACTING", "CLASSIFYING", "VERIFYING"];

export const SAFE_STATUSES = ["VERIFIED", "USER_SET"] as const;
const labelsOf = (v: unknown): string[] => (Array.isArray(v) ? (v as unknown[]).map(String) : []);
const effOptions = (q: { options: unknown; editedOptions: unknown }): Opt[] => ((q.editedOptions ?? q.options) as Opt[] | null) ?? [];

/** Mavzusi aniqlanmagan savollar uchun umumiy «Tasniflanmagan» mavzu (Shaxsiy testlar fani ostida; boshqa ro'yxatlarda ko'rsatilmaydi). */
export async function ensureFallbackTopic(): Promise<string> {
  const subject = await db.subject.upsert({ where: { slug: FALLBACK_SUBJECT.slug }, create: { slug: FALLBACK_SUBJECT.slug, name: FALLBACK_SUBJECT.name }, update: {} });
  const topic = await db.topic.upsert({ where: { slug: FALLBACK_TOPIC.slug }, create: { slug: FALLBACK_TOPIC.slug, name: FALLBACK_TOPIC.name, subjectId: subject.id }, update: {} });
  return topic.id;
}

export const saveSchema = z.object({
  title: z.string().trim().min(2, "Test nomi juda qisqa").max(120).optional(),
  collectionId: z.string().min(1).optional(),
  topicId: z.string().min(1).nullable().optional(),
  questionIds: z.array(z.string()).max(1000).optional(),
});

/** Tasdiqlangan savollarni shaxsiy testga saqlash. Faqat o'qituvchi «To'g'ri» deb tasdiqlagan, bitta to'g'ri javobli, to'liq savollar o'tadi. */
export async function saveCollection(viewer: Viewer, sessionId: string, input: z.infer<typeof saveSchema>) {
  await requireVerified(viewer.id);
  const s = await db.importSession.findFirst({ where: { id: sessionId, ownerId: viewer.id }, include: { files: { select: { id: true, fileName: true, docKinds: true } } } });
  if (!s) throw new ApiError(404, "Import topilmadi.");
  if (ACTIVE_SESSION.includes(s.status)) throw new ApiError(409, "Import hali tugamagan: tugashini kuting.");
  const qs = await db.extractedQuestion.findMany({ where: { importSessionId: sessionId, userDecision: "APPROVED", ...(input.questionIds && { id: { in: input.questionIds } }) }, orderBy: { seq: "asc" }, include: { verification: true } });
  const metaOf = (fid: string | null) => figMeta(s.files.find((f) => f.id === fid)?.docKinds);
  const choiceOk = (q: (typeof qs)[number]) => {
    const v = q.verification;
    return ["SINGLE", "SITUATIONAL"].includes(q.qtype) && effOptions(q).length >= 2 && labelsOf(v?.finalAnswer).length === 1 && effOptions(q).some((o) => o.label === labelsOf(v?.finalAnswer)[0]);
  };
  const textOf = (q: (typeof qs)[number]) => q.editedText ?? q.originalText;
  // Rasm joyi bor savol faqat rasmi kesib yuklangan bo'lsa saqlanadi (aks holda savol rasmsiz buzuq bo'lib qoladi).
  const eligible = qs.filter((q) => choiceOk(q) && figuresReady(textOf(q), q.id, metaOf(q.fileId)));
  const waitingFigures = qs.filter((q) => choiceOk(q) && !figuresReady(textOf(q), q.id, metaOf(q.fileId))).length;
  if (!eligible.length) throw new ApiError(400, waitingFigures ? "Tasdiqlangan savollarda rasmlar hali tayyor emas: rasmlarni tayyorlab, qayta saqlang yoki savol matnidan rasm belgisini olib tashlang." : "Saqlash uchun tasdiqlangan savol yo'q: avval savollarni «To'g'ri» deb belgilang.", waitingFigures ? "figures_pending" : "nothing_to_save");

  let col = input.collectionId ? await db.personalQuestionCollection.findFirst({ where: { id: input.collectionId, ownerId: viewer.id } }) : null;
  if (input.collectionId && !col) throw new ApiError(404, "Test topilmadi.");
  if (col && !["PRIVATE_ACTIVE", "REJECTED"].includes(col.status)) throw new ApiError(409, "Bu testga savol qo'shib bo'lmaydi (admin ko'rib chiqayotgan yoki ommaviy test).");
  if (!col) col = await db.personalQuestionCollection.create({ data: { ownerId: viewer.id, importSessionId: sessionId, title: (input.title ?? s.title).slice(0, 120), subject: s.subject, sourceNote: s.files.map((f) => f.fileName).join(", ").slice(0, 300) } });
  const colId = col.id;

  if (input.topicId && !(await db.topic.findUnique({ where: { id: input.topicId }, select: { id: true } }))) throw new ApiError(404, "Mavzu topilmadi.");
  const fallback = eligible.some((q) => !q.topicId) && !input.topicId ? await ensureFallbackTopic() : null;
  const have = new Set((await db.question.findMany({ where: { collectionId: colId }, select: { importSourceId: true } })).map((x) => x.importSourceId));
  const last = await db.question.findFirst({ where: { collectionId: colId }, orderBy: { collectionPos: "desc" }, select: { collectionPos: true } });
  let pos = (last?.collectionPos ?? -1) + 1;
  const fileName = (fid: string | null) => s.files.find((f) => f.id === fid)?.fileName ?? "";
  const qRows: Prisma.QuestionCreateManyInput[] = [];
  const oRows: Prisma.AnswerOptionCreateManyInput[] = [];
  let skipped = 0;
  for (const q of eligible) {
    if (have.has(q.id)) { skipped++; continue; }
    const v = q.verification!;
    const correct = labelsOf(v.finalAnswer)[0];
    const basis = ((v.providerMetadata as { basis?: string } | null)?.basis) ?? "USER_SET";
    const qid = id("pq");
    const text = await attachFigures(textOf(q), { owner: viewer.id, sessionId, importQid: q.id, newQid: qid });
    qRows.push({
      id: qid, topicId: q.topicId ?? input.topicId ?? fallback!, text, explanation: v.explanation ?? "", difficulty: (["EASY", "MEDIUM", "HARD"].includes(q.difficulty) ? q.difficulty : "MEDIUM") as "EASY" | "MEDIUM" | "HARD",
      status: "DRAFT", isDemo: false, source: "IMPORT", sourceRef: [fileName(q.fileId), q.sourcePage].filter(Boolean).join(" · ").slice(0, 300) || null, kind: q.qtype === "SITUATIONAL" ? "SITUATIONAL" : "CLASSIC",
      ownerId: viewer.id, collectionId: colId, collectionPos: pos++, importSourceId: q.id, answerStatus: ["VERIFIED", "USER_SET", "UNVERIFIED"].includes(basis) ? basis : "USER_SET",
    });
    effOptions(q).forEach((o, i) => oRows.push({ id: id("po"), questionId: qid, text: o.text, isCorrect: o.label === correct, position: i }));
  }
  if (qRows.length) await db.$transaction([db.question.createMany({ data: qRows }), db.answerOption.createMany({ data: oRows })]);
  await db.personalQuestionCollection.update({ where: { id: colId }, data: { updatedAt: new Date() } });
  await db.importSession.update({ where: { id: sessionId }, data: { status: "USER_APPROVED" } });
  await audit(viewer.id, "import.save_collection", { session: sessionId, collection: colId, added: qRows.length, skipped });
  return { collectionId: colId, added: qRows.length, skipped, notEligible: qs.length - eligible.length, waitingFigures };
}

// ---------- ko'rinishlar ----------
const stateOf = (c: { verified: number; userSet: number; unverified: number; total: number }) =>
  c.total === 0 ? "EMPTY" : c.unverified === 0 && c.verified === c.total ? "VERIFIED" : c.unverified === 0 ? "TEACHER_CONFIRMED" : c.unverified === c.total ? "UNVERIFIED" : "PARTIAL";

export async function listCollections(viewer: Viewer) {
  const rows = await db.personalQuestionCollection.findMany({
    where: { ownerId: viewer.id }, orderBy: { updatedAt: "desc" }, take: 100,
    include: { questions: { select: { answerStatus: true, topic: { select: { name: true, subject: { select: { name: true } } } } } }, submissions: { orderBy: { submittedAt: "desc" }, take: 1, select: { status: true, submittedAt: true, reviewNotes: true } } },
  });
  return rows.map((c) => {
    const counts = { total: c.questions.length, verified: c.questions.filter((q) => q.answerStatus === "VERIFIED").length, userSet: c.questions.filter((q) => q.answerStatus === "USER_SET").length, unverified: c.questions.filter((q) => q.answerStatus === "UNVERIFIED").length };
    const topics = [...new Set(c.questions.map((q) => q.topic.name))].slice(0, 3);
    const subjects = [...new Set(c.questions.map((q) => q.topic.subject.name).filter((n) => n !== FALLBACK_SUBJECT.name))].slice(0, 2);
    const sub = c.submissions[0];
    return { id: c.id, title: c.title, subject: c.subject ?? subjects[0] ?? null, topics, status: c.status, sourceNote: c.sourceNote, counts, state: stateOf(counts), createdAt: c.createdAt.toISOString(), updatedAt: c.updatedAt.toISOString(), submission: sub ? { status: sub.status, at: sub.submittedAt.toISOString(), notes: sub.reviewNotes } : null, visibility: c.status === "PUBLIC_APPROVED" ? "Umumiy" : c.status === "SUBMITTED_TO_ADMIN" ? "Admin ko'rib chiqmoqda" : "Shaxsiy" };
  });
}

async function ownCollection(userId: string, colId: string) {
  const c = await db.personalQuestionCollection.findFirst({ where: { id: colId, ownerId: userId } });
  if (!c) throw new ApiError(404, "Test topilmadi.");
  return c;
}

export async function getCollection(viewer: Viewer, colId: string) {
  const c = await ownCollection(viewer.id, colId);
  const [qs, subs] = await Promise.all([
    db.question.findMany({ where: { collectionId: colId, ownerId: viewer.id }, orderBy: { collectionPos: "asc" }, include: { options: { orderBy: { position: "asc" } }, topic: { select: { id: true, name: true } } } }),
    db.questionReviewSubmission.findMany({ where: { collectionId: colId }, orderBy: { submittedAt: "desc" }, take: 5, select: { id: true, status: true, submittedAt: true, reviewedAt: true, reviewNotes: true } }),
  ]);
  const counts = { total: qs.length, verified: qs.filter((q) => q.answerStatus === "VERIFIED").length, userSet: qs.filter((q) => q.answerStatus === "USER_SET").length, unverified: qs.filter((q) => q.answerStatus === "UNVERIFIED").length };
  return {
    id: c.id, title: c.title, subject: c.subject, status: c.status, sourceNote: c.sourceNote, importSessionId: c.importSessionId, counts, state: stateOf(counts), createdAt: c.createdAt.toISOString(), updatedAt: c.updatedAt.toISOString(),
    editable: ["PRIVATE_ACTIVE", "REJECTED"].includes(c.status),
    questions: qs.map((q) => ({
      id: q.id, pos: q.collectionPos, text: q.text, explanation: q.explanation, difficulty: q.difficulty, answerStatus: q.answerStatus, sourceRef: q.sourceRef, topic: q.topic.name, topicId: q.topicId, kind: q.kind,
      options: q.options.map((o, i) => ({ id: o.id, label: LABELS[i], text: o.text, isCorrect: o.isCorrect })), correct: Math.max(0, q.options.findIndex((o) => o.isCorrect)),
    })),
    submissions: subs.map((s) => ({ id: s.id, status: s.status, at: s.submittedAt.toISOString(), reviewedAt: s.reviewedAt?.toISOString() ?? null, notes: s.reviewNotes })),
  };
}

// ---------- tahrirlash ----------
export const questionPatch = z.object({
  text: z.string().trim().min(2, "Savol matni juda qisqa").max(4000).optional(),
  options: z.array(z.string().trim().min(1, "Variant bo'sh bo'lmasin").max(1000)).min(2).max(10).optional(),
  correct: z.number().int().min(0).max(9).optional(),
  explanation: z.string().trim().max(3000).optional(),
  difficulty: z.enum(["EASY", "MEDIUM", "HARD"]).optional(),
  topicId: z.string().min(1).optional(),
});

async function editable(userId: string, colId: string) {
  const c = await ownCollection(userId, colId);
  if (!["PRIVATE_ACTIVE", "REJECTED"].includes(c.status)) throw new ApiError(409, "Admin ko'rib chiqayotgan yoki ommaviy testni tahrirlab bo'lmaydi.");
  return c;
}

/** Variantlar joyida yangilanadi (id saqlanadi), shunda oldingi javoblar buzilmaydi. */
export async function updateQuestion(viewer: Viewer, colId: string, qid: string, patch: z.infer<typeof questionPatch>) {
  await editable(viewer.id, colId);
  const q = await db.question.findFirst({ where: { id: qid, collectionId: colId, ownerId: viewer.id }, include: { options: { orderBy: { position: "asc" } } } });
  if (!q) throw new ApiError(404, "Savol topilmadi.");
  const options = patch.options ?? q.options.map((o) => o.text);
  const correct = patch.correct ?? Math.max(0, q.options.findIndex((o) => o.isCorrect));
  if (correct >= options.length) throw new ApiError(400, "To'g'ri variant raqami noto'g'ri.");
  if (patch.topicId && !(await db.topic.findUnique({ where: { id: patch.topicId }, select: { id: true } }))) throw new ApiError(404, "Mavzu topilmadi.");
  const answerChanged = patch.correct !== undefined && patch.correct !== q.options.findIndex((o) => o.isCorrect);
  await db.$transaction(async (tx) => {
    await tx.question.update({ where: { id: qid }, data: { ...(patch.text !== undefined && { text: patch.text }), ...(patch.explanation !== undefined && { explanation: patch.explanation }), ...(patch.difficulty && { difficulty: patch.difficulty }), ...(patch.topicId && { topicId: patch.topicId }), ...(answerChanged && { answerStatus: "USER_SET" }) } });
    if (patch.options || patch.correct !== undefined) {
      for (let k = 0; k < options.length; k++) {
        const o = q.options[k];
        if (o) await tx.answerOption.update({ where: { id: o.id }, data: { text: options[k], isCorrect: k === correct, position: k } });
        else await tx.answerOption.create({ data: { questionId: qid, text: options[k], isCorrect: k === correct, position: k } });
      }
      const extra = q.options.slice(options.length).map((o) => o.id);
      if (extra.length) await tx.answerOption.deleteMany({ where: { id: { in: extra } } });
    }
  }, TX);
  await db.personalQuestionCollection.update({ where: { id: colId }, data: { updatedAt: new Date() } });
  return { ok: true as const };
}

/** Savolni testdan olib tashlash: faqat egasining javoblari va xatolar kartalari bilan birga o'chadi (boshqa foydalanuvchida yo'q). */
async function purgeQuestions(tx: Prisma.TransactionClient, ids: string[]) {
  if (!ids.length) return;
  await tx.userAnswer.deleteMany({ where: { questionId: { in: ids } } });
  await tx.errorCard.deleteMany({ where: { questionId: { in: ids } } });
  await tx.questionReport.deleteMany({ where: { questionId: { in: ids } } });
  await tx.question.deleteMany({ where: { id: { in: ids } } });
}

export async function removeQuestion(viewer: Viewer, colId: string, qid: string) {
  await editable(viewer.id, colId);
  const q = await db.question.findFirst({ where: { id: qid, collectionId: colId, ownerId: viewer.id }, select: { id: true, text: true } });
  if (!q) throw new ApiError(404, "Savol topilmadi.");
  await db.$transaction((tx) => purgeQuestions(tx, [qid]), TX);
  await removeFigures([q.text], viewer.id);
  return { ok: true as const };
}

export const renameSchema = z.object({ title: z.string().trim().min(2).max(120).optional(), subject: z.string().trim().max(60).nullable().optional() });
export async function updateCollection(viewer: Viewer, colId: string, patch: z.infer<typeof renameSchema>) {
  await ownCollection(viewer.id, colId);
  await db.personalQuestionCollection.update({ where: { id: colId }, data: { ...(patch.title && { title: patch.title }), ...(patch.subject !== undefined && { subject: patch.subject || null }) } });
  return { ok: true as const };
}

/** Testni butunlay o'chirish (shaxsiy ma'lumotlarni o'chirish): savollar, variantlar, javoblar, yuborish yozuvlari. Admin tasdiqlab umumiy bankka o'tkazgan nusxalar (alohida savollar) qoladi. */
export async function deleteCollection(viewer: Viewer, colId: string) {
  const c = await ownCollection(viewer.id, colId);
  if (c.status === "SUBMITTED_TO_ADMIN") throw new ApiError(409, "Test admin ko'rib chiqishida: avval yuborishni qaytarib oling.");
  const rows = await db.question.findMany({ where: { collectionId: colId, ownerId: viewer.id }, select: { id: true, text: true } });
  const ids = rows.map((q) => q.id);
  await db.$transaction(async (tx) => { await purgeQuestions(tx, ids); await tx.personalQuestionCollection.delete({ where: { id: colId } }); }, TX);
  await removeFigures(rows.map((q) => q.text), viewer.id);
  await audit(viewer.id, "import.delete_collection", { collection: colId, questions: ids.length });
  return { ok: true as const };
}

// ---------- mashq va diagnostika ----------
export const startSchema = z.object({ mode: z.enum(["practice", "test", "diagnostic"]), includeUnverified: z.boolean().optional(), shuffle: z.boolean().optional(), count: z.number().int().min(1).max(200).optional(), durationMin: z.number().int().min(1).max(180).optional() });

const shuffled = <T,>(a: T[]) => { const x = [...a]; for (let i = x.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [x[i], x[j]] = [x[j], x[i]]; } return x; };

/**
 * Shaxsiy testni mavjud dvigatelda ishga tushirish. Diagnostika: javoblar test tugaguncha ko'rinmaydi (yakunda tekshiriladigan rejim) va faqat
 * tasdiqlangan (kalit/manba bilan yoki o'qituvchi belgilagan) savollar olinadi; tasdiqlanmaganlari faqat aniq tanlansa qo'shiladi.
 */
export async function startCollection(viewer: Viewer, colId: string, input: z.infer<typeof startSchema>) {
  const c = await ownCollection(viewer.id, colId);
  if (c.status === "ARCHIVED") throw new ApiError(409, "Bu test arxivlangan.");
  const qs = await db.question.findMany({ where: { collectionId: colId, ownerId: viewer.id, status: { not: "ARCHIVED" } }, orderBy: { collectionPos: "asc" }, select: { id: true, answerStatus: true, topicId: true } });
  const pool = input.mode === "diagnostic" && !input.includeUnverified ? qs.filter((q) => (SAFE_STATUSES as readonly string[]).includes(q.answerStatus ?? "")) : qs;
  if (!pool.length) throw new ApiError(404, input.mode === "diagnostic" ? "Diagnostika uchun tasdiqlangan savol yo'q. Savollarni tekshiring yoki «tasdiqlanmaganlarni ham qo'shish»ni tanlang." : "Testda savollar yo'q.", "no_questions");
  const picked = (input.shuffle ?? input.mode !== "diagnostic" ? shuffled(pool) : pool).slice(0, input.count ?? pool.length);
  const kind = input.mode === "practice" ? "quick" : input.mode === "test" ? "topictest" : "timed";
  const r = await startFixedPractice(viewer.id, { kind, ids: picked.map((q) => q.id), topicIds: [...new Set(picked.map((q) => q.topicId))], durationMin: input.mode === "diagnostic" ? input.durationMin ?? null : input.mode === "test" ? input.durationMin ?? null : null, personal: { collectionId: colId, title: c.title, mode: input.mode } });
  const skipped = qs.length - pool.length;
  return { ...r, skippedUnverified: input.mode === "diagnostic" ? skipped : 0, href: kind === "quick" ? `/ustoz-ai/mashq/${r.id}` : `/ustoz-ai/testlar/${r.id}` };
}

// ---------- adminga yuborish ----------
export const submitSchema = z.object({ rightsConfirmed: z.literal(true, { message: "Materialni ulashish huquqingiz borligini tasdiqlang." }), rightsNote: z.string().trim().max(500).optional(), note: z.string().trim().max(500).optional() });

/** Testni admin ko'rib chiqishiga yuborish. Savollar to'g'ridan-to'g'ri ommaviy bo'lmaydi: faqat admin tasdiqlasa va ulashish huquqi tasdiqlangan bo'lsa umumiy bankka o'tadi. */
export async function submitCollection(viewer: Viewer, colId: string, input: z.infer<typeof submitSchema>) {
  await requireVerified(viewer.id);
  const c = await ownCollection(viewer.id, colId);
  if (!["PRIVATE_ACTIVE", "REJECTED"].includes(c.status)) throw new ApiError(409, c.status === "SUBMITTED_TO_ADMIN" ? "Test allaqachon yuborilgan." : "Bu testni yuborib bo'lmaydi.");
  const n = await db.question.count({ where: { collectionId: colId, ownerId: viewer.id } });
  if (n === 0) throw new ApiError(400, "Testda savollar yo'q.");
  const sub = await db.questionReviewSubmission.create({ data: { userId: viewer.id, collectionId: colId, rightsConfirmed: true, rightsNote: input.rightsNote || null, note: input.note || null } });
  await db.personalQuestionCollection.update({ where: { id: colId }, data: { status: "SUBMITTED_TO_ADMIN" } });
  const admins = await db.userRole.findMany({ where: { role: { in: ["ADMIN", "SUPERADMIN"] } }, select: { userId: true }, distinct: ["userId"] });
  await Promise.all(admins.map((a) => notify(a.userId, { kind: "import", title: "Foydalanuvchi test yubordi", text: `${c.title} (${n} ta savol)`, href: "/admin/foydalanuvchi-testlari" })));
  await audit(viewer.id, "import.submit", { collection: colId, submission: sub.id, questions: n });
  return { submissionId: sub.id };
}

export async function withdrawSubmission(viewer: Viewer, colId: string) {
  const c = await ownCollection(viewer.id, colId);
  if (c.status !== "SUBMITTED_TO_ADMIN") throw new ApiError(409, "Test admin ko'rib chiqishida emas.");
  await db.$transaction([
    db.questionReviewSubmission.updateMany({ where: { collectionId: colId, status: "SUBMITTED" }, data: { status: "ARCHIVED", reviewedAt: new Date(), reviewNotes: "Foydalanuvchi qaytarib oldi." } }),
    db.personalQuestionCollection.update({ where: { id: colId }, data: { status: "PRIVATE_ACTIVE" } }),
  ]);
  return { ok: true as const };
}
