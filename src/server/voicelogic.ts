import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { isRoomCode, cleanName } from "../lib/dars";

/**
 * Ovozli dars xonasi (LiveKit): imzo va ruxsat mantig'i. Toza funksiyalar, tarmoqqa tegmaydi.
 * Xona havolasi faqat tizimga kirgan ustoz yaratgan bo'lsa ishlaydi: kod + rejim AUTH_SECRET bilan imzolanadi.
 * O'quvchi havolasida faqat `k` (kirish imzosi), ustoz havolasida qo'shimcha `h` (boshqaruv imzosi) bo'ladi.
 */

/** s = sinf (o'quvchi qo'l ko'taradi, ustoz gapirishga ruxsat beradi), e = erkin suhbat (hamma gapira oladi). */
export type VoiceMode = "s" | "e";
export const isVoiceMode = (v: unknown): v is VoiceMode => v === "s" || v === "e";
export type VoiceRole = "host" | "guest";

export const livekitRoomName = (code: string) => `u360-${code}`;

const tag = (secret: string, kind: "k" | "h", code: string, mode: VoiceMode) =>
  createHmac("sha256", secret).update(`${kind}|${code}|${mode}`).digest("base64url").slice(0, 22);

export function signRoom(secret: string, code: string, mode: VoiceMode) {
  return { k: tag(secret, "k", code, mode), h: tag(secret, "h", code, mode) };
}

const same = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

/** Havola imzosini tekshiradi: "host" (boshqaruv imzosi to'g'ri), "guest" (kirish imzosi to'g'ri) yoki null (yaroqsiz). */
export function verifyRoom(secret: string, o: { code: unknown; mode: unknown; k: unknown; h?: unknown }): VoiceRole | null {
  if (!isRoomCode(o.code) || !isVoiceMode(o.mode) || typeof o.k !== "string") return null;
  const want = signRoom(secret, o.code, o.mode);
  if (!same(o.k, want.k)) return null;
  return typeof o.h === "string" && same(o.h, want.h) ? "host" : "guest";
}

/**
 * LiveKit ruxsatlari. Ustoz har doim gapira oladi va xonani boshqaradi.
 * Sinf rejimida o'quvchi eshitadi va yozadi, gapirish ruxsati ustoz bergach ochiladi; erkin suhbatda hamma gapira oladi.
 * Faqat mikrofon (video va ekran ulashish hozircha yopiq).
 */
export function grantFor(role: VoiceRole, mode: VoiceMode, room: string, MICROPHONE: number) {
  const base = { roomJoin: true, room, canSubscribe: true, canPublishData: true, canUpdateOwnMetadata: false } as const;
  if (role === "host") return { ...base, roomAdmin: true, canPublish: true, canPublishSources: [MICROPHONE] };
  return mode === "e" ? { ...base, canPublish: true, canPublishSources: [MICROPHONE] } : { ...base, canPublish: false };
}

export const guestName = (raw: unknown) => cleanName(raw) || "Mehmon";

const roomCtx = z.object({
  code: z.string().length(10),
  mode: z.enum(["s", "e"]),
  k: z.string().min(10).max(40),
  h: z.string().min(10).max(40).optional(),
});
export const tokenInput = roomCtx.extend({ name: z.string().max(80).optional() });
export const roomInput = z.object({ mode: z.enum(["s", "e"]) });
export const controlInput = z.discriminatedUnion("action", [
  roomCtx.extend({ action: z.literal("speak"), identity: z.string().min(1).max(64), allow: z.boolean() }),
  roomCtx.extend({ action: z.literal("mute-all") }),
  roomCtx.extend({ action: z.literal("close") }),
]);
