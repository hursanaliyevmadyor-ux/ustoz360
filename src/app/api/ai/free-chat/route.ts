import { z } from "zod";
import { ApiError, requireUser } from "@/server/auth";
import { handle } from "@/server/http";
import { freeUsageToday } from "@/server/ai/gateway";
import { smartFreeChat } from "@/server/ai/smart";
import { saveExchange } from "@/server/ai/chats";
import { appOrigin } from "@/server/oauth";
import { encodeSources } from "@/lib/websources";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const body = z.object({ messages: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().min(1).max(4000) })).min(1).max(20), save: z.boolean().optional(), chatId: z.string().max(40).optional() });

/** Bepul AI chat. Yangi/rasmiy ma'lumot yoki tayyor material so'ralsa, avtomatik internet qidiruvi (manbalar bilan) ishlaydi; aks holda oddiy AI. */
export const POST = (req: Request) => handle(async () => {
  const user = await requireUser();
  const { messages, save, chatId } = body.parse(await req.json());
  if (messages[messages.length - 1].role !== "user") throw new ApiError(400, "Oxirgi xabar foydalanuvchidan bo'lishi kerak.");
  const r = await smartFreeChat(user.id, messages, { origin: appOrigin(req) });
  const savedId = save ? await saveExchange(user.id, chatId, "free", messages[messages.length - 1].content, encodeSources(r.reply, r.sources, r.queries)) : null;
  return { reply: r.reply, sources: r.sources, queries: r.queries, searched: r.searched, chatId: savedId, ...(await freeUsageToday(user.id)) };
});
