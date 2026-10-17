import { requireUser } from "@/server/auth";
import { handle } from "@/server/http";
import { removeStudent, renameStudent } from "@/server/sinf";
import { aliasRename } from "@/server/sinfvalid";
export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string; sid: string }> };

export const PATCH = (req: Request, { params }: Ctx) => handle(async () => { const p = await params; return renameStudent((await requireUser()).id, p.id, p.sid, aliasRename.parse(await req.json()).alias); });
export const DELETE = (_r: Request, { params }: Ctx) => handle(async () => { const p = await params; return removeStudent((await requireUser()).id, p.id, p.sid); });
