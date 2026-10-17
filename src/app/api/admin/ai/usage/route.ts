import { requireAdmin } from "@/server/auth";
import { aiUsage } from "@/server/adminstats";
import { handle } from "@/server/http";
export const dynamic = "force-dynamic";

export const GET = () => handle(async () => { await requireAdmin(); return aiUsage(7); });
