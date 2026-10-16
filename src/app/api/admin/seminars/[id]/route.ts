import { requireAdmin } from "@/server/auth";
import { handle } from "@/server/http";
export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };import { deleteSeminar, updateSeminar } from "@/server/admin";
import { seminarInput } from "@/server/adminvalid";

export const PUT = (req: Request, { params }: Ctx) => handle(async () => { await requireAdmin(); return updateSeminar((await params).id, seminarInput.parse(await req.json())); });
export const DELETE = (_r: Request, { params }: Ctx) => handle(async () => { await requireAdmin(); return deleteSeminar((await params).id); });