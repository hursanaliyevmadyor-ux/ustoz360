import { z } from "zod";
import { requireUser } from "@/server/auth";
import { handle } from "@/server/http";
import { removeFile, roleSchema, setFileRole } from "@/server/import/service";
export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string; fid: string }> };

const body = z.object({ role: roleSchema });
export const PATCH = (req: Request, { params }: Ctx) => handle(async () => { const p = await params; return setFileRole(await requireUser(), p.id, p.fid, body.parse(await req.json()).role); });
export const DELETE = (_r: Request, { params }: Ctx) => handle(async () => { const p = await params; return removeFile(await requireUser(), p.id, p.fid); });
