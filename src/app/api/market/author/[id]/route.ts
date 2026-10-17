import { requireUser } from "@/server/auth";
import { handle } from "@/server/http";
import { deleteDraftCourse, requireAuthor, saveCourse } from "@/server/market";
import { courseInput } from "@/server/marketvalid";
export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

export const PUT = (req: Request, { params }: Ctx) => handle(async () => { const u = await requireUser(); requireAuthor(u); return saveCourse(u.id, courseInput.parse(await req.json()), (await params).id); });
export const DELETE = (_r: Request, { params }: Ctx) => handle(async () => { const u = await requireUser(); requireAuthor(u); return deleteDraftCourse(u.id, (await params).id); });
