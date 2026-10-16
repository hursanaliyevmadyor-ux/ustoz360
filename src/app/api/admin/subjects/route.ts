import { requireAdmin } from "@/server/auth";
import { createSubject, listSubjects } from "@/server/admin";
import { nameInput } from "@/server/adminvalid";
import { handle } from "@/server/http";
export const dynamic = "force-dynamic";

export const GET = () => handle(async () => { await requireAdmin(); return listSubjects(); });
export const POST = (req: Request) => handle(async () => { await requireAdmin(); return createSubject(nameInput.parse(await req.json()).name); });