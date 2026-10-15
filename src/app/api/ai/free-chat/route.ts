import { z } from "zod";
import { ApiError, requireUser } from "@/server/auth";
import { handle } from "@/server/http";
import { freeUsageToday, runFreeAi } from "@/server/ai/gateway";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const body = z.object({ messages: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().min(1).max(4000) })).min(1).max(20) });

export const POST = (req: Request) => handle(async () => {
  const user = await requireUser();
  const { messages } = body.parse(await req.json());
  if (messages[messages.length - 1].role !== "user") throw new ApiError(400, "Oxirgi xabar foydalanuvchidan bo'lishi kerak.");
  const r = await runFreeAi(user.id, messages);
  return { reply: r.text, ...(await freeUsageToday(user.id)) };
});
