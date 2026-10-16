import { requireAdmin } from "@/server/auth";
import { bankQuestionInput } from "@/server/adminvalid";
import { handle } from "@/server/http";
import { createBankQuestion, listBank } from "@/server/qbank";
export const dynamic = "force-dynamic";

export const GET = (req: Request) => handle(async () => {
  await requireAdmin();
  const p = new URL(req.url).searchParams;
  return listBank({ status: p.get("status") || undefined, topicId: p.get("topicId") || undefined, source: p.get("source") || undefined, q: p.get("q")?.slice(0, 100) || undefined });
});
export const POST = (req: Request) => handle(async () => { await requireAdmin(); return createBankQuestion(bankQuestionInput.parse(await req.json())); });
