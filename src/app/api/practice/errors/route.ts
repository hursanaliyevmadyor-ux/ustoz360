import { requireUser } from "@/server/auth";
import { handle } from "@/server/http";
import { errorsProgress } from "@/server/practice";
export const dynamic = "force-dynamic";

export const GET = () => handle(async () => errorsProgress((await requireUser()).id));
