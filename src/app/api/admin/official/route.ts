import { requireAdmin } from "@/server/auth";
import { handle } from "@/server/http";
import { listOfficialAdmin, saveOfficial } from "@/server/toifa";
import { officialInput } from "@/server/toifavalid";
export const dynamic = "force-dynamic";

export const GET = () => handle(async () => { await requireAdmin(); return listOfficialAdmin(); });
export const POST = (req: Request) => handle(async () => { const a = await requireAdmin(); return saveOfficial(a.id, officialInput.parse(await req.json())); });
