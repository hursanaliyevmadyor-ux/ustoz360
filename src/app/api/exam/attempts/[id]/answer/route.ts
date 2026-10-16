import { z } from "zod";
import { requireUser } from "@/server/auth";
import { saveAnswer } from "@/server/exam";
import { handle } from "@/server/http";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };
const body = z.object({ qid: z.string().min(1).max(60), c: z.number().int().nullable().optional(), t: z.string().max(1000).nullable().optional() });

export const PUT = (req: Request, { params }: Ctx) => handle(async () => {
  const b = body.parse(await req.json());
  return saveAnswer((await requireUser()).id, (await params).id, b.qid, { c: b.c, t: b.t });
});