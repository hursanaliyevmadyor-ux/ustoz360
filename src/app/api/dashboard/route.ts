import { requireUser } from "@/server/auth";
import { db } from "@/server/db";
import { buildTasks, daysUntil, overallPercent } from "@/server/dashboard";
import { handle } from "@/server/http";
export const dynamic = "force-dynamic";

export const GET = () => handle(async () => {
  const user = await requireUser();
  const now = new Date();
  const [profile, sessions, mastery, cards] = await Promise.all([
    db.profile.findUnique({ where: { userId: user.id } }),
    db.testSession.findMany({ where: { userId: user.id, status: "SUBMITTED" }, orderBy: { submittedAt: "desc" }, take: 6, select: { mode: true, score: true, total: true, submittedAt: true } }),
    db.topicMastery.findMany({ where: { userId: user.id }, include: { topic: true } }),
    db.errorCard.findMany({ where: { userId: user.id }, select: { mastered: true, nextReviewAt: true } }),
  ]);
  const m = mastery.map((x) => ({ name: x.topic.name, correct: x.correct, total: x.total, confidence: x.confidence }));
  const dueErrors = cards.filter((c) => !c.mastered && c.nextReviewAt <= now).length;
  const hasDiagnostic = sessions.some((s) => s.mode === "DIAGNOSTIC");
  const last = sessions[0];
  const pct = (s: { score: number | null; total: number | null }) => (s.total ? Math.round(((s.score ?? 0) / s.total) * 100) : 0);
  return {
    name: user.name ?? user.email ?? "Foydalanuvchi",
    daysLeft: daysUntil(profile?.examDate ?? null, now),
    examDate: profile?.examDate ?? null,
    dailyMinutes: profile?.dailyMinutes ?? null,
    level: overallPercent(m),
    lastTest: last ? { score: last.score, total: last.total, mode: last.mode, at: last.submittedAt } : null,
    history: sessions.slice().reverse().map(pct),
    errors: { total: cards.length, due: dueErrors, mastered: cards.filter((c) => c.mastered).length },
    topics: m.map((x) => ({ ...x, percent: x.total ? Math.round((x.correct / x.total) * 100) : 0 })).sort((a, b) => a.percent - b.percent),
    tasks: buildTasks({ hasDiagnostic, dueErrors, mastery: m, hasExamDate: !!profile?.examDate }),
  };
});
