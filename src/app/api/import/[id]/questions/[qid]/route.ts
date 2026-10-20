import { z } from "zod";
import { requireUser } from "@/server/auth";
import { handle } from "@/server/http";
import { confirmQuestion, confirmSchema, editQuestion, editSchema, getQuestion, recheck, setDecision } from "@/server/import/service";
export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string; qid: string }> };

export const GET = (_r: Request, { params }: Ctx) => handle(async () => { const p = await params; return getQuestion(await requireUser(), p.id, p.qid); });
export const PATCH = (req: Request, { params }: Ctx) => handle(async () => { const p = await params; return editQuestion(await requireUser(), p.id, p.qid, editSchema.parse(await req.json())); });

const action = z.discriminatedUnion("action", [
  confirmSchema.extend({ action: z.literal("confirm") }),
  z.object({ action: z.literal("remove") }),
  z.object({ action: z.literal("restore") }),
  z.object({ action: z.literal("recheck") }),
]);
/** «To'g'ri» (confirm), olib tashlash/qaytarish va qayta AI tekshiruvi. */
export const POST = (req: Request, { params }: Ctx) => handle(async () => {
  const p = await params, u = await requireUser(), a = action.parse(await req.json());
  if (a.action === "confirm") return confirmQuestion(u, p.id, p.qid, { answer: a.answer, vouch: a.vouch });
  if (a.action === "recheck") return recheck(u, p.id, p.qid);
  return setDecision(u, p.id, p.qid, a.action === "remove" ? "REMOVED" : null);
});
