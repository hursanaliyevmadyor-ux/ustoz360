import { ApiError, hasRole } from "./auth";
import { audit } from "./audit";
import { db } from "./db";
import { COURSE_STATUSES, EDITABLE, nextStatusAfterEdit, type CourseInput } from "./marketvalid";
import { notify } from "./notify";

/** MARKET: katalog faqat tasdiqlangan (APPROVED) kurslarni ko'rsatadi. Muallif kurs yaratadi, admin tasdiqlaydi. */

const pub = (c: { id: string; title: string; description: string; subject: string; kind: string; priceUzs: number; lessonCount: number; author: { name: string | null } }, owned: boolean) => ({
  id: c.id, title: c.title, description: c.description, subject: c.subject, kind: c.kind, priceUzs: c.priceUzs, lessonCount: c.lessonCount,
  author: c.author.name ?? "Muallif", owned,
});

export async function catalog(userId: string | null, q: { q?: string; subject?: string; sort?: "new" | "asc" | "desc" }) {
  const rows = await db.course.findMany({
    where: { status: "APPROVED", ...(q.subject && { subject: q.subject }), ...(q.q && { title: { contains: q.q, mode: "insensitive" as const } }) },
    orderBy: q.sort === "asc" ? { priceUzs: "asc" } : q.sort === "desc" ? { priceUzs: "desc" } : { approvedAt: "desc" },
    take: 100, include: { author: { select: { name: true } } },
  });
  const [owned, subjects] = await Promise.all([
    userId ? db.courseAccess.findMany({ where: { userId, courseId: { in: rows.map((r) => r.id) } }, select: { courseId: true } }) : Promise.resolve([]),
    db.course.findMany({ where: { status: "APPROVED" }, distinct: ["subject"], select: { subject: true } }),
  ]);
  const own = new Set(owned.map((o) => o.courseId));
  return { courses: rows.map((r) => pub(r, own.has(r.id))), subjects: subjects.map((s) => s.subject).sort() };
}

// ---------- muallif ----------

export function requireAuthor(user: { roles: { role: string }[] }) {
  if (!hasRole(user, "COURSE_AUTHOR", "ADMIN", "SUPERADMIN")) throw new ApiError(403, "Muallif kabineti uchun muallif roli kerak. Rol so'rang.", "not_author");
}

const authorView = (c: { id: string; title: string; description: string; subject: string; kind: string; priceUzs: number; lessonCount: number; accessUrl: string | null; status: string; rejectReason: string | null; updatedAt: Date; _count?: { access: number } }) => ({
  id: c.id, title: c.title, description: c.description, subject: c.subject, kind: c.kind, priceUzs: c.priceUzs, lessonCount: c.lessonCount, accessUrl: c.accessUrl,
  status: c.status, rejectReason: c.rejectReason, updatedAt: c.updatedAt.toISOString(), sales: c._count?.access ?? 0,
});

export async function authorCourses(userId: string) {
  const rows = await db.course.findMany({ where: { authorId: userId }, orderBy: { updatedAt: "desc" }, include: { _count: { select: { access: true } } } });
  const paid = await db.payment.aggregate({ where: { status: "PAID", course: { authorId: userId } }, _sum: { amount: true }, _count: true });
  return { courses: rows.map(authorView), stats: { courses: rows.length, sales: paid._count, revenue: paid._sum.amount ?? 0 } };
}

export async function saveCourse(userId: string, input: CourseInput, id?: string) {
  if (!id) {
    const c = await db.course.create({ data: { authorId: userId, ...input, accessUrl: input.accessUrl ?? null } });
    return { id: c.id };
  }
  const cur = await db.course.findFirst({ where: { id, authorId: userId }, select: { id: true, status: true } });
  if (!cur) throw new ApiError(404, "Kurs topilmadi.");
  if (!EDITABLE.has(cur.status)) throw new ApiError(409, "Arxivlangan kursni tahrirlab bo'lmaydi.");
  await db.course.update({ where: { id }, data: { ...input, accessUrl: input.accessUrl ?? null, status: nextStatusAfterEdit(cur.status), rejectReason: null } });
  return { id };
}

