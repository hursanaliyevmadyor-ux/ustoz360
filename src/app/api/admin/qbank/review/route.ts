import { requireAdmin } from "@/server/auth";
import { handle } from "@/server/http";
import { reviewQueue } from "@/server/qbankreview";
export const dynamic = "force-dynamic";

/** Bitalab tekshirish navbati: tekshirilmagan savol id lari va umumiy ko'rsatkich. */
export const GET = (req: Request) => handle(async () => {
  await requireAdmin();
  const p = new URL(req.url).searchParams;
  return reviewQueue({ status: p.get("status") || undefined, topicId: p.get("topicId") || undefined });
});
