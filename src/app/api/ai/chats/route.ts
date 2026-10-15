import { requireUser } from "@/server/auth";
import { handle } from "@/server/http";
import { listChats } from "@/server/ai/chats";
export const dynamic = "force-dynamic";

export const GET = () => handle(async () => listChats((await requireUser()).id));
