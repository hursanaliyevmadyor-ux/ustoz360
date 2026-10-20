import { requireAdmin } from "@/server/auth";
import { handle } from "@/server/http";
import { recalculate } from "@/server/ranking/admin";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export const POST = () => handle(async () => recalculate(await requireAdmin()));
