import { requireUser } from "@/server/auth";
import { handle } from "@/server/http";
import { aiConfigured, aiModel, usageToday } from "@/server/ai/gateway";
export const dynamic = "force-dynamic";

export const GET = () => handle(async () => {
  const user = await requireUser();
  return { configured: aiConfigured(), model: aiConfigured() ? aiModel() : null, ...(await usageToday(user.id)) };
});
