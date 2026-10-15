import { z } from "zod";
import { requireUser } from "@/server/auth";
import { handle } from "@/server/http";
import { runAi, usageToday } from "@/server/ai/gateway";
import { saveExchange } from "@/server/ai/chats";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const body = z.object({ messages: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().min(1).max(4000) })).min(1).max(20), save: z.boolean().optional(), chatId: z.string().max(40).optional() });

export const POST = (req: Request) => handle(async () => {
  const user = await requireUser();
  const { messages, save, chatId } = body.parse(await req.json());
  if (messages[messages.length - 1].role !== "user") throw new (await import("@/server/auth")).ApiError(400, "Oxirgi xabar foydalanuvchidan bo'lishi kerak.");
  const r = await runAi({ userId: user.id, feature: "chat", messages, maxTokens: 1500, effort: "low" });
  const savedId = save ? await saveExchange(user.id, chatId, "claude", messages[messages.length - 1].content, r.text) : null;
  return { reply: r.text, chatId: savedId, ...(await usageToday(user.id)) };
});
