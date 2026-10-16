import { requireUser } from "@/server/auth";
import { handle } from "@/server/http";
import { knowledgeMap } from "@/server/practice";
export const dynamic = "force-dynamic";

export const GET = () => handle(async () => ({ topics: await knowledgeMap((await requireUser()).id) }));
