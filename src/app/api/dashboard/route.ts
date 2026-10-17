import { requireUser } from "@/server/auth";
import { db } from "@/server/db";
import { buildTasks, daysUntil, overallPercent } from "@/server/dashboard";
import { listPublicSeminars } from "@/server/admin";
import { getEntitlements } from "@/server/entitlements";
import { handle } from "@/server/http";
import { uzToday } from "@/server/planlogic";
import { activePractice } from "@/server/practice";
import { getSetting } from "@/server/settings";
import { visibleAnnouncements } from "@/server/settingsdef";
export const dynamic = "force-dynamic";

export const GET = () => handle(async () => {
  const user = await requireUser();
  const now = new Date();
  const today = new Date(uzToday(now) + "T00:00:00Z");
  const [profile, sessions, mastery, cards, planToday, planFuture, seminars, resume, ent, sub, courses, pending, ann, pay] = await Promise.all([
    db.profile.findUnique({ where: { userId: user.id } }),
    db.testSession.findMany({ where: { userId: user.id, status: "SUBMITTED" }, orderBy: { submittedAt: "desc" }, take: 6, select: { mode: true, score: true, total: true, submittedAt: true } }),
    db.topicMastery.findMany({ where: { userId: user.id }, include: { topic: true } }),
    db.errorCard.findMany({ where: { userId: user.id }, select: { mastered: true, nextReviewAt: true } }),
    db.planItem.findMany({ where: { userId: user.id, date: today }, orderBy: [{ position: "asc" }, { createdAt: "asc" }], select: { id: true, title: true, href: true, doneAt: true } }),
    db.planItem.count({ where: { userId: user.id, date: { gt: today } } }),
    listPublicSeminars().catch(() => ({ seminars: [] })),
    activePractice(user.id).catch(() => null),
    getEntitlements(user.id).catch(() => null),
    db.subscription.findFirst({ where: { userId: user.id, status: "ACTIVE", OR: [{ endsAt: null }, { endsAt: { gt: now } }] }, orderBy: { endsAt: "desc" }, select: { endsAt: true } }),
    db.courseAccess.count({ where: { userId: user.id } }),
    db.payment.count({ where: { userId: user.id, status: "PENDING" } }),
    getSetting("announcements").catch(() => ({ items: [] })),
    getSetting("payments").catch(() => null),
  ]);
  const m = mastery.map((x) => ({ name: x.topic.name, correct: x.correct, total: x.total, confidence: x.confidence }));
  const dueErrors = cards.filter((c) => !c.mastered && c.nextReviewAt <= now).length;
  const hasDiagnostic = sessions.some((s) => s.mode === "DIAGNOSTIC");
  const last = sessions[0];
  const pct = (s: { score: number | null; total: number | null }) => (s.total ? Math.round(((s.score ?? 0) / s.total) * 100) : 0);
  // Bugungi vazifalar: avval TOIFA rejasidagi bandlar (bajarilmaganlari), keyin natijalardan kelib chiqqan tavsiyalar (takrorlanmasdan).
  const fromPlan = planToday.filter((p) => !p.doneAt).map((p) => ({ id: `plan-${p.id}`, title: p.title, hint: "Tayyorgarlik rejangiz bo'yicha", href: p.href ?? "/toifa/reja?view=kunlik" }));
  const advice = buildTasks({ hasDiagnostic, dueErrors, mastery: m, hasExamDate: !!profile?.examDate, hasPlan: planToday.length + planFuture > 0 });
  const seen = new Set(fromPlan.map((t) => t.href));
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
    tasks: [...fromPlan, ...advice.filter((t) => !seen.has(t.href))].slice(0, 7),
    planToday: { total: planToday.length, done: planToday.filter((p) => p.doneAt).length },
    seminars: seminars.seminars.slice(0, 3).map((s) => ({ id: s.id, title: s.title, startsAt: s.startsAt, place: s.place })),
    // Davom ettirilmagan mashq (USTOZ AI), obuna va kurslar holati (MARKET), admin e'lonlari: hammasi bazadagi haqiqiy ma'lumot.
    resume,
    account: { plan: ent?.plan ?? "FREE", endsAt: sub?.endsAt ?? null, courses, pending, paymentsOn: !!pay && pay.mode !== "off" },
    announcements: visibleAnnouncements(ann.items, uzToday(now)).map((a) => ({ id: a.id, title: a.title, text: a.text, href: a.href })),
  };
});
