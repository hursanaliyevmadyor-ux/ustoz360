import { requireAdmin } from "@/server/auth";
import { listUsers } from "@/server/adminusers";
import { handle } from "@/server/http";
export const dynamic = "force-dynamic";

export const GET = (req: Request) => handle(async () => {
  await requireAdmin();
  const sp = new URL(req.url).searchParams;
  return listUsers({ q: sp.get("q") ?? undefined, role: sp.get("role") ?? undefined, page: Math.max(1, Number(sp.get("page")) || 1) });
});
