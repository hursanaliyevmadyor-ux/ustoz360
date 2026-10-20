import { requireUser } from "@/server/auth";
import { handle } from "@/server/http";
import { deleteSession, getSession } from "@/server/import/service";
export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

export const GET = (_r: Request, { params }: Ctx) => handle(async () => getSession(await requireUser(), (await params).id));
export const DELETE = (_r: Request, { params }: Ctx) => handle(async () => deleteSession(await requireUser(), (await params).id));
