import { requireUser } from "@/server/auth";
import { handle } from "@/server/http";
import { deleteCollection, getCollection, renameSchema, updateCollection } from "@/server/import/collections";
export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

export const GET = (_r: Request, { params }: Ctx) => handle(async () => getCollection(await requireUser(), (await params).id));
export const PATCH = (req: Request, { params }: Ctx) => handle(async () => updateCollection(await requireUser(), (await params).id, renameSchema.parse(await req.json())));
export const DELETE = (_r: Request, { params }: Ctx) => handle(async () => deleteCollection(await requireUser(), (await params).id));
