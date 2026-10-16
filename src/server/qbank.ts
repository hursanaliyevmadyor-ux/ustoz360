import type { Prisma, QuestionStatus } from "@prisma/client";
import { ApiError } from "./auth";
import { db } from "./db";
import type { BankQuestionInput } from "./adminvalid";

/** Admin uchun savollar banki: mashqda faqat APPROVED savollar ko'rinadi. AI yaratgan savollar DRAFT bo'lib keladi va faqat admin tasdiqlaydi. */

export type BankFilter = { status?: string; topicId?: string; source?: string; q?: string };

export async function listBank(f: BankFilter) {
  const where: Prisma.QuestionWhereInput = {};
  if (f.status) where.status = f.status as QuestionStatus;
  if (f.topicId) where.topicId = f.topicId;
  if (f.source) where.source = f.source;
  if (f.q) where.text = { contains: f.q, mode: "insensitive" };
  const [rows, counts, reports] = await Promise.all([
    db.question.findMany({ where, orderBy: { createdAt: "desc" }, take: 200, include: { topic: { select: { name: true, subject: { select: { name: true } } } }, _count: { select: { options: true } } } }),
    db.question.groupBy({ by: ["status"], _count: { _all: true } }),
    db.questionReport.groupBy({ by: ["questionId"], _count: { _all: true } }),
  ]);
  const rep = new Map(reports.map((r) => [r.questionId, r._count._all]));
  return {
    counts: Object.fromEntries(counts.map((c) => [c.status, c._count._all])) as Record<string, number>,
    items: rows.map((q) => ({
      id: q.id, text: q.text, topicId: q.topicId, topic: q.topic.name, subject: q.topic.subject.name, difficulty: q.difficulty, status: q.status,
      source: q.source, sample: q.isDemo, kind: q.kind, skill: q.skill, options: q._count.options, reports: rep.get(q.id) ?? 0, createdAt: q.createdAt,
    })),
  };
}

export async function getBankQuestion(id: string) {
  const q = await db.question.findUnique({ where: { id }, include: { options: { orderBy: { position: "asc" } } } });
  if (!q) throw new ApiError(404, "Savol topilmadi.");
  const reports = await db.questionReport.findMany({ where: { questionId: id }, orderBy: { createdAt: "desc" }, take: 20, select: { id: true, reason: true, createdAt: true } });
  return {
    id: q.id, topicId: q.topicId, text: q.text, explanation: q.explanation, superKey: q.superKey ?? "", difficulty: q.difficulty, status: q.status,
    source: q.source, sourceRef: q.sourceRef ?? "", sample: q.isDemo, skill: q.skill ?? "", kind: q.kind,
    options: q.options.map((o) => o.text), correct: Math.max(0, q.options.findIndex((o) => o.isCorrect)), reports,
  };
}

async function ensureTopic(topicId: string) {
  if (!(await db.topic.findUnique({ where: { id: topicId }, select: { id: true } }))) throw new ApiError(404, "Mavzu topilmadi.");
}

export async function createBankQuestion(i: BankQuestionInput) {
  await ensureTopic(i.topicId);
  const q = await db.question.create({
    data: {
      topicId: i.topicId, text: i.text, explanation: i.explanation, superKey: i.superKey ?? null, difficulty: i.difficulty, status: i.status,
      source: "MANUAL", sourceRef: i.sourceRef ?? null, isDemo: false, skill: i.skill ?? null, kind: i.kind,
      options: { create: i.options.map((text, k) => ({ text, isCorrect: k === i.correct, position: k })) },
    },
  });
  return { id: q.id };
}

/** Variantlar joyida yangilanadi (id saqlanadi), shunda oldingi javoblar buzilmaydi. */
export async function updateBankQuestion(id: string, i: BankQuestionInput) {
  const cur = await db.question.findUnique({ where: { id }, include: { options: { orderBy: { position: "asc" } } } });
  if (!cur) throw new ApiError(404, "Savol topilmadi.");
  await ensureTopic(i.topicId);
  await db.$transaction(async (tx) => {
    await tx.question.update({
      where: { id },
      data: { topicId: i.topicId, text: i.text, explanation: i.explanation, superKey: i.superKey ?? null, difficulty: i.difficulty, status: i.status, sourceRef: i.sourceRef ?? null, skill: i.skill ?? null, kind: i.kind },
    });
    for (let k = 0; k < i.options.length; k++) {
      const o = cur.options[k];
      if (o) await tx.answerOption.update({ where: { id: o.id }, data: { text: i.options[k], isCorrect: k === i.correct, position: k } });
      else await tx.answerOption.create({ data: { questionId: id, text: i.options[k], isCorrect: k === i.correct, position: k } });
    }
    const extra = cur.options.slice(i.options.length).map((o) => o.id);
    if (extra.length) await tx.answerOption.deleteMany({ where: { id: { in: extra } } });
  }, { maxWait: 15_000, timeout: 60_000 });
  return { ok: true as const };
}

export async function setBankStatus(id: string, status: string) {
  const r = await db.question.updateMany({ where: { id }, data: { status: status as QuestionStatus } });
  if (!r.count) throw new ApiError(404, "Savol topilmadi.");
  return { ok: true as const };
}

/** Foydalanuvchi javoblari bog'langan savol o'chirilmaydi: arxivga olinadi (natijalar saqlanadi). */
export async function deleteBankQuestion(id: string) {
  const q = await db.question.findUnique({ where: { id }, select: { _count: { select: { answers: true, errorCards: true } } } });
  if (!q) throw new ApiError(404, "Savol topilmadi.");
  if (q._count.answers > 0 || q._count.errorCards > 0) {
    await db.question.update({ where: { id }, data: { status: "ARCHIVED" } });
    return { ok: true as const, archived: true };
  }
  await db.questionReport.deleteMany({ where: { questionId: id } });
  await db.question.delete({ where: { id } });
  return { ok: true as const, archived: false };
}
