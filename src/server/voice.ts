import { randomBytes } from "node:crypto";
import { AccessToken, RoomServiceClient, TrackSource } from "livekit-server-sdk";
import { ApiError } from "./auth";
import { isFree } from "../lib/voice-mode";
import { freeMetadata, grantFor, guestName, guestPermission, livekitRoomName, roomFree, verifyRoom, type VoiceMode, type VoiceRole } from "./voicelogic";

/**
 * Ovozli dars xonasi (LiveKit). Kalitlar faqat serverda (LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET), brauzerga faqat qisqa muddatli kirish belgisi (token) beriladi.
 * Sozlanmagan bo'lsa, dars xonasi o'chiq turadi (ustoz xona yarata olmaydi).
 */
export type VoiceConfig = { url: string; key: string; secret: string; authSecret: string };

export function voiceConfig(env: NodeJS.ProcessEnv = process.env): VoiceConfig | null {
  const url = env.LIVEKIT_URL?.trim(), key = env.LIVEKIT_API_KEY?.trim(), secret = env.LIVEKIT_API_SECRET?.trim(), authSecret = env.AUTH_SECRET;
  if (!url || !key || !secret || !authSecret || authSecret.length < 32) return null;
  return { url, key, secret, authSecret };
}
export const isVoiceConfigured = () => voiceConfig() !== null;

const SRC = { mic: TrackSource.MICROPHONE, camera: TrackSource.CAMERA, screen: TrackSource.SCREEN_SHARE };

/** Brauzer uchun wss://, server API uchun https:// manzili (qaysi shaklda kiritilgan bo'lsa ham). */
export const wsUrl = (u: string) => u.replace(/^https?:\/\//i, "wss://").replace(/\/+$/, "");
export const httpUrl = (u: string) => u.replace(/^wss?:\/\//i, "https://").replace(/\/+$/, "");

function need(): VoiceConfig {
  const c = voiceConfig();
  if (!c) throw new ApiError(503, "Ovozli xona hozircha sozlanmagan.", "voice_off");
  return c;
}

/** Havola imzosini tekshiradi; yaroqsiz bo'lsa 403. */
export function authorize(c: VoiceConfig, o: { code: string; mode: VoiceMode; k: string; h?: string }): VoiceRole {
  const role = verifyRoom(c.authSecret, o);
  if (!role) throw new ApiError(403, "Havola noto'g'ri yoki eskirgan.", "bad_link");
  return role;
}

/** Ustoz "hamma gapira oladi" ni jonli yoqqanmi (xona metadatasi). LiveKit javob bermasa, rejimning o'zi ishlaydi. */
async function liveFree(c: VoiceConfig, code: string): Promise<boolean> {
  try { return roomFree((await roomClient(c).listRooms([livekitRoomName(code)]))[0]?.metadata); } catch { return false; }
}

export async function issueToken(o: { code: string; mode: VoiceMode; k: string; h?: string; name?: string }, isFreeNow: (c: VoiceConfig, code: string) => Promise<boolean> = liveFree) {
  const c = need();
  const role = authorize(c, o);
  const free = role === "guest" && !isFree(o.mode) ? await isFreeNow(c, o.code) : false; // faqat ruxsat bilan rejimda o'quvchi uchun kerak
  const room = livekitRoomName(o.code);
  const identity = `${role === "host" ? "t" : "o"}-${randomBytes(6).toString("base64url")}`;
  const at = new AccessToken(c.key, c.secret, { identity, name: role === "host" ? (o.name?.trim() || "Ustoz").slice(0, 40) : guestName(o.name), ttl: "4h", metadata: JSON.stringify({ r: role }) });
  at.addGrant(grantFor(role, o.mode, room, SRC, free));
  const canSpeak = role === "host" || isFree(o.mode) || free;
  return { token: await at.toJwt(), url: wsUrl(c.url), identity, role, canSpeak };
}

const roomClient = (c: VoiceConfig) => new RoomServiceClient(httpUrl(c.url), c.key, c.secret);

/** Faqat ustoz: o'quvchiga gapirish va kamera ruxsatini berish yoki olish. */
export async function setSpeaking(o: { code: string; mode: VoiceMode; k: string; h?: string; identity: string; allow: boolean }) {
  const c = need();
  if (authorize(c, o) !== "host") throw new ApiError(403, "Bu amal faqat ustoz uchun.", "not_host");
  const rc = roomClient(c), room = livekitRoomName(o.code);
  await rc.updateParticipant(room, o.identity, { permission: guestPermission(o.mode, o.allow, SRC) });
  return { ok: true as const };
}

/** Faqat ustoz: hamma o'quvchining gapirish ruxsatini olib qo'yish (ustozniki qoladi). */
export async function muteAll(o: { code: string; mode: VoiceMode; k: string; h?: string }) {
  const c = need();
  if (authorize(c, o) !== "host") throw new ApiError(403, "Bu amal faqat ustoz uchun.", "not_host");
  const rc = roomClient(c), room = livekitRoomName(o.code);
  await rc.updateRoomMetadata(room, freeMetadata(false)).catch(() => {}); // "hamma gapira oladi" ham o'chadi: keyin kirganlar ham ruxsatsiz
  const people = await rc.listParticipants(room);
  const guests = people.filter((p) => p.identity.startsWith("o-"));
  await Promise.all(guests.map((p) => rc.updateParticipant(room, p.identity, { permission: guestPermission(o.mode, false, SRC) })));
  return { ok: true as const, count: guests.length };
}

/** Faqat ustoz: "hamma gapira oladi" ni jonli yoqish yoki o'chirish. Xona metadatasiga yoziladi (keyin kirganlar ham hisobga olinadi), hozirgi o'quvchilarning ruxsati almashadi. */
export async function setFree(o: { code: string; mode: VoiceMode; k: string; h?: string; on: boolean }) {
  const c = need();
  if (authorize(c, o) !== "host") throw new ApiError(403, "Bu amal faqat ustoz uchun.", "not_host");
  const rc = roomClient(c), room = livekitRoomName(o.code);
  await rc.updateRoomMetadata(room, freeMetadata(o.on));
  const guests = (await rc.listParticipants(room)).filter((p) => p.identity.startsWith("o-"));
  await Promise.all(guests.map((p) => rc.updateParticipant(room, p.identity, { permission: guestPermission(o.mode, o.on, SRC) })));
  return { ok: true as const, on: o.on, count: guests.length };
}

/** Faqat ustoz: xonani hamma uchun yopish. */
export async function closeRoom(o: { code: string; mode: VoiceMode; k: string; h?: string }) {
  const c = need();
  if (authorize(c, o) !== "host") throw new ApiError(403, "Bu amal faqat ustoz uchun.", "not_host");
  await roomClient(c).deleteRoom(livekitRoomName(o.code)).catch(() => {}); // xona yo'q bo'lsa ham xato emas
  return { ok: true as const };
}
