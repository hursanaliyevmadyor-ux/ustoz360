import { requireAdmin } from "@/server/auth";
import { handle } from "@/server/http";
import { listCandidates } from "@/server/hub/knowledge";
export const dynamic = "force-dynamic";

/** Tekshiruv kutayotgan javob nomzodlari (foydalanuvchi izlarisiz: faqat tozalangan savol, javob, provayder, manba, xavf belgilari). */
export const GET = (req: Request) => handle(async () => {
  await requireAdmin();
  return { items: await listCandidates(new URL(req.url).searchParams.get("status") ?? "PENDING") };
});
