import { z } from "zod";
import { requireUser } from "@/server/auth";
import { handle } from "@/server/http";
import { setFlag } from "@/server/practice";
export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

export const POST = (req: Request, { params }: Ctx) => handle(async () => {
  const user = await requireUser();
  const b = z.object({ questionId: z.string().min(1), flagged: z.boolean() }).parse(await req.json());
  return setFlag(user.id, (await params).id, b.questionId, b.flagged);
});
