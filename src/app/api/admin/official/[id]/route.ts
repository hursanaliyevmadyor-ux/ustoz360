import { requireAdmin } from "@/server/auth";
import { handle } from "@/server/http";
import { deleteOfficial, saveOfficial } from "@/server/toifa";
import { officialInput } from "@/server/toifavalid";
export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

export const PUT = (req: Request, { params }: Ctx) => handle(async () => { const a = await requireAdmin(); return saveOfficial(a.id, officialInput.parse(await req.json()), (await params).id); });
export const DELETE = (_r: Request, { params }: Ctx) => handle(async () => { const a = await requireAdmin(); return deleteOfficial(a.id, (await params).id); });
