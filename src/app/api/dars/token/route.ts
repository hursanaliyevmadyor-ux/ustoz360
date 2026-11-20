import { handle } from "@/server/http";
import { issueToken } from "@/server/voice";
import { tokenInput } from "@/server/voicelogic";
export const dynamic = "force-dynamic";

/** Xonaga kirish belgisi: hisobsiz (o'quvchi), lekin havola imzosi to'g'ri bo'lishi shart. */
export const POST = (req: Request) => handle(async () => issueToken(tokenInput.parse(await req.json())));
