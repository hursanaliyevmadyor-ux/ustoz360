import { requireAdmin } from "@/server/auth";
import { handle } from "@/server/http";
import { deleteTopic, renameTopic, setTopicObjectives } from "@/server/admin";
import { nameInput, objectivesInput } from "@/server/adminvalid";
export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

export const PUT = (req: Request, { params }: Ctx) => handle(async () => { await requireAdmin(); return renameTopic((await params).id, nameInput.parse(await req.json()).name); });
/** Mavzu o'quv maqsadlarini saqlaydi (mashq oldidan "Bu mavzuda nimalarni bilib olasiz?" sifatida ko'rsatiladi). */
export const PATCH = (req: Request, { params }: Ctx) => handle(async () => { await requireAdmin(); return setTopicObjectives((await params).id, objectivesInput.parse(await req.json()).objectives); });
export const DELETE = (_r: Request, { params }: Ctx) => handle(async () => { await requireAdmin(); return deleteTopic((await params).id); });
