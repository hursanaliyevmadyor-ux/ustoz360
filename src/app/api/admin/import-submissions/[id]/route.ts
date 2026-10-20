import { requireAdmin } from "@/server/auth";
import { handle } from "@/server/http";
import { getSubmission, reviewSchema, reviewSubmission } from "@/server/import/adminreview";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
type Ctx = { params: Promise<{ id: string }> };

export const GET = (_r: Request, { params }: Ctx) => handle(async () => { await requireAdmin(); return getSubmission((await params).id); });
export const POST = (req: Request, { params }: Ctx) => handle(async () => { const a = await requireAdmin(); return reviewSubmission(a, (await params).id, reviewSchema.parse(await req.json())); });
