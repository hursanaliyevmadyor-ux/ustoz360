import { requireAdmin } from "@/server/auth";
import { createSeminar, listAdminSeminars } from "@/server/admin";
import { seminarInput } from "@/server/adminvalid";
import { handle } from "@/server/http";
export const dynamic = "force-dynamic";

export const GET = () => handle(async () => { await requireAdmin(); return listAdminSeminars(); });
export const POST = (req: Request) => handle(async () => { await requireAdmin(); return createSeminar(seminarInput.parse(await req.json())); });