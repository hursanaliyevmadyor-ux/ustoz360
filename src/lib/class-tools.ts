/**
 * Dars asboblari (so'rovnoma, taymer, tasodifiy o'quvchi, materiallar, "tushundingizmi?", chatni to'xtatish, doska holati):
 * hammasi ustoz brauzerida turadi va LiveKit ma'lumot kanalida o'quvchilarga yuboriladi. Bazaga hech narsa yozilmaydi.
 * Bu fayl toza funksiyalar: shakllarni tekshirish, hisoblash, matn tayyorlash. Tarmoqqa va brauzerga tegmaydi.
 */
import { isBg, type Bg } from "./board";

export const MAX_Q = 200;
export const MAX_OPT = 80;
export const MIN_OPTS = 2;
export const MAX_OPTS = 5;
export const MAX_MATS = 10;
export const MAX_TITLE = 80;
export const MAX_URL = 300;
export const MAX_TIMER_SEC = 3 * 3600;
export const MAX_DRAWERS = 4;
export const OPT_LETTERS = ["A", "B", "C", "D", "E"] as const;

export type Poll = { id: number; q: string; opts: string[]; open: boolean; show: boolean; correct: number | null; counts: number[] | null };
export type Material = { id: number; title: string; url: string };
export type ClassState = {
  lock: boolean; // chat o'quvchilar uchun to'xtatilgan
  stage: "auto" | "board"; // sahnada nima: video/ekran yoki doska
  bg: Bg; // doskaning orqa foni
  draw: string[]; // ustoz doskaga chaqirgan o'quvchilar (identity)
  timer: { left: number; total: number } | null; // soniyada; `left` yuborilgan paytdagi qoldiq
  pick: { id: number; name: string; who: string } | null; // tasodifiy tanlangan o'quvchi (who = uning identity)
  mats: Material[];
  poll: Poll | null;
  pulse: { id: number } | null; // "tushundingizmi?" so'rovi ochiq
};
export const emptyClass = (): ClassState => ({ lock: false, stage: "auto", bg: "plain", draw: [], timer: null, pick: null, mats: [], poll: null, pulse: null });

/** O'quvchidan ustozga keladigan javoblar. */
export type Act = { t: "vote"; poll: number; o: number } | { t: "pulse"; id: number; v: 0 | 1 | 2 };
export const PULSE = [
  { v: 0, label: "Tushundim", tone: "success" },
  { v: 1, label: "Sekinroq", tone: "amber" },
  { v: 2, label: "Tushunmadim", tone: "danger" },
] as const;

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const int = (v: unknown, min: number, max: number): number | null => (typeof v === "number" && Number.isInteger(v) && v >= min && v <= max ? v : null);
// eslint-disable-next-line no-control-regex
const text = (v: unknown, max: number): string => (typeof v === "string" ? v.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, max) : "");

/** Havolani tekshiradi: faqat http/https, parolsiz, nuqtali domen. `example.uz/x` ko'rinishiga https:// qo'shiladi. Yaroqsiz bo'lsa null. */
export function cleanUrl(input: unknown): string | null {
  if (typeof input !== "string") return null;
  let s = input.trim();
  if (!s || s.length > MAX_URL || /\s/.test(s)) return null;
  if (!/^[a-z][a-z0-9+.-]*:/i.test(s)) s = `https://${s}`;
  try {
    const u = new URL(s);
    if (u.protocol !== "https:" && u.protocol !== "http:") return null;
    if (u.username || u.password || !u.hostname.includes(".")) return null;
    return u.toString().slice(0, MAX_URL * 2);
  } catch {
    return null;
  }
}

/** Ustoz yaratgan so'rovnomani tekshiradi; yaroqsiz bo'lsa null. */
export function makePoll(id: number, q: string, opts: string[], correct: number | null): Poll | null {
  const question = text(q, MAX_Q);
  // To'g'ri javob indeksi bo'sh variantlar olib tashlangandan keyin ham o'sha variantga ishora qilsin.
  const keep = opts.map((o, i) => ({ o: text(o, MAX_OPT), i })).filter((x) => x.o);
  if (!question || keep.length < MIN_OPTS || keep.length > MAX_OPTS) return null;
  const c = correct === null ? null : keep.findIndex((x) => x.i === correct);
  return { id, q: question, opts: keep.map((x) => x.o), open: true, show: false, correct: c === null || c < 0 ? null : c, counts: null };
}

/** Ovozlarni sanaydi (har bir ishtirokchining oxirgi ovozi); xonada yo'q bo'lganlar sanalmaydi (`present` berilsa). */
export function pollCounts(optCount: number, votes: ReadonlyMap<string, number>, present?: ReadonlySet<string>): number[] {
  const out = new Array<number>(optCount).fill(0);
  for (const [who, o] of votes) if ((!present || present.has(who)) && o >= 0 && o < optCount) out[o] = (out[o] ?? 0) + 1;
  return out;
}

