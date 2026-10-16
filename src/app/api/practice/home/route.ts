import { requireUser } from "@/server/auth";
import { handle } from "@/server/http";
import { homeData } from "@/server/practice";
export const dynamic = "force-dynamic";

export const GET = () => handle(async () => homeData((await requireUser()).id));
