import { z } from "zod";
import { requireUser } from "@/server/auth";
import { reinforce } from "@/server/coach";
import { handle } from "@/server/http";
export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

export const POST = (req: Request, { params }: Ctx) => handle(async () => {
  const user = await requireUser();
  const b = z.object({ questionId: z.string().min(1) }).parse(await req.json());
  return reinforce(user.id, (await params).id, b.questionId);
});
