import { requireUser } from "@/server/auth";
import { handle } from "@/server/http";
import { toifaState } from "@/server/toifa";
export const dynamic = "force-dynamic";

export const GET = () => handle(async () => toifaState((await requireUser()).id));
