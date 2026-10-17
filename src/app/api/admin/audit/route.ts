import { requireAdmin } from "@/server/auth";
import { auditTrail } from "@/server/adminusers";
import { handle } from "@/server/http";
export const dynamic = "force-dynamic";

export const GET = () => handle(async () => { await requireAdmin(); return auditTrail(100); });
