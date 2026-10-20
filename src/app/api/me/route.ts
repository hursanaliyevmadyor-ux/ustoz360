import { currentUser } from "@/server/auth";
import { db } from "@/server/db";
import { avatarFor } from "@/server/ranking/data";
import { getEntitlements } from "@/server/entitlements";
import { handle } from "@/server/http";
import { isOnboarded } from "@/server/onboarding";
export const dynamic = "force-dynamic";
export const GET = () => handle(async () => {
  const u = await currentUser();
  if (!u) return { user: null };
  const [onboarded, ent, prof] = await Promise.all([
    isOnboarded(u.id).catch(() => true), // tekshiruv xato bersa foydalanuvchini to'smaymiz
    getEntitlements(u.id).catch(() => null),
    db.profile.findUnique({ where: { userId: u.id }, select: { nickname: true, avatarPath: true } }).catch(() => null), // ustunlar hali bo'lmasa (SQL qo'llanmagan) sayt ishlayveradi
  ]);
  return { user: { id: u.id, name: u.name, email: u.email, roles: u.roles.map((r) => r.role), onboarded, plan: ent?.plan ?? "FREE", nickname: prof?.nickname ?? null, avatar: avatarFor(prof?.avatarPath, u.id, "me") } };
});
