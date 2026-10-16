import { requireUser } from "@/server/auth";
import { listExams } from "@/server/exam";
import { handle } from "@/server/http";
export const dynamic = "force-dynamic";

export const GET = () => handle(async () => listExams((await requireUser()).id));