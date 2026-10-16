import { requireUser } from "@/server/auth";
import { handle } from "@/server/http";
import { topicsData } from "@/server/practice";
export const dynamic = "force-dynamic";

export const GET = () => handle(async () => topicsData((await requireUser()).id));
