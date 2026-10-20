import { requireUser } from "@/server/auth";
import { handle } from "@/server/http";
import { cancelSession } from "@/server/import/service";
export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

export const POST = (_r: Request, { params }: Ctx) => handle(async () => cancelSession(await requireUser(), (await params).id));
