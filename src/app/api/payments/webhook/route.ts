import { handle } from "@/server/http";
import { handleWebhook } from "@/server/payments";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * To'lov provayderi xabari. Sarlavha: x-signature = HMAC-SHA256(PAYMENT_WEBHOOK_SECRET, xom tana).
 * Tana: { eventId, reference, amount, status: "paid" | "failed", providerRef? }. Takroriy xabar xavfsiz (idempotent).
 */
export const POST = async (req: Request) => {
  const raw = await req.text();
  return handle(() => handleWebhook(raw, req.headers.get("x-signature")));
};
