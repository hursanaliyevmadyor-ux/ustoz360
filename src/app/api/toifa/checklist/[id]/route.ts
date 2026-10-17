import { requireUser } from "@/server/auth";
import { handle } from "@/server/http";
import { deleteChecklist, patchChecklist } from "@/server/toifa";
import { checklistPatch } from "@/server/toifavalid";
export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

export const PATCH = (req: Request, { params }: Ctx) => handle(async () => patchChecklist((await requireUser()).id, (await params).id, checklistPatch.parse(await req.json())));
export const DELETE = (_r: Request, { params }: Ctx) => handle(async () => deleteChecklist((await requireUser()).id, (await params).id));
