import { requireUser } from "@/server/auth";
import { handle } from "@/server/http";
import { deleteAssessment, saveAssessment } from "@/server/sinf";
import { assessmentInput } from "@/server/sinfvalid";
export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string; aid: string }> };

export const PUT = (req: Request, { params }: Ctx) => handle(async () => { const p = await params; return saveAssessment((await requireUser()).id, p.id, assessmentInput.parse(await req.json()), p.aid); });
export const DELETE = (_r: Request, { params }: Ctx) => handle(async () => { const p = await params; return deleteAssessment((await requireUser()).id, p.id, p.aid); });
