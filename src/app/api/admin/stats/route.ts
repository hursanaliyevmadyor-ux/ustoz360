import { requireAdmin } from "@/server/auth";
import { adminStats } from "@/server/adminstats";
import { handle } from "@/server/http";
export const dynamic = "force-dynamic";

export const GET = () => handle(async () => { await requireAdmin(); return adminStats(); });
