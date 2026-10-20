import { requireUser } from "@/server/auth";
import { handle } from "@/server/http";
import { directionsInfo } from "@/server/ranking/service";
export const dynamic = "force-dynamic";

export const GET = () => handle(async () => { await requireUser(); return directionsInfo(); });
