import { requireAdmin } from "@/server/auth";
import { createExam, listAdminExams } from "@/server/admin";
import { examInput } from "@/server/adminvalid";
import { handle } from "@/server/http";
export const dynamic = "force-dynamic";

export const GET = () => handle(async () => { await requireAdmin(); return listAdminExams(); });
export const POST = (req: Request) => handle(async () => { await requireAdmin(); return createExam(examInput.parse(await req.json())); });