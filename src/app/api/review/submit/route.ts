import { z } from "zod";
import { requireUser } from "@/server/auth";
import { db } from "@/server/db";
import { gradeAnswers, loadOpenSession } from "@/server/grading";
import { handle } from "@/server/http";
import { confidenceFor, nextReview } from "@/server/scoring";
export const dynamic = "force-dynamic";

export const POST = (req: Request) => handle(async () => {
  const user = await requireUser();
  const body = z.object({ sessionId: z.string(), answers: z.record(z.string(), z.string()) }).parse(await req.json());
  const session = await loadOpenSession(user.id, body.sessionId, "ERRORS");
  const graded = await gradeAnswers(session.questionIds as string[], body.answers);
  const now = new Date();
  const schedule: Record<string, { intervalDays: number; nextReviewAt: Date; mastered: boolean }> = {};

  await db.$transaction(async (tx) => {
    await tx.userAnswer.createMany({ data: graded.map((g) => ({ sessionId: session.id, questionId: g.q.id, optionId: g.optionId, isCorrect: g.isCorrect })) });
    await tx.testSession.update({ where: { id: session.id }, data: { status: "SUBMITTED", submittedAt: now, score: graded.filter((g) => g.isCorrect).length, total: graded.length } });
    for (const g of graded) {
      const card = await tx.errorCard.findUnique({ where: { userId_questionId: { userId: user.id, questionId: g.q.id } } });
      if (!card) continue; // savol kartochkada yo'q bo'lsa, takrorlash jadvaliga tegmaymiz
      const r = nextReview(now, card.intervalDays, g.isCorrect);
      schedule[g.q.id] = r;
      await tx.errorCard.update({
        where: { id: card.id },
        data: g.isCorrect
          ? { intervalDays: r.intervalDays, nextReviewAt: r.nextReviewAt, mastered: r.mastered }
          : { intervalDays: r.intervalDays, nextReviewAt: r.nextReviewAt, mastered: false, mistakes: { increment: 1 }, lastMistakeAt: now },
      });
      const prev = await tx.topicMastery.findUnique({ where: { userId_topicId: { userId: user.id, topicId: g.q.topicId } } });
      const correct = (prev?.correct ?? 0) + (g.isCorrect ? 1 : 0), total = (prev?.total ?? 0) + 1;
      await tx.topicMastery.upsert({
        where: { userId_topicId: { userId: user.id, topicId: g.q.topicId } },
        create: { userId: user.id, topicId: g.q.topicId, correct, total, confidence: confidenceFor(total) },
        update: { correct, total, confidence: confidenceFor(total) },
      });
    }
  });

  return {
    score: graded.filter((g) => g.isCorrect).length, total: graded.length, topics: [],
    review: graded.map((g) => ({
      questionId: g.q.id, text: g.q.text, isCorrect: g.isCorrect, chosenOptionId: g.optionId, correctOptionId: g.correctOptionId,
      explanation: g.isCorrect ? undefined : g.q.explanation, options: g.q.options.map((o) => ({ id: o.id, text: o.text })),
      next: schedule[g.q.id] ? { intervalDays: schedule[g.q.id].intervalDays, mastered: schedule[g.q.id].mastered } : undefined,
    })),
  };
});
