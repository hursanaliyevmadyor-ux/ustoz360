import { requireUser } from "@/server/auth";
import { handle } from "@/server/http";
import { saveAssessment } from "@/server/sinf";
import { assessmentInput } from "@/server/sinfvalid";
export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

export const POST = (req: Request, { params }: Ctx) => handle(async () => saveAssessment((await requireUser()).id, (await params).id, assessmentInput.parse(await req.json())));
