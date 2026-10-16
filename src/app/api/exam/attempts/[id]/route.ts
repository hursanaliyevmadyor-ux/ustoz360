import { requireUser } from "@/server/auth";
import { getAttemptView } from "@/server/exam";
import { handle } from "@/server/http";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export const GET = (_req: Request, { params }: Ctx) => handle(async () => getAttemptView((await requireUser()).id, (await params).id));