import { requireAdmin } from "@/server/auth";
import { handle } from "@/server/http";
export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };import { deleteQuestion, updateQuestion } from "@/server/admin";
import { questionInput } from "@/server/adminvalid";

export const PUT = (req: Request, { params }: Ctx) => handle(async () => { await requireAdmin(); return updateQuestion((await params).id, questionInput.parse(await req.json())); });
export const DELETE = (_r: Request, { params }: Ctx) => handle(async () => { await requireAdmin(); return deleteQuestion((await params).id); });