export async function submitCourse(userId: string, id: string) {
  const c = await db.course.findFirst({ where: { id, authorId: userId } });
  if (!c) throw new ApiError(404, "Kurs topilmadi.");
  if (c.status !== "DRAFT" && c.status !== "REJECTED") throw new ApiError(409, "Kurs allaqachon tekshiruvda yoki tasdiqlangan.");
  if (c.priceUzs > 0 && !c.accessUrl) throw new ApiError(400, "Pullik kurs uchun sotib olganlarga ko'rsatiladigan havolani kiriting.");
  await db.course.update({ where: { id }, data: { status: "REVIEW", rejectReason: null } });
  await audit(userId, "market.submit", { courseId: id });
  const admins = await db.userRole.findMany({ where: { role: { in: ["ADMIN", "SUPERADMIN"] } }, select: { userId: true }, distinct: ["userId"] });
  await Promise.all(admins.map((a) => notify(a.userId, { kind: "market", title: "Kurs tekshiruvga yuborildi", text: `«${c.title}» tasdiqlashni kutmoqda.`, href: "/admin/kurslar" })));
  return { ok: true as const };
}

export async function deleteDraftCourse(userId: string, id: string) {
  const c = await db.course.findFirst({ where: { id, authorId: userId }, select: { status: true, _count: { select: { access: true, payments: true } } } });
  if (!c) throw new ApiError(404, "Kurs topilmadi.");
  if (c._count.access || c._count.payments) throw new ApiError(409, "Sotuvi bor kursni o'chirib bo'lmaydi, uni arxivlang.");
  await db.course.delete({ where: { id } });
  return { ok: true as const };
}

/** Foydalanuvchi muallif bo'lishni so'raydi: adminlarga xabar boradi, rolni admin beradi. */
export async function requestAuthorRole(userId: string, name: string | null) {
  const admins = await db.userRole.findMany({ where: { role: { in: ["ADMIN", "SUPERADMIN"] } }, select: { userId: true }, distinct: ["userId"] });
  await Promise.all(admins.map((a) => notify(a.userId, { kind: "market", title: "Muallif roli so'raldi", text: `${name ?? "Foydalanuvchi"} muallif bo'lishni so'rayapti.`, href: "/admin/foydalanuvchilar" })));
  await audit(userId, "market.author_request");
  return { ok: true as const, notified: admins.length };
}

// ---------- admin ----------

export async function adminCourses(status?: string) {
  if (status && !(COURSE_STATUSES as readonly string[]).includes(status)) throw new ApiError(400, "Holat noto'g'ri.");
  const rows = await db.course.findMany({ where: status ? { status } : {}, orderBy: [{ updatedAt: "desc" }], take: 200, include: { author: { select: { name: true, email: true } }, _count: { select: { access: true } } } });
  return { courses: rows.map((c) => ({ ...authorView(c), author: c.author.name ?? c.author.email ?? "—" })) };
}

export async function reviewCourse(adminId: string, id: string, r: { action: "approve" } | { action: "reject"; reason: string } | { action: "archive" }) {
  const c = await db.course.findUnique({ where: { id } });
  if (!c) throw new ApiError(404, "Kurs topilmadi.");
  if (r.action === "approve") {
    if (c.status !== "REVIEW") throw new ApiError(409, "Faqat tekshiruvdagi kursni tasdiqlash mumkin.");
    await db.course.update({ where: { id }, data: { status: "APPROVED", approvedAt: new Date(), rejectReason: null } });
    await notify(c.authorId, { kind: "market", title: "Kurs tasdiqlandi", text: `«${c.title}» katalogda ko'rinadi.`, href: "/market/muallif" });
  } else if (r.action === "reject") {
    if (c.status !== "REVIEW") throw new ApiError(409, "Faqat tekshiruvdagi kursni rad etish mumkin.");
    await db.course.update({ where: { id }, data: { status: "REJECTED", rejectReason: r.reason } });
    await notify(c.authorId, { kind: "market", title: "Kurs rad etildi", text: `«${c.title}»: ${r.reason}`, href: "/market/muallif" });
  } else {
    await db.course.update({ where: { id }, data: { status: "ARCHIVED" } });
  }
  await audit(adminId, `market.${r.action}`, { courseId: id });
  return { ok: true as const };
}
