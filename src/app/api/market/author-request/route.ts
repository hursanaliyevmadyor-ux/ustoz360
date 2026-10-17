import { requireUser } from "@/server/auth";
import { handle } from "@/server/http";
import { requestAuthorRole } from "@/server/market";
export const dynamic = "force-dynamic";

export const POST = () => handle(async () => { const u = await requireUser(); return requestAuthorRole(u.id, u.name); });
