import { requireUser } from "@/server/auth";
import { db } from "@/server/db";
import { handle } from "@/server/http";
import { shuffle } from "@/server/scoring";
export const dynamic = "force-dynamic";

const COUNT = 30;          // MVP: 30 ta savol; bazada kam bo'lsa mavjudi olinadi
const DURATION_MIN = 45;

export const POST = () => handle(async () => {
  const user = await requireUser();
  // Faqat APPROVED savollar rasmiy diagnostikaga kiradi.
  const pool = await db.question.findMany({ where: { status: "APPROVED" }, select: { id: true } });
  if (pool.length === 0) return { error: "Tasdiqlangan savollar yo'q." };
  const ids = shuffle(pool.map((q) => q.id)).slice(0, COUNT);
  const session = await db.testSession.create({
    data: { userId: user.id, mode: "DIAGNOSTIC", questionIds: ids, expiresAt: new Date(Date.now() + DURATION_MIN * 60_000) },
  });
  const questions = await db.question.findMany({
    where: { id: { in: ids } },
    select: { id: true, text: true, difficulty: true, isDemo: true, topic: { select: { name: true } }, options: { select: { id: true, text: true, position: true }, orderBy: { position: "asc" } } },
  });
  // Javob kaliti (isCorrect, explanation) klientga yuborilmaydi.
  const byId = new Map(questions.map((q) => [q.id, q]));
  return { sessionId: session.id, expiresAt: session.expiresAt, questions: ids.map((id) => byId.get(id)!) };
});
