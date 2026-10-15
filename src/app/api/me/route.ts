import { currentUser } from "@/server/auth";
import { handle } from "@/server/http";
import { isOnboarded } from "@/server/onboarding";
export const dynamic = "force-dynamic";
export const GET = () => handle(async () => {
  const u = await currentUser();
  if (!u) return { user: null };
  const onboarded = await isOnboarded(u.id).catch(() => true); // tekshiruv xato bersa foydalanuvchini to'smaymiz
  return { user: { id: u.id, name: u.name, email: u.email, roles: u.roles.map((r) => r.role), onboarded } };
});
