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

/**
 * O'quvchi/ustoz Jitsi xonasiga kiradigan manzil: ism, mavzu va boshlang'ich holat (mikrofon/kamera o'chiq) tayyor qo'yiladi.
 * `disableDeepLinking`: telefonda «ilovani o'rnating» sahifasiga o'tkazmaydi, brauzerning o'zida ochadi.
 */
export function jitsiUrl(o: { code: string; name?: string; title?: string; host?: string; audioMuted?: boolean; videoMuted?: boolean }): string {
  const host = o.host ?? jitsiHost();
  const params: string[] = [];
  const name = cleanName(o.name);
  const title = cleanTitle(o.title);
  if (name) params.push(`userInfo.displayName=${q(name)}`);
  if (title) params.push(`config.subject=${q(title)}`);
  if (o.audioMuted) params.push("config.startWithAudioMuted=true");
  if (o.videoMuted) params.push("config.startWithVideoMuted=true");
  params.push("config.disableDeepLinking=true");
  return `https://${host}/${jitsiRoomName(o.code)}#${params.join("&")}`;
}

/** Ulashiladigan qisqa havola: /d/<kod>?t=<dars nomi>&s=<boshlanish vaqti>. */
export function joinUrl(origin: string, code: string, title?: string, asTeacher = false, startsAt?: number | null): string {
  const p = new URLSearchParams();
  const t = cleanTitle(title);
  if (t) p.set("t", t);
  if (startsAt) p.set("s", String(Math.round(startsAt)));
  if (asTeacher) p.set("u", "1");
  const qs = p.toString();
  return `${origin.replace(/\/+$/, "")}/d/${code}${qs ? `?${qs}` : ""}`;
}

/** Manzildagi vaqt (millisekund): faqat o'tgan-kelgusi 2 yil oralig'idagi son qabul qilinadi. */
export function parseStartsAt(v: unknown, now = Date.now()): number | null {
  if (typeof v !== "string" || !/^\d{10,14}$/.test(v)) return null;
  const n = Number(v);
  return Math.abs(n - now) <= 2 * 365 * 24 * 3600 * 1000 ? n : null;
}

const MONTHS = ["yanvar", "fevral", "mart", "aprel", "may", "iyun", "iyul", "avgust", "sentabr", "oktabr", "noyabr", "dekabr"];
const pad2 = (n: number) => String(n).padStart(2, "0");

/** "22-noyabr, 15:00" (ko'ruvchining mahalliy vaqti). */
export function lessonTimeLabel(ts: number): string {
  const d = new Date(ts);
  return `${d.getDate()}-${MONTHS[d.getMonth()]}, ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

/** Boshlanishgacha qolgan vaqt: "future" (hali boshlanmagan), "live" (boshlanganiga 3 soatgacha), "past" (3 soatdan oshgan). */
export function lessonCountdown(startsAt: number, now = Date.now()): { state: "future" | "live" | "past"; text: string } {
  const diff = startsAt - now;
  if (diff > 0) {
    const min = Math.ceil(diff / 60000);
    const d = Math.floor(min / 1440), h = Math.floor((min % 1440) / 60), m = min % 60;
    if (d > 0) return { state: "future", text: `Darsga ${d} kun${h ? ` ${h} soat` : ""} qoldi` };
    if (h > 0) return { state: "future", text: `Darsga ${h} soat${m ? ` ${m} daqiqa` : ""} qoldi` };
    return { state: "future", text: min <= 1 ? "Dars bir daqiqadan keyin boshlanadi" : `Darsga ${min} daqiqa qoldi` };
  }
  if (diff > -3 * 3600 * 1000) return { state: "live", text: "Dars boshlangan: kirishingiz mumkin" };
  return { state: "past", text: "Dars vaqti o'tgan, lekin xona ochiq" };
}

/** Telegram va boshqa joylarga yuboriladigan tayyor taklif matni. */
export function inviteText(o: { title?: string; startsAt?: number | null; link: string }): string {
  const t = cleanTitle(o.title);
  return [
    `Onlayn dars${t ? `: ${t}` : ""}`,
    ...(o.startsAt ? [`Boshlanishi: ${lessonTimeLabel(o.startsAt)}`] : []),
    "",
    "Darsga kirish uchun havolani bosing:",
    o.link,
    "",
    "Qanday kiriladi: havolani bosing, «Kamera va mikrofonga ruxsat berish» tugmasini bosing, ismingizni yozib «Darsga kirish» ni bosing.",
    "Telegram ichida kamera ishlamasa, havolani Chrome yoki Safari'da oching.",
  ].join("\n");
}

/** <input type="datetime-local"> qiymati (mahalliy vaqt) <-> millisekund. */
export const toLocalInput = (ts: number) => { const d = new Date(ts); return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`; };
export const fromLocalInput = (v: string): number | null => { const n = new Date(v).getTime(); return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(v) && Number.isFinite(n) ? n : null; };

/** Internet sifati (kechikish millisekundda): yaxshi / o'rtacha / zaif. */
export function connectionQuality(rttMs: number | null, online = true): { level: "good" | "ok" | "weak" | "offline"; text: string } {
  if (!online) return { level: "offline", text: "Internet yo'q. Ulanishni tekshiring." };
  if (rttMs === null) return { level: "ok", text: "Internet sifatini aniqlab bo'lmadi." };
  if (rttMs < 200) return { level: "good", text: "Internet yaxshi." };
  if (rttMs < 500) return { level: "ok", text: "Internet o'rtacha: video sekin bo'lishi mumkin." };
  return { level: "weak", text: "Internet zaif: kamerani o'chirib kirish tavsiya etiladi." };
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
export type SavedRoom = { code: string; title: string; at: number; startsAt?: number };
export const ROOMS_KEY = "u360-dars-rooms";
export const NAME_KEY = "u360-dars-name";

export function parseSavedRooms(raw: string | null): SavedRoom[] {
  if (!raw) return [];
  try {
    const v: unknown = JSON.parse(raw);
    if (!Array.isArray(v)) return [];
    return v
      .filter((r): r is SavedRoom => !!r && isRoomCode((r as SavedRoom).code) && typeof (r as SavedRoom).at === "number")
      .map((r) => ({ code: r.code, title: cleanTitle(r.title), at: r.at, ...(typeof r.startsAt === "number" && { startsAt: r.startsAt }) }))
      .slice(0, 10);
  } catch {
    return [];
  }
}

export function addSavedRoom(list: SavedRoom[], room: SavedRoom): SavedRoom[] {
  return [room, ...list.filter((r) => r.code !== room.code)].slice(0, 10);
}
