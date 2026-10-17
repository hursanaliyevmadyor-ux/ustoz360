import { requireUser } from "@/server/auth";
import { handle } from "@/server/http";
import { requireAuthor, submitCourse } from "@/server/market";
export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

export const POST = (_r: Request, { params }: Ctx) => handle(async () => { const u = await requireUser(); requireAuthor(u); return submitCourse(u.id, (await params).id); });
