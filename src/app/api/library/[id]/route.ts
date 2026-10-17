import { requireUser } from "@/server/auth";
import { handle } from "@/server/http";
import { deleteDoc } from "@/server/library";
export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

export const DELETE = (_r: Request, { params }: Ctx) => handle(async () => deleteDoc(await requireUser(), (await params).id));
