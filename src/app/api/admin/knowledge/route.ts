import { requireAdmin } from "@/server/auth";
import { handle } from "@/server/http";
import { hubOverview, providerOverview } from "@/server/hub/knowledge";
export const dynamic = "force-dynamic";

/** AI Bilim markazi: umumiy holat, ehtiyojlar, nomzod/eskirgan/xato belgilanganlar va provayderlar. Kalit qiymatlari QAYTARILMAYDI. */
export const GET = () => handle(async () => {
  await requireAdmin();
  const [overview, providers] = await Promise.all([hubOverview(), providerOverview()]);
  return { overview, providers };
});
