import { requireAdmin } from "@/server/auth";
import { handle } from "@/server/http";
import { listSubmissions } from "@/server/import/adminreview";
export const dynamic = "force-dynamic";

export const GET = (req: Request) => handle(async () => { await requireAdmin(); return listSubmissions(new URL(req.url).searchParams.get("status") || undefined); });
