import { db } from "./db";
import { toCsv } from "./csv";
import { ApiError } from "./auth";

/** Admin dashboard: faqat bazadagi haqiqiy sonlar (namunaviy raqam yo'q). Bo'sh bo'lsa 0. */
const dayStart = (daysAgo: number) => { const d = new Date(); d.setUTCHours(0, 0, 0, 0); d.setUTCDate(d.getUTCDate() - daysAgo); return d; };

async function perDay(table: "User" | "TestSession" | "AiRequest", days: number): Promise<number[]> {
  const since = dayStart(days - 1);
  const rows = await db.$queryRawUnsafe<{ d: Date; n: bigint }[]>(
    `select date_trunc('day', "${table === "TestSession" ? "startedAt" : "createdAt"}") as d, count(*)::bigint as n from "${table}" where "${table === "TestSession" ? "startedAt" : "createdAt"}" >= $1 group by 1`, since);
  const map = new Map(rows.map((r) => [new Date(r.d).toISOString().slice(0, 10), Number(r.n)]));
  return Array.from({ length: days }, (_, i) => map.get(dayStart(days - 1 - i).toISOString().slice(0, 10)) ?? 0);
}

export async function adminStats() {
  const week = dayStart(7), monthAgo = dayStart(30), today = dayStart(0);
  const [users, newUsers, roles, qByStatus, exams, attempts, sessions30, aiToday, ai30, courses, pays, subs, seminars, libDocs, reports, usersDaily, testsDaily] = await Promise.all([
    db.user.count({ where: { deletedAt: null } }),
    db.user.count({ where: { createdAt: { gte: week }, deletedAt: null } }),
    db.userRole.groupBy({ by: ["role"], _count: true }),
    db.question.groupBy({ by: ["status"], _count: true }),
    db.exam.count({ where: { active: true } }),
    db.examAttempt.count(),
    db.testSession.count({ where: { startedAt: { gte: monthAgo } } }),
    db.aiRequest.count({ where: { createdAt: { gte: today }, status: { not: "blocked" } } }),
    db.aiRequest.aggregate({ where: { createdAt: { gte: monthAgo } }, _count: true, _sum: { costMicro: true, inputTokens: true, outputTokens: true } }),
    db.course.groupBy({ by: ["status"], _count: true }),
    db.payment.groupBy({ by: ["status"], _count: true, _sum: { amount: true } }),
    db.subscription.groupBy({ by: ["planKey"], where: { status: "ACTIVE", OR: [{ endsAt: null }, { endsAt: { gt: new Date() } }] }, _count: true }),
    db.seminar.count({ where: { active: true, startsAt: { gte: new Date() } } }),
    db.libraryDoc.count(),
    db.questionReport.count(),
    perDay("User", 14),
    perDay("TestSession", 14),
  ]);
  const by = <T extends { _count: number | object }>(rows: (T & Record<string, unknown>)[], k: string) => Object.fromEntries(rows.map((r) => [String(r[k]), typeof r._count === "number" ? r._count : 0]));
  const paid = pays.find((p) => p.status === "PAID");
  return {
    users, newUsers, roles: by(roles, "role"),
    questions: by(qByStatus, "status"), questionReports: reports,
    exams, examAttempts: attempts, testSessions30: sessions30,
    ai: { today: aiToday, requests30: ai30._count, tokens30: (ai30._sum.inputTokens ?? 0) + (ai30._sum.outputTokens ?? 0), costUsd30: (ai30._sum.costMicro ?? 0) / 1_000_000 },
    courses: by(courses, "status"),
    payments: { byStatus: by(pays, "status"), paidCount: paid?._count ?? 0, paidAmount: paid?._sum.amount ?? 0 },
    subscriptions: by(subs, "planKey"),
    seminarsUpcoming: seminars, libraryDocs: libDocs,
    charts: { labels: Array.from({ length: 14 }, (_, i) => dayStart(13 - i).toISOString().slice(5, 10)), users: usersDaily, tests: testsDaily },
  };
}

/** AI sarfi: funksiya (feature) bo'yicha so'rovlar, xatolar, o'rtacha kechikish, tokenlar va taxminiy narx. Matn saqlanmaydi. */
export async function aiUsage(days = 7) {
  const since = new Date(Date.now() - days * 86_400_000);
  const rows = await db.aiRequest.groupBy({ by: ["feature", "status"], where: { createdAt: { gte: since } }, _count: true, _avg: { latencyMs: true }, _sum: { inputTokens: true, outputTokens: true, costMicro: true } });
  const by = new Map<string, { feature: string; calls: number; ok: number; errors: number; blocked: number; latencyMs: number | null; tokens: number; costUsd: number }>();
  for (const r of rows) {
    const e = by.get(r.feature) ?? { feature: r.feature, calls: 0, ok: 0, errors: 0, blocked: 0, latencyMs: null, tokens: 0, costUsd: 0 };
    e.calls += r._count; e.tokens += (r._sum.inputTokens ?? 0) + (r._sum.outputTokens ?? 0); e.costUsd += (r._sum.costMicro ?? 0) / 1_000_000;
    if (r.status === "ok" || r.status === "truncated") e.ok += r._count; else if (r.status === "blocked") e.blocked += r._count; else e.errors += r._count;
    if (r._avg.latencyMs != null) e.latencyMs = Math.round(e.latencyMs == null ? r._avg.latencyMs : (e.latencyMs + r._avg.latencyMs) / 2);
    by.set(r.feature, e);
  }
  return { days, features: Array.from(by.values()).sort((a, b) => b.calls - a.calls) };
}

