import { requireAdmin } from "@/server/auth";
import { handle } from "@/server/http";
import { bulkApprove } from "@/server/qbankreview";
import { bulkApproveInput } from "@/server/qbankreviewlogic";
export const dynamic = "force-dynamic";

/** Belgilangan savollarni (yoki filtrga mos hammasini) bir bosishda tasdiqlash. Faqat admin. */
export const POST = (req: Request) => handle(async () => {
  const admin = await requireAdmin();
  return bulkApprove(admin.id, bulkApproveInput.parse(await req.json()));
});
