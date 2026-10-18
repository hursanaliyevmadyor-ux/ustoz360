import { z } from "zod";
import { ApiError, requireUser } from "@/server/auth";
import { handle } from "@/server/http";
import { runWebSearch, webUsageToday } from "@/server/ai/websearch";
import { saveExchange } from "@/server/ai/chats";
import { appOrigin } from "@/server/oauth";
import { encodeSources } from "@/lib/websources";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const body = z.object({ messages: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().min(1).max(4000) })).min(1).max(20), save: z.boolean().optional(), chatId: z.string().max(40).optional() });

/**
 * Internetdan qidirib javob ("Internetdan qidirish" tugmasi yoqilganda): bilim bazasi, Tavily (kesh bilan), zaxirada Gemini.
 * Manbalar ishonchlilik belgisi bilan qaytadi va chat tarixida ham saqlanadi.
 */
export const POST = (req: Request) => handle(async () => {
  const user = await requireUser();
  const { messages, save, chatId } = body.parse(await req.json());
  if (messages[messages.length - 1].role !== "user") throw new ApiError(400, "Oxirgi xabar foydalanuvchidan bo'lishi kerak.");
  const r = await runWebSearch(user.id, messages, { force: true, origin: appOrigin(req) });
  const savedId = save ? await saveExchange(user.id, chatId, "free", messages[messages.length - 1].content, encodeSources(r.text, r.sources, r.queries)) : null;
  return { reply: r.text, sources: r.sources, queries: r.queries, engine: r.engine, official: r.official, material: r.material, found: r.found, chatId: savedId, web: await webUsageToday(user.id) };
});
