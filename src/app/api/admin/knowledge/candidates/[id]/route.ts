import { requireAdmin } from "@/server/auth";
import { handle } from "@/server/http";
import { reviewCandidate } from "@/server/hub/knowledge";
import { candidateReviewInput } from "@/server/hub/knowledgevalid";
export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

/** Nomzodni tasdiqlash (admin tahrirlagan to'liq yozuv bilan: manba va muddat) yoki rad etish. Avtomatik tasdiq yo'q. */
export const POST = (req: Request, { params }: Ctx) => handle(async () => {
  const a = await requireAdmin();
  return reviewCandidate(a.id, (await params).id, candidateReviewInput.parse(await req.json()));
});
