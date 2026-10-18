import { listPublicSeminars } from "../admin";
import { db } from "../db";
import { getEntitlements } from "../entitlements";
import { addDays, daysBetween, uzToday } from "../planlogic";
import { activePractice } from "../practice";
import { getSetting } from "../settings";
import { visibleAnnouncements } from "../settingsdef";

/** Bosh sahifa va kunlik eslatma uchun bitta foydalanuvchining bugungi holati (faqat o'qish). */
export async function digest(userId: string, now = new Date()) {
  const today = uzToday(now);
  const day = new Date(today + "T00:00:00Z");
  const [profile, planToday, planFuture, dueErrors, resume, seminars, ent, ann] = await Promise.all([
    db.profile.findUnique({ where: { userId }, select: { targetExam: true, examDate: true } }),
    db.planItem.findMany({ where: { userId, date: day }, orderBy: [{ position: "asc" }, { createdAt: "asc" }], select: { id: true, title: true, doneAt: true } }),
    db.planItem.count({ where: { userId, date: { gt: day } } }),
    db.errorCard.count({ where: { userId, mastered: false, nextReviewAt: { lte: now }, question: { status: "APPROVED" } } }),
    activePractice(userId).catch(() => null),
    listPublicSeminars().then((r) => r.seminars).catch(() => []),
    getEntitlements(userId).catch(() => null),
    getSetting("announcements").catch(() => ({ items: [] as { id: string; title: string; text: string; href: string; active: boolean; until: string }[] })),
  ]);
  const exam = profile?.examDate ? profile.examDate.toISOString().slice(0, 10) : null;
  const left = exam ? daysBetween(today, exam) : null;
  return {
    today, tomorrow: addDays(today, 1),
    plan: planToday.map((p) => ({ id: p.id, title: p.title, done: !!p.doneAt })),
    planFuture, dueErrors, resume,
    seminars: seminars.slice(0, 3),
    daysLeft: left !== null && left >= 0 ? left : null,
    targetExam: profile?.targetExam ?? null,
    planName: ent?.planName ?? "FREE",
    announcements: visibleAnnouncements(ann.items, today).slice(0, 2),
  };
}

export type Digest = Awaited<ReturnType<typeof digest>>;
