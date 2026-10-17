import { requireAdmin } from "@/server/auth";
import { handle } from "@/server/http";
import { reviewCourse } from "@/server/market";
import { courseReviewInput } from "@/server/marketvalid";
export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

export const PATCH = (req: Request, { params }: Ctx) => handle(async () => { const a = await requireAdmin(); return reviewCourse(a.id, (await params).id, courseReviewInput.parse(await req.json())); });
