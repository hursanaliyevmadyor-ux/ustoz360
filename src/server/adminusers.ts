import { z } from "zod";
import { activePlan } from "./entitlementlogic";
import { ApiError } from "./auth";
import { audit } from "./audit";
import { db } from "./db";
import { notify } from "./notify";
import { PLANS, isPlanKey } from "../lib/plans";

import { ROLE_KEYS, ROLE_LABEL, type Role } from "../lib/roles";

export const userUpdateInput = z.object({
  roles: z.array(z.enum(ROLE_KEYS)).max(6).optional(),
  blocked: z.boolean().optional(),
  /** Admin qo'lda tarif beradi (FREE: faol obunalarni to'xtatadi). */
  plan: z.string().optional(),
  planDays: z.number().int().min(1).max(366).optional(),
});
export type UserUpdate = z.infer<typeof userUpdateInput>;

/** Rol o'zgartirish qoidalari (toza funksiya, test qilinadi). Xato bo'lsa matn qaytaradi, bo'lmasa null. */
export function roleChangeError(opts: { actorId: string; actorRoles: string[]; targetId: string; before: string[]; after: string[]; adminsLeft: number }): string | null {
  const touched = (r: string) => opts.before.includes(r) !== opts.after.includes(r);
  if (opts.actorId === opts.targetId) return "O'z rollaringizni o'zgartirib bo'lmaydi.";
  if (touched("SUPERADMIN") && !opts.actorRoles.includes("SUPERADMIN")) return "Bosh administrator rolini faqat bosh administrator o'zgartira oladi.";
  const wasAdmin = opts.before.some((r) => r === "ADMIN" || r === "SUPERADMIN");
  const isAdmin = opts.after.some((r) => r === "ADMIN" || r === "SUPERADMIN");
  if (wasAdmin && !isAdmin && opts.adminsLeft <= 1) return "Oxirgi administratorni olib tashlab bo'lmaydi.";
  return null;
}

export async function listUsers(q: { q?: string; role?: string; page?: number }) {
  const take = 25, skip = Math.max(0, ((q.page ?? 1) - 1) * take);
  const term = q.q?.trim();
  const where = {
    ...(term && { OR: [{ name: { contains: term, mode: "insensitive" as const } }, { email: { contains: term, mode: "insensitive" as const } }, { phone: { contains: term } }] }),
    ...(q.role && (ROLE_KEYS as readonly string[]).includes(q.role) && { roles: { some: { role: q.role as Role } } }),
  };
  const [total, rows] = await Promise.all([
    db.user.count({ where }),
    db.user.findMany({ where, orderBy: { createdAt: "desc" }, take, skip, select: { id: true, name: true, email: true, phone: true, telegramUsername: true, createdAt: true, deletedAt: true, roles: { select: { role: true } }, profile: { select: { onboardedAt: true } } } }),
  ]);
  const subs = await db.subscription.findMany({ where: { userId: { in: rows.map((r) => r.id) }, status: "ACTIVE" }, select: { userId: true, planKey: true, status: true, startsAt: true, endsAt: true } });
  return {
    total, page: q.page ?? 1, pages: Math.max(1, Math.ceil(total / take)),
    users: rows.map((u) => ({
      id: u.id, name: u.name, email: u.email, phone: u.phone, telegram: u.telegramUsername, createdAt: u.createdAt.toISOString(), blocked: !!u.deletedAt,
      roles: u.roles.map((r) => r.role), plan: activePlan(subs.filter((s) => s.userId === u.id)), onboarded: !!u.profile?.onboardedAt,
    })),
  };
}

export async function updateUser(actor: { id: string; roles: { role: string }[] }, id: string, input: UserUpdate) {
  const target = await db.user.findUnique({ where: { id }, include: { roles: true } });
  if (!target) throw new ApiError(404, "Foydalanuvchi topilmadi.");
  const actorRoles = actor.roles.map((r) => r.role);

  if (input.roles) {
    const after = Array.from(new Set<string>(["TEACHER", ...input.roles]));
    const before = target.roles.map((r) => r.role as string);
    const adminsLeft = await db.userRole.count({ where: { role: { in: ["ADMIN", "SUPERADMIN"] } } });
    const err = roleChangeError({ actorId: actor.id, actorRoles, targetId: id, before, after, adminsLeft });
    if (err) throw new ApiError(400, err);
    const add = after.filter((r) => !before.includes(r)), remove = before.filter((r) => !after.includes(r));
    if (add.length) await db.userRole.createMany({ data: add.map((role) => ({ userId: id, role: role as Role })), skipDuplicates: true });
    if (remove.length) await db.userRole.deleteMany({ where: { userId: id, role: { in: remove as Role[] } } });
    if (add.length || remove.length) {
      await audit(actor.id, "admin.user_roles", { target: id, add, remove });
      if (add.length) await notify(id, { kind: "role", title: "Rolingiz yangilandi", text: `Sizga ${add.map((r) => ROLE_LABEL[r as Role] ?? r).join(", ")} roli berildi.`, href: "/dashboard" });
    }
  }
  if (input.blocked !== undefined) {
    if (id === actor.id) throw new ApiError(400, "O'zingizni bloklab bo'lmaydi.");
    if (input.blocked && target.roles.some((r) => r.role === "SUPERADMIN") && !actorRoles.includes("SUPERADMIN")) throw new ApiError(400, "Bosh administratorni bloklab bo'lmaydi.");
    await db.user.update({ where: { id }, data: { deletedAt: input.blocked ? new Date() : null } });
    if (input.blocked) await db.authSession.deleteMany({ where: { userId: id } });
    await audit(actor.id, input.blocked ? "admin.user_block" : "admin.user_unblock", { target: id });
  }
  if (input.plan !== undefined) {
    if (!isPlanKey(input.plan)) throw new ApiError(400, "Tarif noto'g'ri.");
    await db.subscription.updateMany({ where: { userId: id, status: "ACTIVE" }, data: { status: "CANCELED", endsAt: new Date() } });
    if (input.plan !== "FREE") {
      await db.subscription.create({ data: { userId: id, planKey: input.plan, source: "MANUAL", endsAt: new Date(Date.now() + (input.planDays ?? 30) * 86_400_000) } });
      await notify(id, { kind: "plan", title: "Tarif faollashtirildi", text: `${PLANS[input.plan].name} tarifi ${input.planDays ?? 30} kunga berildi.`, href: "/obuna" });
    }
    await audit(actor.id, "admin.user_plan", { target: id, plan: input.plan });
  }
  return { ok: true as const };
}

export async function auditTrail(take = 100) {
  const rows = await db.auditLog.findMany({ where: { OR: [{ action: { startsWith: "admin." } }, { action: { startsWith: "payment." } }, { action: { startsWith: "market." } }] }, orderBy: { createdAt: "desc" }, take: Math.min(take, 300), include: { user: { select: { name: true, email: true } } } });
  return { items: rows.map((r) => ({ id: r.id, action: r.action, actor: r.user?.name ?? r.user?.email ?? "—", meta: r.meta, createdAt: r.createdAt.toISOString() })) };
}
