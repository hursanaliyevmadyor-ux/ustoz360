import { requireUser } from "@/server/auth";
import { db } from "@/server/db";
import { handle } from "@/server/http";
export const dynamic = "force-dynamic";

export const GET = () => handle(async () => {
  const user = await requireUser();
  const cards = await db.errorCard.findMany({ where: { userId: user.id }, include: { question: { include: { topic: true } } }, orderBy: { nextReviewAt: "asc" } });
  return { cards: cards.map((c) => ({ id: c.id, text: c.question.text, topic: c.question.topic.name, isDemo: c.question.isDemo, mistakes: c.mistakes, mastered: c.mastered, nextReviewAt: c.nextReviewAt, lastMistakeAt: c.lastMistakeAt })) };
});
