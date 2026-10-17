import { requireAdmin } from "@/server/auth";
import { handle } from "@/server/http";
import { adminLibrary } from "@/server/library";
export const dynamic = "force-dynamic";

export const GET = (req: Request) => handle(async () => { await requireAdmin(); return adminLibrary(new URL(req.url).searchParams.get("visibility") ?? undefined); });
