import { requireUser } from "@/server/auth";
import { handle } from "@/server/http";
import { myRanking } from "@/server/ranking/service";
export const dynamic = "force-dynamic";

export const GET = () => handle(async () => myRanking((await requireUser()).id));
