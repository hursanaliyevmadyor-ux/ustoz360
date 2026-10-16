import { z } from "zod";
import { requireUser } from "@/server/auth";
import { handle } from "@/server/http";
import { reportQuestion } from "@/server/practice";
export const dynamic = "force-dynamic";

export const POST = (req: Request) => handle(async () => {
  const user = await requireUser();
  const b = z.object({ questionId: z.string().min(1), reason: z.string().trim().min(3).max(500) }).parse(await req.json());
  return reportQuestion(user.id, b.questionId, b.reason);
});
