import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { isRoomCode, cleanName } from "../lib/dars";
import { VOICE_MODES, hasVideo, isFree, isVoiceMode, type VoiceMode } from "../lib/voice-mode";

/**
 * Ovozli dars xonasi (LiveKit): imzo va ruxsat mantig'i. Toza funksiyalar, tarmoqqa tegmaydi.
 * Xona havolasi faqat tizimga kirgan ustoz yaratgan bo'lsa ishlaydi: kod + rejim AUTH_SECRET bilan imzolanadi.
 * O'quvchi havolasida faqat `k` (kirish imzosi), ustoz havolasida qo'shimcha `h` (boshqaruv imzosi) bo'ladi.
 */

export { isVoiceMode, type VoiceMode };
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

/** LiveKit manba turlari (raqamli qiymatlar server tomonida beriladi, mantiq shu yerda toza qoladi). */
export type Sources = { mic: number; camera: number; screen: number };

/** LiveKit xona metadatasi: ustoz "hamma gapira oladi" ni jonli yoqqanmi (rejimdan qat'i nazar). */
export const freeMetadata = (on: boolean) => JSON.stringify({ f: on ? 1 : 0 });
export function roomFree(metadata: string | undefined): boolean {
  try { return (JSON.parse(metadata || "{}") as { f?: unknown }).f === 1; } catch { return false; }
}

/** Gapiruvchi o'quvchi nimani yoqa oladi: video rejimda mikrofon va kamera, ovozli chatda faqat mikrofon. */
export const speakSources = (mode: VoiceMode, S: Sources): number[] => (hasVideo(mode) ? [S.mic, S.camera] : [S.mic]);

/** O'quvchining joriy ruxsati (gapirishga ruxsat berish yoki olish): `allow` bo'lsa mikrofon (video rejimda kamera ham), bo'lmasa hech narsa. */
export const guestPermission = (mode: VoiceMode, allow: boolean, S: Sources) => ({
  canPublish: allow, canSubscribe: true, canPublishData: true, canPublishSources: allow ? speakSources(mode, S) : ([] as number[]),
});

/**
 * LiveKit ruxsatlari. Ustoz har doim gapira oladi, xonani boshqaradi; video rejimda kamera va ekranni ham ulashadi.
 * Ruxsat bilan rejimlarda (s, q) o'quvchi tinglaydi va yozadi, gapirish ustoz bergach ochiladi;
 * erkin rejimlarda (e, o) hamma gapira oladi. Ovozli chatda (q, o) kamera va ekran umuman yopiq. O'quvchi ekranini ulasha olmaydi.
 */
export function grantFor(role: VoiceRole, mode: VoiceMode, room: string, S: Sources, free = false) {
  const base = { roomJoin: true, room, canSubscribe: true, canPublishData: true, canUpdateOwnMetadata: false } as const;
  if (role === "host") return { ...base, roomAdmin: true, canPublish: true, canPublishSources: hasVideo(mode) ? [S.mic, S.camera, S.screen] : [S.mic] };
  return isFree(mode) || free ? { ...base, canPublish: true, canPublishSources: speakSources(mode, S) } : { ...base, canPublish: false };
}

export const guestName = (raw: unknown) => cleanName(raw) || "Mehmon";

const roomCtx = z.object({
  code: z.string().length(10),
  mode: z.enum(VOICE_MODES),
  k: z.string().min(10).max(40),
  h: z.string().min(10).max(40).optional(),
});
export const tokenInput = roomCtx.extend({ name: z.string().max(80).optional() });
export const roomInput = z.object({ mode: z.enum(VOICE_MODES) });
export const controlInput = z.discriminatedUnion("action", [
  roomCtx.extend({ action: z.literal("speak"), identity: z.string().min(1).max(64), allow: z.boolean() }),
  roomCtx.extend({ action: z.literal("mute-all") }),
  roomCtx.extend({ action: z.literal("free"), on: z.boolean() }),
  roomCtx.extend({ action: z.literal("close") }),
]);
