import { requireUser } from "@/server/auth";
import { handle } from "@/server/http";
import { classDetail, deleteClass, updateClass } from "@/server/sinf";
import { classInput } from "@/server/sinfvalid";
export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

export const GET = (_r: Request, { params }: Ctx) => handle(async () => classDetail((await requireUser()).id, (await params).id));
export const PUT = (req: Request, { params }: Ctx) => handle(async () => updateClass((await requireUser()).id, (await params).id, classInput.parse(await req.json())));
export const DELETE = (_r: Request, { params }: Ctx) => handle(async () => deleteClass((await requireUser()).id, (await params).id));
