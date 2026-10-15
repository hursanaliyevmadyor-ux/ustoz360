import { ApiError } from "./auth";
import { db } from "./db";

/** Sessiyani egasi va rejimi bo'yicha topadi va holatini tekshiradi (diagnostika va takrorlash uchun umumiy). */
export async function loadOpenSession(userId: string, sessionId: string, mode: "DIAGNOSTIC" | "ERRORS") {
  const session = await db.testSession.findFirst({ where: { id: sessionId, userId, mode } });
  if (!session) throw new ApiError(404, "Sessiya topilmadi.");
  if (session.status !== "IN_PROGRESS") throw new ApiError(409, "Bu test allaqachon yakunlangan.");
  // Vaqt tugagan bo'lsa ham mavjud javoblar qabul qilinadi (kechikish uchun 60 soniya imkon).
  if (session.expiresAt.getTime() + 60_000 < Date.now()) {
    await db.testSession.update({ where: { id: session.id }, data: { status: "EXPIRED" } });
    throw new ApiError(410, "Test vaqti tugagan.");
  }
  return session;
}

/** Javoblarni bazadagi kalit bo'yicha baholaydi. Klient yuborgan "to'g'ri" degan ma'lumotga ishonilmaydi. */
export async function gradeAnswers(questionIds: string[], answers: Record<string, string>) {
  const questions = await db.question.findMany({ where: { id: { in: questionIds } }, include: { options: true } });
  return questions.map((q) => {
    const chosen = answers[q.id];
    const correctOpt = q.options.find((o) => o.isCorrect);
    const valid = chosen && q.options.some((o) => o.id === chosen) ? chosen : null;
    return { q, optionId: valid, isCorrect: !!valid && valid === correctOpt?.id, correctOptionId: correctOpt?.id ?? null };
  });
}
export type Graded = Awaited<ReturnType<typeof gradeAnswers>>;
