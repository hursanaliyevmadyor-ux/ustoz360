import { requireAdmin } from "@/server/auth";
import { handle } from "@/server/http";
export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };import { addQuestion } from "@/server/admin";
import { questionInput } from "@/server/adminvalid";

export const POST = (req: Request, { params }: Ctx) => handle(async () => { await requireAdmin(); return addQuestion((await params).id, questionInput.parse(await req.json())); });