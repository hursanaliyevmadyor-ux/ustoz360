import { hasVideo, isFree, isVoiceMode, type VoiceMode } from "./voice-mode";
import { isSubject } from "./subjects";
/**
 * Dars xonasi: umumiy yordamchilar (kod, havola, vaqt, taklif matni). Xona saytimiz ichida LiveKit orqali ishlaydi;
 * xona kodi va imzolari serverda hosil bo'ladi (src/server/voicelogic.ts).
 */

/** O'xshash belgilarsiz (i, l, o, 0, 1): og'zaki aytganda adashmaslik uchun. */
export const ROOM_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";
export const ROOM_CODE_LEN = 10;

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

export const cleanTitle = (s: unknown, max = 80) => (typeof s === "string" ? s.replace(/\s+/g, " ").trim().slice(0, max) : "");
export const cleanName = (s: unknown) => (typeof s === "string" ? s.replace(/\s+/g, " ").trim().slice(0, 40) : "");

/** Xona havolasidagi rejim (s, e = video; q, o = ovozli chat; voice-mode.ts) va imzolar. `h` faqat ustoz havolasida. */
export type VoiceLink = { mode: VoiceMode; k: string; h?: string };

/** Ulashiladigan qisqa havola: /d/<kod>?t=<dars nomi>&s=<boshlanish vaqti>&r=<rejim>&k=<imzo> (ustozda qo'shimcha h). */
export function joinUrl(origin: string, code: string, title?: string, asTeacher = false, startsAt?: number | null, voice?: VoiceLink | null, subject?: string | null): string {
  const p = new URLSearchParams();
  const t = cleanTitle(title);
  if (t) p.set("t", t);
  if (startsAt) p.set("s", String(Math.round(startsAt)));
  if (voice) { p.set("r", voice.mode); p.set("k", voice.k); if (asTeacher && voice.h) p.set("h", voice.h); }
  if (subject && isSubject(subject)) p.set("f", subject);
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
export function inviteText(o: { title?: string; startsAt?: number | null; link: string; mode?: VoiceMode | null }): string {
  const t = cleanTitle(o.title);
  const audio = !!o.mode && !hasVideo(o.mode);
  const how = !o.mode
    ? ""
    : audio
      ? isFree(o.mode)
        ? "Faqat ovoz, kamera kerak emas. Hamma gapira oladi: gapirmasangiz mikrofonni o'chirib turing."
        : "Faqat ovoz, kamera kerak emas. Gapirmoqchi bo'lsangiz, «Qo'l ko'tarish» tugmasini bosing: ustoz ruxsat bergach mikrofoningiz yoqiladi."
      : isFree(o.mode)
        ? "Hamma gapira oladi: gapirmasangiz mikrofonni o'chirib turing."
        : "Ustozni ko'rasiz va eshitasiz. Gapirmoqchi bo'lsangiz, «Qo'l ko'tarish» tugmasini bosing: ustoz ruxsat bergach mikrofon va kamerangiz yoqiladi.";
  return [
    `${audio ? "Ovozli chat" : "Onlayn dars"}${t ? `: ${t}` : ""}`,
    ...(o.startsAt ? [`Boshlanishi: ${lessonTimeLabel(o.startsAt)}`] : []),
    "",
    "Darsga kirish uchun havolani bosing:",
    o.link,
    "",
    "Qanday kiriladi: havolani bosing, ismingizni yozing va «Darsga kirish» ni bosing. Quloqchin taqsangiz yaxshi.",
    ...(how ? [how] : []),
    "Telegram ichida ochilmasa, havolani Chrome yoki Safari'da oching.",
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

/**
 * Havolani tashqi brauzerda ochish manzili (Telegram ichida kamera va mikrofon ishlamasligi mumkin):
 * Android uchun Chrome "intent" havolasi (ochilmasa, oddiy havolaga qaytadi), iPhone uchun Safari havolasi. Boshqa qurilmada null.
 */
export function externalBrowserUrl(url: string, ua: string): string | null {
  let u: URL;
  try { u = new URL(url); } catch { return null; }
  if (u.protocol !== "https:" && u.protocol !== "http:") return null;
  if (/Android/i.test(ua)) return `intent://${u.host}${u.pathname}${u.search}#Intent;scheme=${u.protocol.slice(0, -1)};package=com.android.chrome;S.browser_fallback_url=${encodeURIComponent(u.toString())};end`;
  if (/iPhone|iPad|iPod/i.test(ua)) return `x-safari-${u.toString()}`;
  return null;
}

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
export type SavedRoom = { code: string; title: string; at: number; startsAt?: number; subject?: string; voice: { mode: VoiceMode; k: string; h: string } };
export const ROOMS_KEY = "u360-dars-rooms";
export const NAME_KEY = "u360-dars-name";

const validVoice = (v: unknown): v is NonNullable<SavedRoom["voice"]> =>
  !!v && typeof v === "object" && isVoiceMode((v as { mode?: unknown }).mode) && typeof (v as { k?: unknown }).k === "string" && typeof (v as { h?: unknown }).h === "string";

export function parseSavedRooms(raw: string | null): SavedRoom[] {
  if (!raw) return [];
  try {
    const v: unknown = JSON.parse(raw);
    if (!Array.isArray(v)) return [];
    // Eski (Jitsi) xonalar imzosiz saqlangan edi: ular endi ishlamaydi, ro'yxatga olinmaydi.
    return v
      .filter((r): r is SavedRoom => !!r && isRoomCode((r as SavedRoom).code) && typeof (r as SavedRoom).at === "number" && validVoice((r as SavedRoom).voice))
      .map((r) => ({ code: r.code, title: cleanTitle(r.title), at: r.at, ...(typeof r.startsAt === "number" && { startsAt: r.startsAt }), ...(isSubject(r.subject) && { subject: r.subject }), voice: r.voice }))
      .slice(0, 10);
  } catch {
    return [];
  }
}

export function addSavedRoom(list: SavedRoom[], room: SavedRoom): SavedRoom[] {
  return [room, ...list.filter((r) => r.code !== room.code)].slice(0, 10);
}
