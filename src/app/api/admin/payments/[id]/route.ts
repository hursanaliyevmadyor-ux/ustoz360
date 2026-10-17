import { z } from "zod";
import { requireAdmin } from "@/server/auth";
import { handle } from "@/server/http";
import { cancelPayment, confirmPayment, refundPayment } from "@/server/payments";
export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

/** confirm: bank o'tkazmasi kelganini tasdiqlaydi (kirish ochiladi). cancel: hali to'lanmagan buyurtmani bekor qiladi. refund: qaytarish. */
export const PATCH = (req: Request, { params }: Ctx) => handle(async () => {
  const a = await requireAdmin();
  const { action } = z.object({ action: z.enum(["confirm", "cancel", "refund"]) }).parse(await req.json());
  const id = (await params).id;
  if (action === "confirm") return confirmPayment(id, { adminId: a.id });
  if (action === "cancel") return cancelPayment(id, { userId: a.id, admin: true });
  return refundPayment(id, a.id);
});
