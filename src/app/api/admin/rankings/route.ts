import { requireAdmin } from "@/server/auth";
import { handle } from "@/server/http";
import { overview } from "@/server/ranking/admin";
export const dynamic = "force-dynamic";

export const GET = (req: Request) => handle(async () => { await requireAdmin(); return overview(new URL(req.url).searchParams.get("q") ?? undefined); });
