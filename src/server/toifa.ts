import { ApiError } from "./auth";
import { audit } from "./audit";
import { db } from "./db";
import { addDays, buildPlan, DEFAULT_CHECKLIST, daysBetween, roadmap, splitMastery, uzToday } from "./planlogic";
import { listPublicSeminars } from "./admin";
import type { OfficialInput } from "./toifavalid";

/** TOIFA NAVIGATOR: maqsad profildan, reja va cheklist bazada (Supabase), rasmiy ma'lumot admin kiritadi. */
const d = (s: string) => new Date(s + "T00:00:00Z");
const iso = (x: Date) => x.toISOString().slice(0, 10);

type ItemRow = { id: string; date: Date; title: string; kind: string; href: string | null; source: string; doneAt: Date | null; position: number };
const itemView = (p: ItemRow) => ({ id: p.id, date: iso(p.date), title: p.title, kind: p.kind, href: p.href, source: p.source, done: !!p.doneAt, position: p.position });

export async function toifaState(userId: string) {
  const today = uzToday();
  const from = d(addDays(today, -35)), to = d(addDays(today, 95));
  const [profile, items, checklist, diag, sim, mastery, official, seminars] = await Promise.all([
    db.profile.findUnique({ where: { userId }, select: { targetExam: true, examDate: true, dailyMinutes: true } }),
    db.planItem.findMany({ where: { userId, date: { gte: from, lte: to } }, orderBy: [{ date: "asc" }, { position: "asc" }, { createdAt: "asc" }] }),
    db.checklistItem.findMany({ where: { userId }, orderBy: [{ position: "asc" }, { createdAt: "asc" }] }),
    db.testSession.count({ where: { userId, mode: "DIAGNOSTIC", status: "SUBMITTED" } }),
    db.examAttempt.count({ where: { userId, submittedAt: { not: null } } }),
    db.topicMastery.findMany({ where: { userId }, include: { topic: { select: { name: true } } } }),
    db.officialInfo.findMany({ where: { active: true }, orderBy: [{ date: "asc" }, { createdAt: "desc" }] }),
    listPublicSeminars().catch(() => ({ seminars: [] })),
  ]);
  const m = mastery.map((x) => ({ topicId: x.topicId, name: x.topic.name, correct: x.correct, total: x.total, confidence: x.confidence }));
  const { weak } = splitMastery(m);
  const examDate = profile?.examDate ? iso(profile.examDate) : null;
  const daysLeft = examDate ? daysBetween(today, examDate) : null;
  const exam = profile?.targetExam ?? null;
  return {
    today,
    goal: { targetExam: exam, examDate, dailyMinutes: profile?.dailyMinutes ?? null, daysLeft: daysLeft !== null && daysLeft >= 0 ? daysLeft : null },
    roadmap: roadmap({ hasGoal: !!exam && !!examDate, hasDiagnostic: diag > 0, weakCount: weak.length, hasMastery: m.some((x) => x.total >= 3), checklistTotal: checklist.length, checklistDone: checklist.filter((c) => c.doneAt).length, hasSimulation: sim > 0 }),
    plan: items.map(itemView),
    checklist: checklist.map((c) => ({ id: c.id, label: c.label, note: c.note, done: !!c.doneAt })),
    // Foydalanuvchining imtihon turi yoki umumiy (turi ko'rsatilmagan) ma'lumotlar. `verified` belgisi bo'lmasa "tekshirilmagan" deb ko'rsatiladi.
    official: official.filter((o) => !o.exam || !exam || o.exam === exam).map((o) => ({
      id: o.id, kind: o.kind, exam: o.exam, title: o.title, url: o.url, date: o.date ? iso(o.date) : null, note: o.note, sourceName: o.sourceName, verified: o.verified, verifiedAt: o.verifiedAt?.toISOString() ?? null,
    })),
    seminars: seminars.seminars.slice(0, 20).map((s) => ({ id: s.id, title: s.title, startsAt: s.startsAt })),
  };
}

/** Qoidalar bilan rejani qayta tuzadi: faqat bugundan keyingi, bajarilmagan AVTOMATIK bandlar almashadi. Qo'lda qo'shilganlar va bajarilganlar saqlanadi. */
export async function generatePlan(userId: string) {
  const today = uzToday();
  const [profile, diag, mastery, cards] = await Promise.all([
    db.profile.findUnique({ where: { userId }, select: { examDate: true, dailyMinutes: true } }),
    db.testSession.count({ where: { userId, mode: "DIAGNOSTIC", status: "SUBMITTED" } }),
    db.topicMastery.findMany({ where: { userId }, include: { topic: { select: { name: true } } } }),
    db.errorCard.findMany({ where: { userId, mastered: false, nextReviewAt: { lte: new Date() } }, select: { id: true } }),
  ]);
  const { weak, thin } = splitMastery(mastery.map((x) => ({ topicId: x.topicId, name: x.topic.name, correct: x.correct, total: x.total, confidence: x.confidence })));
  const draft = buildPlan({ today, examDate: profile?.examDate ? iso(profile.examDate) : null, dailyMinutes: profile?.dailyMinutes ?? null, hasDiagnostic: diag > 0, dueErrors: cards.length, weak, thin });
  await db.$transaction(async (tx) => {
    await tx.planItem.deleteMany({ where: { userId, source: "AUTO", doneAt: null, date: { gte: d(today) } } });
    await tx.planItem.createMany({ data: draft.map((x) => ({ userId, date: d(x.date), title: x.title, kind: x.kind, href: x.href ?? null, source: "AUTO", position: x.position })) });
  }, { maxWait: 15_000, timeout: 60_000 });
  await audit(userId, "toifa.plan_generate", { items: draft.length });
  return { created: draft.length, basis: { diagnostic: diag > 0, weak: weak.length, thin: thin.length, dueErrors: cards.length, examDate: profile?.examDate ? iso(profile.examDate) : null } };
}