// ---------- hisobotlar ----------

export const REPORT_TYPES = ["users", "payments", "ai", "tests", "courses"] as const;
export type ReportType = (typeof REPORT_TYPES)[number];

const REPORTS: Record<ReportType, { title: string; columns: { key: string; label: string }[]; rows: () => Promise<Record<string, unknown>[]> }> = {
  users: {
    title: "Foydalanuvchilar",
    columns: [{ key: "createdAt", label: "Ro'yxatdan o'tgan" }, { key: "name", label: "Ism" }, { key: "email", label: "Email" }, { key: "roles", label: "Rollar" }, { key: "blocked", label: "Bloklangan" }],
    rows: async () => (await db.user.findMany({ orderBy: { createdAt: "desc" }, take: 5000, select: { createdAt: true, name: true, email: true, deletedAt: true, roles: { select: { role: true } } } }))
      .map((u) => ({ createdAt: u.createdAt, name: u.name, email: u.email, roles: u.roles.map((r) => r.role).join(" "), blocked: u.deletedAt ? "ha" : "yo'q" })),
  },
  payments: {
    title: "To'lovlar",
    columns: [{ key: "createdAt", label: "Sana" }, { key: "reference", label: "Kod" }, { key: "user", label: "Foydalanuvchi" }, { key: "item", label: "Nima uchun" }, { key: "amount", label: "Summa (so'm)" }, { key: "provider", label: "Usul" }, { key: "status", label: "Holat" }],
    rows: async () => (await db.payment.findMany({ orderBy: { createdAt: "desc" }, take: 5000, include: { user: { select: { name: true, email: true } }, course: { select: { title: true } } } }))
      .map((p) => ({ createdAt: p.createdAt, reference: p.reference, user: p.user.name ?? p.user.email, item: p.course?.title ?? p.planKey, amount: p.amount, provider: p.provider, status: p.status })),
  },
  ai: {
    title: "AI so'rovlari",
    columns: [{ key: "createdAt", label: "Vaqt" }, { key: "feature", label: "Xususiyat" }, { key: "model", label: "Model" }, { key: "status", label: "Holat" }, { key: "inputTokens", label: "Kirish tokenlari" }, { key: "outputTokens", label: "Chiqish tokenlari" }, { key: "latencyMs", label: "Kechikish (ms)" }, { key: "costUsd", label: "Narx (USD)" }],
    rows: async () => (await db.aiRequest.findMany({ orderBy: { createdAt: "desc" }, take: 5000 })).map((r) => ({ ...r, costUsd: r.costMicro == null ? "" : (r.costMicro / 1_000_000).toFixed(4) })),
  },
  tests: {
    title: "Test faolligi",
    columns: [{ key: "startedAt", label: "Boshlangan" }, { key: "mode", label: "Rejim" }, { key: "status", label: "Holat" }, { key: "score", label: "Ball" }, { key: "total", label: "Savollar" }],
    rows: async () => db.testSession.findMany({ orderBy: { startedAt: "desc" }, take: 5000, select: { startedAt: true, mode: true, status: true, score: true, total: true } }),
  },
  courses: {
    title: "Kurslar",
    columns: [{ key: "createdAt", label: "Yaratilgan" }, { key: "title", label: "Nomi" }, { key: "author", label: "Muallif" }, { key: "priceUzs", label: "Narx (so'm)" }, { key: "status", label: "Holat" }, { key: "sales", label: "Sotuv" }],
    rows: async () => (await db.course.findMany({ orderBy: { createdAt: "desc" }, take: 5000, include: { author: { select: { name: true, email: true } }, _count: { select: { access: true } } } }))
      .map((c) => ({ createdAt: c.createdAt, title: c.title, author: c.author.name ?? c.author.email, priceUzs: c.priceUzs, status: c.status, sales: c._count.access })),
  },
};

export async function buildReport(type: string, format: "csv" | "json") {
  if (!(REPORT_TYPES as readonly string[]).includes(type)) throw new ApiError(400, "Hisobot turi noto'g'ri.");
  const def = REPORTS[type as ReportType];
  const rows = await def.rows();
  return format === "csv" ? { csv: toCsv(def.columns, rows), filename: `ustoz360-${type}.csv` } : { title: def.title, columns: def.columns, rows: rows.slice(0, 200), total: rows.length };
}
