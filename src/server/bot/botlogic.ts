import { addDays, isIsoDate } from "../planlogic";

/** Bot uchun sof yordamchilar: bazaga va Telegram'ga bog'liq emas, birlik testlari bilan tekshiriladi. */

/** Telegram HTML rejimi uchun maxsus belgilarni xavfsiz qiladi. Foydalanuvchi yoki AI matni har doim shu orqali o'tadi. */
export const esc = (s: unknown) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Matnni uzunligi bo'yicha qisqartiradi (so'z o'rtasida emas, iloji boricha). */
export function clip(s: string, n: number): string {
  const t = s.replace(/\s+/g, " ").trim();
  if (t.length <= n) return t;
  const cut = t.slice(0, n - 1);
  const sp = cut.lastIndexOf(" ");
  return `${(sp > n * 0.6 ? cut.slice(0, sp) : cut).trimEnd()}…`;
}

/** "2026-11-05" -> "05.11.2026". */
export const fmtDate = (iso: string) => (/^\d{4}-\d{2}-\d{2}/.test(iso) ? iso.slice(0, 10).split("-").reverse().join(".") : iso);

const MONTHS = ["yanvar", "fevral", "mart", "aprel", "may", "iyun", "iyul", "avgust", "sentyabr", "oktyabr", "noyabr", "dekabr"];
const WEEK = ["yakshanba", "dushanba", "seshanba", "chorshanba", "payshanba", "juma", "shanba"];

/** "2026-11-05" -> "5-noyabr, payshanba". */
export function dayLabel(iso: string): string {
  const d = new Date(iso.slice(0, 10) + "T00:00:00Z");
  if (Number.isNaN(d.getTime())) return iso;
  return `${d.getUTCDate()}-${MONTHS[d.getUTCMonth()]}, ${WEEK[d.getUTCDay()]}`;
}

/** Toshkent vaqti (UTC+5) bo'yicha: "5-noyabr, payshanba, 14:30". */
export function fmtWhen(d: Date | string): string {
  const t = new Date(typeof d === "string" ? d : d.toISOString());
  if (Number.isNaN(t.getTime())) return "";
  const local = new Date(t.getTime() + 5 * 3_600_000);
  const iso = local.toISOString();
  return `${dayLabel(iso.slice(0, 10))}, ${iso.slice(11, 16)}`;
}

/** Foizni ko'rinadigan chiziqqa aylantiradi: 70% -> "▓▓▓▓▓▓▓░░░". */
export function bar(percent: number, cells = 10): string {
  const n = Math.max(0, Math.min(cells, Math.round((percent / 100) * cells)));
  return "▓".repeat(n) + "░".repeat(cells - n);
}

/**
 * Foydalanuvchi yozgan sanani YYYY-MM-DD ga keltiradi. Qabul qilinadi: bugun, ertaga, indinga, 2026-11-05, 05.11.2026, 5.11.26, 05/11/2026.
 * Noto'g'ri yoki mavjud bo'lmagan sana uchun null.
 */
export function parseDate(input: string, today: string): string | null {
  const s = input.trim().toLowerCase().replace(/[’‘ʻʼ`´]/g, "'");
  if (s === "bugun") return today;
  if (s === "ertaga") return addDays(today, 1);
  if (s === "indinga" || s === "ertadan keyin") return addDays(today, 2);
  if (isIsoDate(s)) return s;
  const m = s.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2}|\d{4})$/);
  if (!m) return null;
  const year = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
  const iso = `${year}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  return isIsoDate(iso) ? iso : null;
}

export type Pupil = { id: string; alias: string };

/**
 * Sinf ballari matnini o'qiydi. Har qatorda "tartib raqami yoki taxallus" va ball: "3 18", "Aziz: 17,5", "Madina=20".
 * Faqat raqamlardan iborat qatorlar soni o'quvchilar soniga teng bo'lsa, tartib bilan taqsimlanadi.
 * Natija: studentId -> ball va o'qilmagan qatorlar ro'yxati.
 */
export function parseScores(text: string, pupils: Pupil[], max: number): { scores: Record<string, number>; bad: string[] } {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const scores: Record<string, number> = {};
  const bad: string[] = [];
  const num = (v: string) => Number(v.replace(",", "."));
  const ok = (n: number) => Number.isFinite(n) && n >= 0 && n <= max;

  if (lines.length === pupils.length && lines.length > 0 && lines.every((l) => /^\d+(?:[.,]\d+)?$/.test(l))) {
    lines.forEach((l, i) => { const n = num(l); if (ok(n)) scores[pupils[i].id] = n; else bad.push(l); });
    return { scores, bad };
  }
  for (const line of lines) {
    const m = line.match(/^(.+?)[\s:=]+(-?\d+(?:[.,]\d+)?)$/);
    if (!m) { bad.push(line); continue; }
    const key = m[1].trim().replace(/[.)]$/, ""), n = num(m[2]);
    let pupil: Pupil | undefined;
    if (/^\d+$/.test(key)) pupil = pupils[Number(key) - 1];
    else {
      const k = key.toLowerCase();
      pupil = pupils.find((p) => p.alias.toLowerCase() === k);
      if (!pupil) { const starts = pupils.filter((p) => p.alias.toLowerCase().startsWith(k)); if (starts.length === 1) pupil = starts[0]; }
    }
    if (!pupil || !ok(n)) { bad.push(line); continue; }
    scores[pupil.id] = n;
  }
  return { scores, bad };
}

/** Uzun matnni Telegram chegarasiga (4096) mos bo'laklarga bo'ladi: avval bo'sh qator, keyin qator, keyin so'z bo'yicha. */
export function splitText(text: string, size = 3800): string[] {
  const out: string[] = [];
  let rest = text.trim();
  while (rest.length > size) {
    let cut = rest.lastIndexOf("\n\n", size);
    if (cut < size * 0.4) cut = rest.lastIndexOf("\n", size);
    if (cut < size * 0.4) cut = rest.lastIndexOf(" ", size);
    if (cut < size * 0.4) cut = size;
    out.push(rest.slice(0, cut).trimEnd());
    rest = rest.slice(cut).trimStart();
  }
  if (rest) out.push(rest);
  return out;
}

/** Telefon va tashqi havolalar uchun: faqat http(s) havolasi inline tugmada ruxsat etiladi. */
export const safeUrl = (u: string | null | undefined): string | null => (u && /^https?:\/\/\S+$/i.test(u.trim()) ? u.trim() : null);

/** Sinf taxalluslari (o'quvchi ismi emas): vergul, nuqtali vergul yoki yangi qator bilan ajratilgan ro'yxatni tozalaydi. */
export const splitAliases = (text: string) => Array.from(new Set(text.split(/[\n,;]+/).map((a) => a.trim()).filter(Boolean)));

/** Ism-familiya: kamida ikki so'z, faqat harflar va ' - . belgilari (emoji, raqam va menyu tugmalari matni ism bo'lib qolmasin). Tozalangan ism yoki null. */
export function personName(raw: string): string | null {
  const s = raw.trim().replace(/\s+/g, " ");
  if (s.length < 3 || s.length > 80 || !/^[\p{L}'’ʻʼ`.\- ]+$/u.test(s)) return null;
  return s.split(" ").filter((w) => /\p{L}/u.test(w)).length >= 2 ? s : null;
}

/** callback_data: Telegram chegarasi 64 bayt. */
export const cbOk = (data: string) => Buffer.byteLength(data, "utf8") <= 64;
