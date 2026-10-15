import { requireUser } from "@/server/auth";
import { db } from "@/server/db";
import { handle } from "@/server/http";
import { shuffle } from "@/server/scoring";
export const dynamic = "force-dynamic";

const MAX = 10;
const DURATION_MIN = 30;

/** Takrorlash muddati kelgan (o'zlashtirilmagan) xato kartochkalaridan test tuzadi. */
export const POST = () => handle(async () => {
  const user = await requireUser();
  const due = await db.errorCard.findMany({
    where: { userId: user.id, mastered: false, nextReviewAt: { lte: new Date() }, question: { status: "APPROVED" } },
    orderBy: { nextReviewAt: "asc" }, take: MAX, select: { questionId: true },
  });
  if (due.length === 0) return { empty: true };
  const ids = shuffle(due.map((c) => c.questionId));
  const session = await db.testSession.create({ data: { userId: user.id, mode: "ERRORS", questionIds: ids, expiresAt: new Date(Date.now() + DURATION_MIN * 60_000) } });
  const questions = await db.question.findMany({
    where: { id: { in: ids } },
    select: { id: true, text: true, difficulty: true, isDemo: true, topic: { select: { name: true } }, options: { select: { id: true, text: true, position: true }, orderBy: { position: "asc" } } },
  });
  const byId = new Map(questions.map((q) => [q.id, q]));
  return { sessionId: session.id, expiresAt: session.expiresAt, questions: ids.map((id) => byId.get(id)!) };
});
