import { requireAdmin } from "@/server/auth";
import { handle } from "@/server/http";
import { adminCourses } from "@/server/market";
export const dynamic = "force-dynamic";

export const GET = (req: Request) => handle(async () => { await requireAdmin(); return adminCourses(new URL(req.url).searchParams.get("status") ?? undefined); });
