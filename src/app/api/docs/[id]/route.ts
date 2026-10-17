import { requireUser } from "@/server/auth";
import { deleteDoc, getDoc, saveDoc } from "@/server/docs";
import { docInput } from "@/server/docsvalid";
import { handle } from "@/server/http";
export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

export const GET = (_r: Request, { params }: Ctx) => handle(async () => getDoc((await requireUser()).id, (await params).id));
export const PUT = (req: Request, { params }: Ctx) => handle(async () => saveDoc((await requireUser()).id, docInput.parse(await req.json()), (await params).id));
export const DELETE = (_r: Request, { params }: Ctx) => handle(async () => deleteDoc((await requireUser()).id, (await params).id));
