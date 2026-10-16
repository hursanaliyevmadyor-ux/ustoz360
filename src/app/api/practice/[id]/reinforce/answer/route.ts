import { z } from "zod";
import { requireUser } from "@/server/auth";
import { reinforceAnswer } from "@/server/coach";
import { handle } from "@/server/http";
export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

export const POST = (req: Request, { params }: Ctx) => handle(async () => {
  const user = await requireUser();
  const b = z.object({ questionId: z.string().min(1), optionId: z.string().min(1) }).parse(await req.json());
  return reinforceAnswer(user.id, (await params).id, b.questionId, b.optionId);
});
