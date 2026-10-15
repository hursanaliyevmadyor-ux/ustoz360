import { requireUser } from "@/server/auth";
import { db } from "@/server/db";
import { handle } from "@/server/http";
export const dynamic = "force-dynamic";

export const GET = () => handle(async () => {
  const user = await requireUser();
  const rows = await db.topicMastery.findMany({ where: { userId: user.id }, include: { topic: true } });
  return { topics: rows.map((r) => ({ name: r.topic.name, correct: r.correct, total: r.total, percent: r.total ? Math.round((r.correct / r.total) * 100) : 0, confidence: r.confidence })) };
});
