import { currentUser } from "@/server/auth";
import { handle } from "@/server/http";
export const dynamic = "force-dynamic";
export const GET = () => handle(async () => {
  const u = await currentUser();
  return { user: u ? { id: u.id, name: u.name, email: u.email, roles: u.roles.map((r) => r.role) } : null };
});
