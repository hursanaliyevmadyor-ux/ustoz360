import { requireAdmin } from "@/server/auth";
import { handle } from "@/server/http";
import { adminPayments, paymentStatus } from "@/server/payments";
export const dynamic = "force-dynamic";

export const GET = (req: Request) => handle(async () => {
  await requireAdmin();
  return { ...(await adminPayments({ status: new URL(req.url).searchParams.get("status") ?? undefined })), provider: paymentStatus() };
});
