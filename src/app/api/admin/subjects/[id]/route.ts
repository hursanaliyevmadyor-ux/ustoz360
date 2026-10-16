import { requireAdmin } from "@/server/auth";
import { handle } from "@/server/http";
export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };import { deleteSubject, renameSubject } from "@/server/admin";
import { nameInput } from "@/server/adminvalid";

export const PUT = (req: Request, { params }: Ctx) => handle(async () => { await requireAdmin(); return renameSubject((await params).id, nameInput.parse(await req.json()).name); });
export const DELETE = (_r: Request, { params }: Ctx) => handle(async () => { await requireAdmin(); return deleteSubject((await params).id); });