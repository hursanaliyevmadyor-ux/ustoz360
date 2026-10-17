import { requireUser } from "@/server/auth";
import { handle } from "@/server/http";
import { deletePlanItem, patchPlanItem } from "@/server/toifa";
import { planItemPatch } from "@/server/toifavalid";
export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

export const PATCH = (req: Request, { params }: Ctx) => handle(async () => patchPlanItem((await requireUser()).id, (await params).id, planItemPatch.parse(await req.json())));
export const DELETE = (_r: Request, { params }: Ctx) => handle(async () => deletePlanItem((await requireUser()).id, (await params).id));
