import { requireAdmin } from "@/server/auth";
import { handle } from "@/server/http";
import { applyReview, getReviewQuestion } from "@/server/qbankreview";
import { reviewAction } from "@/server/qbankreviewlogic";
export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

export const GET = (_r: Request, { params }: Ctx) => handle(async () => { await requireAdmin(); return getReviewQuestion((await params).id); });
export const POST = (req: Request, { params }: Ctx) => handle(async () => {
  const admin = await requireAdmin();
  return applyReview(admin.id, (await params).id, reviewAction.parse(await req.json()));
});