function parsePoll(v: unknown): Poll | null {
  if (!isObj(v)) return null;
  const id = int(v.id, 0, 2 ** 31), q = text(v.q, MAX_Q);
  if (id === null || !q || !Array.isArray(v.opts)) return null;
  const opts = v.opts.slice(0, MAX_OPTS).map((o) => text(o, MAX_OPT));
  if (opts.length < MIN_OPTS || opts.some((o) => !o)) return null;
  const correct = v.correct === null || v.correct === undefined ? null : int(v.correct, 0, opts.length - 1);
  const counts = Array.isArray(v.counts) && v.counts.length === opts.length && v.counts.every((n) => int(n, 0, 100000) !== null) ? (v.counts as number[]) : null;
  return { id, q, opts, open: v.open === true, show: v.show === true, correct, counts };
}

/** Ustozdan kelgan holatni tekshiradi va tozalaydi. Buzilgan bo'lsa null (hech qachon xato tashlamaydi). */
export function parseClass(v: unknown): ClassState | null {
  if (!isObj(v)) return null;
  const mats: Material[] = [];
  if (Array.isArray(v.mats)) {
    for (const m of v.mats.slice(0, MAX_MATS)) {
      if (!isObj(m)) continue;
      const id = int(m.id, 0, 2 ** 31), url = cleanUrl(m.url), title = text(m.title, MAX_TITLE);
      if (id !== null && url) mats.push({ id, title: title || url, url });
    }
  }
  const t = isObj(v.timer) ? { left: int(v.timer.left, 0, MAX_TIMER_SEC), total: int(v.timer.total, 1, MAX_TIMER_SEC) } : null;
  const pk = isObj(v.pick) ? { id: int(v.pick.id, 0, 2 ** 31), name: text(v.pick.name, 40), who: text(v.pick.who, 64) } : null;
  const pu = isObj(v.pulse) ? int(v.pulse.id, 0, 2 ** 31) : null;
  return {
    lock: v.lock === true,
    stage: v.stage === "board" ? "board" : "auto",
    bg: isBg(v.bg) ? v.bg : "plain",
    draw: Array.isArray(v.draw) ? [...new Set(v.draw.map((x) => text(x, 64)).filter(Boolean))].slice(0, MAX_DRAWERS) : [],
    timer: t && t.left !== null && t.total !== null ? { left: t.left, total: t.total } : null,
    pick: pk && pk.id !== null && pk.name ? { id: pk.id, name: pk.name, who: pk.who } : null,
    mats,
    poll: v.poll === null || v.poll === undefined ? null : parsePoll(v.poll),
    pulse: pu === null ? null : { id: pu },
  };
}

/** O'quvchining javobini tekshiradi; yaroqsiz bo'lsa null. */
export function parseAct(v: unknown): Act | null {
  if (!isObj(v)) return null;
  if (v.t === "vote") {
    const poll = int(v.poll, 0, 2 ** 31), o = int(v.o, 0, MAX_OPTS - 1);
    return poll !== null && o !== null ? { t: "vote", poll, o } : null;
  }
  if (v.t === "pulse") {
    const id = int(v.id, 0, 2 ** 31), x = int(v.v, 0, 2);
    return id !== null && x !== null ? { t: "pulse", id, v: x as 0 | 1 | 2 } : null;
  }
  return null;
}

/** Tasodifiy o'quvchi: avval tanlanmaganlar orasidan; hamma tanlangan bo'lsa, aylanma yangidan boshlanadi (`reset`). */
export function pickRandom<T extends { identity: string }>(candidates: readonly T[], done: ReadonlySet<string>, rnd: () => number): { pick: T; reset: boolean } | null {
  if (candidates.length === 0) return null;
  const fresh = candidates.filter((c) => !done.has(c.identity));
  const pool = fresh.length ? fresh : candidates;
  const i = Math.min(pool.length - 1, Math.floor(rnd() * pool.length));
  return { pick: pool[i]!, reset: fresh.length === 0 };
}

/** 04:07 ko'rinishidagi taymer matni. */
export const fmtTimer = (sec: number): string => {
  const s = Math.max(0, Math.ceil(sec));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
};

/** 14:05 ko'rinishidagi soat (mahalliy vaqt). */
export const fmtClock = (ts: number): string => { const d = new Date(ts); return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`; };

/** Davomat: kim qachon kirgan. `last` bo'sh bo'lsa, hozir xonada. */
export type Seen = { identity: string; name: string; first: number; last: number | null };

export function attendanceText(title: string, rows: readonly Seen[], now: number): string {
  const d = new Date(now);
  const date = `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.${d.getFullYear()}`;
  const lines = rows.map((r, i) => `${i + 1}. ${r.name}: kirdi ${fmtClock(r.first)}${r.last ? `, chiqdi ${fmtClock(r.last)}` : ""}`);
  return [`Davomat${title ? `: ${title}` : ""}`, date, `Qatnashdi: ${rows.length}`, "", ...lines].join("\n");
}

const csvCell = (s: string) => {
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s; // jadval dasturida formula sifatida bajarilmasin
  return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};
export function attendanceCsv(rows: readonly Seen[]): string {
  return ["№,Ism,Kirdi,Chiqdi", ...rows.map((r, i) => [String(i + 1), csvCell(r.name), fmtClock(r.first), r.last ? fmtClock(r.last) : "xonada"].join(","))].join("\n");
}