export async function addPlanItem(userId: string, i: { date: string; title: string; kind: string }) {
  if ((await db.planItem.count({ where: { userId } })) >= 1000) throw new ApiError(409, "Reja bandlari juda ko'p: eskilarini o'chiring.");
  const last = await db.planItem.aggregate({ where: { userId, date: d(i.date) }, _max: { position: true } });
  return { id: (await db.planItem.create({ data: { userId, date: d(i.date), title: i.title, kind: i.kind, source: "MANUAL", position: (last._max.position ?? -1) + 1 } })).id };
}
export async function patchPlanItem(userId: string, id: string, p: { done?: boolean; title?: string; date?: string }) {
  const r = await db.planItem.updateMany({ where: { id, userId }, data: { ...(p.done !== undefined && { doneAt: p.done ? new Date() : null }), ...(p.title && { title: p.title }), ...(p.date && { date: d(p.date) }) } });
  if (!r.count) throw new ApiError(404, "Reja bandi topilmadi.");
  return { ok: true as const };
}
export async function deletePlanItem(userId: string, id: string) {
  const r = await db.planItem.deleteMany({ where: { id, userId } });
  if (!r.count) throw new ApiError(404, "Reja bandi topilmadi.");
  return { ok: true as const };
}

// ---------- cheklist ----------
export async function addChecklist(userId: string, i: { label: string; note?: string }) {
  if ((await db.checklistItem.count({ where: { userId } })) >= 100) throw new ApiError(409, "Cheklist bandlari juda ko'p.");
  const last = await db.checklistItem.aggregate({ where: { userId }, _max: { position: true } });
  return { id: (await db.checklistItem.create({ data: { userId, label: i.label, note: i.note ?? null, position: (last._max.position ?? -1) + 1 } })).id };
}
/** Umumiy tavsiya (rasmiy ro'yxat emas): faqat cheklist bo'sh bo'lganda qo'shiladi. */
export async function seedChecklist(userId: string) {
  if (await db.checklistItem.count({ where: { userId } })) throw new ApiError(409, "Cheklistda bandlar bor.");
  await db.checklistItem.createMany({ data: DEFAULT_CHECKLIST.map((label, position) => ({ userId, label, position })) });
  return { created: DEFAULT_CHECKLIST.length };
}
export async function patchChecklist(userId: string, id: string, p: { done?: boolean; label?: string; note?: string }) {
  const r = await db.checklistItem.updateMany({ where: { id, userId }, data: { ...(p.done !== undefined && { doneAt: p.done ? new Date() : null }), ...(p.label && { label: p.label }), ...(p.note !== undefined && { note: p.note || null }) } });
  if (!r.count) throw new ApiError(404, "Band topilmadi.");
  return { ok: true as const };
}
export async function deleteChecklist(userId: string, id: string) {
  const r = await db.checklistItem.deleteMany({ where: { id, userId } });
  if (!r.count) throw new ApiError(404, "Band topilmadi.");
  return { ok: true as const };
}

// ---------- rasmiy ma'lumotlar (admin) ----------
const officialData = (i: OfficialInput, prev?: { verified: boolean; verifiedAt: Date | null }) => ({
  kind: i.kind, exam: i.exam ?? null, title: i.title, url: i.url ?? null, date: i.date ? d(i.date) : null, note: i.note ?? null, sourceName: i.sourceName ?? null, active: i.active,
  verified: i.verified,
  // Tekshirilgan vaqti: yangi belgilanganda hozirgi vaqt, avvaldan tekshirilgan bo'lsa o'zgarmaydi.
  verifiedAt: i.verified ? (prev?.verified ? prev.verifiedAt ?? new Date() : new Date()) : null,
});
export async function listOfficialAdmin() {
  const rows = await db.officialInfo.findMany({ orderBy: [{ updatedAt: "desc" }] });
  return { items: rows.map((o) => ({ id: o.id, kind: o.kind, exam: o.exam, title: o.title, url: o.url, date: o.date ? iso(o.date) : null, note: o.note, sourceName: o.sourceName, verified: o.verified, verifiedAt: o.verifiedAt?.toISOString() ?? null, active: o.active })) };
}
export async function saveOfficial(adminId: string, i: OfficialInput, id?: string) {
  const prev = id ? await db.officialInfo.findUnique({ where: { id }, select: { verified: true, verifiedAt: true } }) : null;
  if (id && !prev) throw new ApiError(404, "Yozuv topilmadi.");
  const data = officialData(i, prev ?? undefined);
  const r =id ? await db.officialInfo.update({ where: { id }, data }) : await db.officialInfo.create({ data });
  await audit(adminId, "admin.official_save", { id: r.id, verified: i.verified });
  return { id: r.id };
}
export async function deleteOfficial(adminId: string, id: string) {
  const r = await db.officialInfo.deleteMany({ where: { id } });
  if (!r.count) throw new ApiError(404, "Yozuv topilmadi.");
  await audit(adminId, "admin.official_delete", { id });
  return { ok: true as const };
}
