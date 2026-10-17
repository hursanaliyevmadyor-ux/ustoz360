import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { z } from "zod";

/** To'lov xizmatining toza qismi: bazaga tegmaydi, test qilinadi. */

// Chalkash belgilarsiz (0/O, 1/I yo'q): foydalanuvchi bank izohiga yozadi.
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export function makeReference(): string {
  const b = randomBytes(8);
  let s = "";
  for (let i = 0; i < 8; i++) s += ALPHABET[b[i] % ALPHABET.length];
  return `U360-${s}`;
}

export const signBody = (secret: string, raw: string) => createHmac("sha256", secret).update(raw).digest("hex");

/** Webhook imzosi: HMAC-SHA256(maxfiy kalit, xom matn), vaqt bo'yicha farqlanmaydigan taqqoslash. */
export function verifySignature(secret: string, raw: string, signature: string | null | undefined): boolean {
  if (!secret || !signature) return false;
  const a = Buffer.from(signBody(secret, raw), "hex");
  let b: Buffer;
  try { b = Buffer.from(signature.trim().toLowerCase().replace(/^sha256=/, ""), "hex"); } catch { return false; }
  return a.length === b.length && timingSafeEqual(a, b);
}

export const webhookEventSchema = z.object({
  eventId: z.string().min(1).max(100),
  reference: z.string().min(3).max(40),
  amount: z.number().int().min(0),
  status: z.enum(["paid", "failed"]),
  providerRef: z.string().min(1).max(100).optional(),
});
export type WebhookEventInput = z.infer<typeof webhookEventSchema>;

export const PAYMENT_STATUSES = ["PENDING", "PAID", "FAILED", "CANCELED", "REFUNDED"] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

/** Holat o'tishlari: to'langan to'lov faqat qaytarilishi (REFUNDED) mumkin; boshqa o'tishlar yo'q. */
const NEXT: Record<PaymentStatus, PaymentStatus[]> = {
  PENDING: ["PAID", "FAILED", "CANCELED"],
  PAID: ["REFUNDED"],
  FAILED: [], CANCELED: [], REFUNDED: [],
};
export const canTransition = (from: string, to: string) => (NEXT[from as PaymentStatus] ?? []).includes(to as PaymentStatus);

export const checkoutUrl = (template: string, p: { reference: string; amount: number }) =>
  template.replace(/\{reference\}/g, encodeURIComponent(p.reference)).replace(/\{amount\}/g, String(p.amount));
