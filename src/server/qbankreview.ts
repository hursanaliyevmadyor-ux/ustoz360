import type { Prisma, QuestionStatus } from "@prisma/client";
import { ApiError } from "./auth";
import { audit } from "./audit";
import { db } from "./db";
import { bankWhere } from "./qbank";
import { VERIFIED, progress, queueOrder, reletterExplanation, type BulkApproveInput, type ReviewAction } from "./qbankreviewlogic";

/**
 * Savollar bankini admin bitalab tekshiradi: «Tekshirilgan» belgisi va tasdiqlash bir amalda.
 * Tekshiruvga umumiy bankning haqiqiy savollari kiradi (shaxsiy testlar va namunaviy/demo savollar kirmaydi).
 */
const SCOPE: Prisma.QuestionWhereInput = { collectionId: null, isDemo: false, status: { in: ["DRAFT", "REVIEW", "APPROVED"] } };

export type ReviewFilter = { status?: string; topicId?: string };

const filterWhere = (f: ReviewFilter): Prisma.QuestionWhereInput => ({
  ...SCOPE,
  ...(f.status && ["DRAFT", "REVIEW", "APPROVED"].includes(f.status) && { status: f.status as QuestionStatus }),
  ...(f.topicId && { topicId: f.topicId }),
});

/** Tekshirilmagan savollar navbati (id lar) va umumiy ko'rsatkichlar. */
export async function reviewQueue(f: ReviewFilter) {
  const [verified, total, pending] = await Promise.all([
    db.question.count({ where: { ...filterWhere(f), answerStatus: VERIFIED } }),
    db.question.count({ where: filterWhere(f) }),
    db.question.findMany({ where: { ...filterWhere(f), OR: [{ answerStatus: null }, { answerStatus: { not: VERIFIED } }] }, select: { id: true, status: true }, take: 3000 }),
  ]);
  pending.sort(queueOrder);
  return { ...progress({ verified, total }), ids: pending.map((q) => q.id) };
}

/** Tekshirish ekrani uchun bitta savol: matn, variantlar (harflar bilan), hozirgi javob va izoh. */
export async function getReviewQuestion(id: string) {
  const q = await db.question.findUnique({
    where: { id },
    include: { options: { orderBy: { position: "asc" } }, topic: { select: { name: true, subject: { select: { name: true } } } } },
  });
  if (!q || q.collectionId) throw new ApiError(404, "Savol topilmadi.");
  const reports = await db.questionReport.count({ where: { questionId: id } });
  return {
    id: q.id, text: q.text, explanation: q.explanation, status: q.status, verified: q.answerStatus === VERIFIED, source: q.source, sourceRef: q.sourceRef ?? "",
    topic: q.topic.name, subject: q.topic.subject.name, reports,
    options: q.options.map((o, i) => ({ letter: String.fromCharCode(65 + i), text: o.text, correct: o.isCorrect })),
    correct: Math.max(0, q.options.findIndex((o) => o.isCorrect)),
  };
}

/** Admin qarori: tasdiqlash, javobni tuzatib tasdiqlash, rad etish yoki belgini qaytarish. Har amal auditga yoziladi. */
export async function applyReview(adminId: string, id: string, action: ReviewAction) {
  const q = await db.question.findUnique({ where: { id }, include: { options: { orderBy: { position: "asc" } } } });
  if (!q || q.collectionId) throw new ApiError(404, "Savol topilmadi.");
  const examRowId = `eq${id}`;
  let status: QuestionStatus = q.status;

  if (action.type === "approve") {
    status = "APPROVED";
    await db.question.update({ where: { id }, data: { status, answerStatus: VERIFIED } });
  } else if (action.type === "fix") {
    if (action.correct >= q.options.length) throw new ApiError(400, "To'g'ri variant tanlanmagan.");
    status = "APPROVED";
    const explanation = reletterExplanation(action.explanation, action.correct);
    await db.$transaction(async (tx) => {
      for (const [k, o] of q.options.entries()) await tx.answerOption.update({ where: { id: o.id }, data: { isCorrect: k === action.correct } });
      await tx.question.update({ where: { id }, data: { explanation, status, answerStatus: VERIFIED } });
      // Imtihondagi nusxa (bo'lsa) bank bilan bir xil bo'lib turishi kerak.
      await tx.examQuestion.updateMany({ where: { id: examRowId }, data: { correct: action.correct, explanation } });
    }, { maxWait: 15_000, timeout: 60_000 });
  } else if (action.type === "reject") {
    status = "REJECTED";
    await db.$transaction([
      db.question.update({ where: { id }, data: { status, answerStatus: null } }),
      db.examQuestion.deleteMany({ where: { id: examRowId } }),
    ]);
  } else {
    await db.question.update({ where: { id }, data: { answerStatus: null } });
  }

  await audit(adminId, "qbank.review", { questionId: id, action: action.type, from: q.status, to: status, ...(action.type === "fix" && { correct: action.correct }) });
  return { ok: true as const, status, verified: action.type === "approve" || action.type === "fix" };
}

/**
 * Ommaviy tasdiqlash: tanlangan (yoki filtrga mos hamma) savol «Tasdiqlangan» va «Tekshirilgan» bo'ladi.
 * Rad etilgan, arxivdagi, namunaviy (demo) va shaxsiy testlar savollari o'zgarmaydi. Amal auditga bitta yozuv bilan tushadi.
 */
export async function bulkApprove(adminId: string, input: BulkApproveInput) {
  const target: Prisma.QuestionWhereInput = input.ids ? { id: { in: input.ids }, collectionId: null } : bankWhere(input.filter ?? {});
  const r = await db.question.updateMany({ where: { AND: [target, SCOPE] }, data: { status: "APPROVED", answerStatus: VERIFIED } });
  await audit(adminId, "qbank.bulk_approve", { updated: r.count, mode: input.ids ? "ids" : "filter", ...(input.ids ? { ids: input.ids.slice(0, 50) } : { filter: input.filter ?? {} }) });
  return { ok: true as const, updated: r.count };
}
