import { requireUser } from "@/server/auth";
import { handle } from "@/server/http";
import { deleteChat, getChat } from "@/server/ai/chats";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export const GET = (_req: Request, { params }: Ctx) => handle(async () => getChat((await requireUser()).id, (await params).id));
export const DELETE = (_req: Request, { params }: Ctx) => handle(async () => deleteChat((await requireUser()).id, (await params).id));
