import { requireUser } from "@/server/auth";
import { handle } from "@/server/http";
import { aiConfigured, aiModel, freeConfigured, freeUsageToday, usageToday } from "@/server/ai/gateway";
import { geminiConfigured, tavilyConfigured, webSearchConfigured, webUsageToday } from "@/server/ai/websearch";
export const dynamic = "force-dynamic";

export const GET = () => handle(async () => {
  const user = await requireUser();
  return {
    configured: aiConfigured(), model: aiConfigured() ? aiModel() : null, ...(await usageToday(user.id)),
    free: { configured: freeConfigured(), ...(await freeUsageToday(user.id)) },
    // Internetdan qidirish: ulangan bo'lsa kunlik limit; qaysi xizmat ulangani (kalitsiz) ko'rsatiladi.
    web: { configured: webSearchConfigured(), gemini: geminiConfigured(), tavily: tavilyConfigured(), ...(webSearchConfigured() ? await webUsageToday(user.id) : { used: 0, limit: 0, remaining: 0 }) },
  };
});
