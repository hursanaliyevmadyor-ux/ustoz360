import { requireAdmin } from "@/server/auth";
import { handle } from "@/server/http";
export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };import { deleteExam, getAdminExam, updateExam } from "@/server/admin";
import { examInput } from "@/server/adminvalid";

export const GET = (_r: Request, { params }: Ctx) => handle(async () => { await requireAdmin(); return getAdminExam((await params).id); });
export const PUT = (req: Request, { params }: Ctx) => handle(async () => { await requireAdmin(); return updateExam((await params).id, examInput.parse(await req.json())); });
export const DELETE = (_r: Request, { params }: Ctx) => handle(async () => { await requireAdmin(); return deleteExam((await params).id); });