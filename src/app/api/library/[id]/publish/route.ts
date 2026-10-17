import { requireUser } from "@/server/auth";
import { handle } from "@/server/http";
import { requestPublic } from "@/server/library";
export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

export const POST = (_r: Request, { params }: Ctx) => handle(async () => requestPublic(await requireUser(), (await params).id));
