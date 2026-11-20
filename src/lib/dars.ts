/**
 * Dars xonasi (1-versiya, oddiy): bazasiz va kalitsiz.
 * Xona kodi manzilda (`/d/<kod>`), video va ovoz Jitsi'da (chat ham Jitsi ichida).
 * Keyinroq o'z videosi yoki chatiga o'tilsa, faqat shu fayl va `components/dars` o'zgaradi.
 */

/** O'xshash belgilarsiz (i, l, o, 0, 1): og'zaki aytganda adashmaslik uchun. */
export const ROOM_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";
export const ROOM_CODE_LEN = 10;

const SAFE_HOST = /^[a-z0-9]([a-z0-9.-]{0,251}[a-z0-9])?$/i;
const DEFAULT_HOST = "meet.jit.si";

/** Jitsi serveri sozlanadigan (o'z serveringiz bo'lsa): noto'g'ri nom bo'lsa standart serverga qaytadi. */
export function jitsiHost(raw: string | undefined | null = process.env.NEXT_PUBLIC_JITSI_HOST): string {
  const h = (raw ?? "").trim().toLowerCase();
  return SAFE_HOST.test(h) && h.includes(".") ? h : DEFAULT_HOST;
}

type RandomBytes = (n: number) => Uint8Array;
const webRandom: RandomBytes = (n) => globalThis.crypto.getRandomValues(new Uint8Array(n));

/** Tasodifiy (kriptografik) xona kodi; modulo og'ishsiz. */
export function newRoomCode(random: RandomBytes = webRandom): string {
  const A = ROOM_ALPHABET.length;
  const limit = 256 - (256 % A);
  let out = "";
  while (out.length < ROOM_CODE_LEN) {
    for (const b of random(ROOM_CODE_LEN * 2)) {
      if (b < limit && out.length < ROOM_CODE_LEN) out += ROOM_ALPHABET[b % A];
    }
  }
  return out;
}

export const isRoomCode = (s: unknown): s is string =>
  typeof s === "string" && s.length === ROOM_CODE_LEN && [...s].every((c) => ROOM_ALPHABET.includes(c));

/** Jitsi xona nomi: kod bilan birga prefiks, boshqa xonalar bilan to'qnashmasligi uchun. */
export const jitsiRoomName = (code: string) => `ustoz360-${code}`;

export const cleanTitle = (s: unknown, max = 80) => (typeof s === "string" ? s.replace(/\s+/g, " ").trim().slice(0, max) : "");
export const cleanName = (s: unknown) => (typeof s === "string" ? s.replace(/\s+/g, " ").trim().slice(0, 40) : "");

const q = (v: string) => encodeURIComponent(JSON.stringify(v));

/** O'quvchi/ustoz Jitsi xonasiga kiradigan manzil (ism va mavzu tayyor qo'yiladi). */
export function jitsiUrl(o: { code: string; name?: string; title?: string; host?: string }): string {
  const host = o.host ?? jitsiHost();
  const params: string[] = [];
  const name = cleanName(o.name);
  const title = cleanTitle(o.title);
  if (name) params.push(`userInfo.displayName=${q(name)}`);
  if (title) params.push(`config.subject=${q(title)}`);
  return `https://${host}/${jitsiRoomName(o.code)}${params.length ? `#${params.join("&")}` : ""}`;
}

/** Ulashiladigan qisqa havola: /d/<kod>?t=<dars nomi>. */
export function joinUrl(origin: string, code: string, title?: string, asTeacher = false): string {
  const p = new URLSearchParams();
  const t = cleanTitle(title);
  if (t) p.set("t", t);
  if (asTeacher) p.set("u", "1");
  const qs = p.toString();
  return `${origin.replace(/\/+$/, "")}/d/${code}${qs ? `?${qs}` : ""}`;
}

/** Telegramda yuborish: foydalanuvchi o'zi chat tanlaydi (bot yoki kalit kerak emas). */
export function telegramShareUrl(link: string, text: string): string {
  return `https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(text)}`;
}

/** Telegram ichki brauzeri kamerani ko'pincha bermaydi: tashqi brauzerga o'tishni maslahat beramiz. */
export const isTelegramBrowser = (ua: string) => /Telegram/i.test(ua);

/** getUserMedia xatolarini o'zbekcha va tushunarli qilib beradi. */
export function describeMediaError(e: unknown, what: "kamera" | "mikrofon" | "kamera va mikrofon" = "kamera va mikrofon"): string {
  const name = typeof e === "object" && e && "name" in e ? String((e as { name: unknown }).name) : "";
  switch (name) {
    case "NotAllowedError":
    case "SecurityError":
    case "PermissionDeniedError":
      return `${cap(what)}ga ruxsat berilmadi. Brauzer manzil qatoridagi qulf (yoki kamera) belgisini bosib, ruxsat bering, so'ng qayta urinib ko'ring.`;
    case "NotFoundError":
    case "DevicesNotFoundError":
      return `${cap(what)} topilmadi. Qurilma ulanganini tekshiring.`;
    case "NotReadableError":
    case "TrackStartError":
      return `${cap(what)}ni boshqa dastur (Zoom, Telegram qo'ng'irog'i va hokazo) ishlatayotgan bo'lishi mumkin. Uni yoping va qayta urining.`;
    case "OverconstrainedError":
      return `${cap(what)} kerakli sozlamaga mos kelmadi. Boshqa qurilma tanlab ko'ring.`;
    case "NoMediaDevices":
      return "Bu brauzerda kamera va mikrofon ishlamaydi. Sahifani Chrome yoki Safari'da (https orqali) oching.";
    default:
      return `${cap(what)}ni yoqib bo'lmadi. Sahifani yangilab, qayta urining.`;
  }
}
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Teacher uchun oxirgi xonalar (brauzerda saqlanadi, bazasiz). */
export type SavedRoom = { code: string; title: string; at: number };
export const ROOMS_KEY = "u360-dars-rooms";
export const NAME_KEY = "u360-dars-name";

export function parseSavedRooms(raw: string | null): SavedRoom[] {
  if (!raw) return [];
  try {
    const v: unknown = JSON.parse(raw);
    if (!Array.isArray(v)) return [];
    return v
      .filter((r): r is SavedRoom => !!r && isRoomCode((r as SavedRoom).code) && typeof (r as SavedRoom).at === "number")
      .map((r) => ({ code: r.code, title: cleanTitle(r.title), at: r.at }))
      .slice(0, 10);
  } catch {
    return [];
  }
}

export function addSavedRoom(list: SavedRoom[], room: SavedRoom): SavedRoom[] {
  return [room, ...list.filter((r) => r.code !== room.code)].slice(0, 10);
}
