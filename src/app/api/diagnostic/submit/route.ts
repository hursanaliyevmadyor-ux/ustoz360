import { z } from "zod";
import { requireUser } from "@/server/auth";
import { gradeAnswers, loadOpenSession } from "@/server/grading";
import { db } from "@/server/db";
import { handle } from "@/server/http";
import { confidenceFor, groupByTopic, nextReview } from "@/server/scoring";
export const dynamic = "force-dynamic";

export const POST = (req: Request) => handle(async () => {
  const user = await requireUser();
  const body = z.object({ sessionId: z.string(), answers: z.record(z.string(), z.string()) }).parse(await req.json());

  const session = await loadOpenSession(user.id, body.sessionId, "DIAGNOSTIC");
  const ids = session.questionIds as string[];
  const now = new Date();
  const graded = await gradeAnswers(ids, body.answers);
  const questions = graded.map((g) => g.q);

  await db.$transaction(async (tx) => {
    await tx.userAnswer.createMany({ data: graded.map((g) => ({ sessionId: session.id, questionId: g.q.id, optionId: g.optionId, isCorrect: g.isCorrect })) });
    const score = graded.filter((g) => g.isCorrect).length;
    await tx.testSession.update({ where: { id: session.id }, data: { status: "SUBMITTED", submittedAt: now, score, total: graded.length } });

    for (const t of groupByTopic(graded.map((g) => ({ topicId: g.q.topicId, isCorrect: g.isCorrect })))) {
      const prev = await tx.topicMastery.findUnique({ where: { userId_topicId: { userId: user.id, topicId: t.topicId } } });
      const correct = (prev?.correct ?? 0) + t.correct, total = (prev?.total ?? 0) + t.total;
      await tx.topicMastery.upsert({
        where: { userId_topicId: { userId: user.id, topicId: t.topicId } },
        create: { userId: user.id, topicId: t.topicId, correct, total, confidence: confidenceFor(total) },
        update: { correct, total, confidence: confidenceFor(total) },
      });
    }
    for (const g of graded.filter((x) => !x.isCorrect)) {
      const r = nextReview(now, 1, false);
      await tx.errorCard.upsert({
        where: { userId_questionId: { userId: user.id, questionId: g.q.id } },
        create: { userId: user.id, questionId: g.q.id, nextReviewAt: r.nextReviewAt, intervalDays: r.intervalDays },
        update: { mistakes: { increment: 1 }, mastered: false, nextReviewAt: r.nextReviewAt, intervalDays: r.intervalDays, lastMistakeAt: now },
      });
    }
  });

  const topics = await db.topicMastery.findMany({ where: { userId: user.id, topicId: { in: [...new Set(questions.map((q) => q.topicId))] } }, include: { topic: true } });
  return {
    score: graded.filter((g) => g.isCorrect).length,
    total: graded.length,
    topics: topics.map((t) => ({ name: t.topic.name, correct: t.correct, total: t.total, confidence: t.confidence, needsMoreData: t.confidence === "LOW" })),
    // Javob kaliti faqat topshirilgandan keyin ochiladi.
    review: graded.map((g) => ({
      questionId: g.q.id, text: g.q.text, isCorrect: g.isCorrect, chosenOptionId: g.optionId, correctOptionId: g.correctOptionId,
      explanation: g.isCorrect ? undefined : g.q.explanation, options: g.q.options.map((o) => ({ id: o.id, text: o.text })),
    })),
  };
});
