import { requireUser } from "@/server/auth";
import { recordLeave } from "@/server/exam";
import { handle } from "@/server/http";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export const POST = (_req: Request, { params }: Ctx) => handle(async () => recordLeave((await requireUser()).id, (await params).id));