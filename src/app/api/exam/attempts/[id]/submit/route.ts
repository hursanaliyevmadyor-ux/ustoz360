import { z } from "zod";
import { requireUser } from "@/server/auth";
import { submitAttempt } from "@/server/exam";
import { handle } from "@/server/http";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };
const body = z.object({ answers: z.record(z.string(), z.object({ c: z.number().int().nullable().optional(), t: z.string().max(1000).nullable().optional() })).optional() }).optional();

export const POST = (req: Request, { params }: Ctx) => handle(async () => {
  const b = body.parse(await req.json().catch(() => undefined));
  return submitAttempt((await requireUser()).id, (await params).id, b?.answers);
});