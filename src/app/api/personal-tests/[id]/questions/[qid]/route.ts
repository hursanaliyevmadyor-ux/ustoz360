import { requireUser } from "@/server/auth";
import { handle } from "@/server/http";
import { questionPatch, removeQuestion, updateQuestion } from "@/server/import/collections";
export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string; qid: string }> };

export const PATCH = (req: Request, { params }: Ctx) => handle(async () => { const p = await params; return updateQuestion(await requireUser(), p.id, p.qid, questionPatch.parse(await req.json())); });
export const DELETE = (_r: Request, { params }: Ctx) => handle(async () => { const p = await params; return removeQuestion(await requireUser(), p.id, p.qid); });
