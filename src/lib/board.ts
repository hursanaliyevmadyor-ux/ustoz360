/**
 * Doska: ustoz (va ustoz chaqirgan o'quvchi) chizadi, hamma ko'radi. Chiziqlar ustoz brauzerida turadi va LiveKit ma'lumot kanalida
 * ("board" topic) yuboriladi; keyin kirganga ustoz hozirgi doskani (barcha sahifalar bilan) qayta yuboradi. Bazaga yozilmaydi.
 * Koordinatalar doska o'lchamidan mustaqil: x 0..10000 (kengligi), y 0..5625 (balandligi, 16:9).
 * Toza mantiq: brauzerga tegmaydi, shuning uchun sinab ko'riladi.
 */
export const BOARD_X = 10000;
export const BOARD_Y = 5625;
export const COLORS = ["#111827", "#ffffff", "#1d4ed8", "#dc2626", "#16a34a", "#d97706", "#7c3aed", "#db2777"] as const;
export const COLOR_NAMES = ["Qora", "Oq", "Ko'k", "Qizil", "Yashil", "To'q sariq", "Binafsha", "Pushti"] as const;
/** Qalamning qalinligi (1600 pikselli doskada, pikselda). Marker 3 baravar, o'chirg'ich 4 baravar keng. */
export const WIDTHS = [3, 6, 12, 22] as const;
export const WIDTH_NAMES = ["Juda ingichka", "Ingichka", "O'rta", "Qalin"] as const;
/** Asboblar: 0 qalam, 1 marker, 2 o'chirg'ich, 3 chiziq, 4 strelka, 5 to'rtburchak, 6 ellips, 7 matn. */
export const KIND = { pen: 0, hl: 1, eraser: 2, line: 3, arrow: 4, rect: 5, ellipse: 6, text: 7 } as const;
export const isFreehand = (k: number) => k <= 2;
export const isShape = (k: number) => k >= 3 && k <= 6;
/** Matn o'lchamlari (1600 pikselli doskada shrift balandligi). */
export const FONT_SIZES = [28, 44, 68, 104] as const;
export const BGS = ["plain", "grid", "lines", "dots", "axes", "dark"] as const;
export type Bg = (typeof BGS)[number];
export const BG_NAMES: Record<Bg, string> = { plain: "Oq", grid: "Katak", lines: "Chiziqli", dots: "Nuqtali", axes: "Koordinata", dark: "Qora doska" };
export const isBg = (v: unknown): v is Bg => typeof v === "string" && (BGS as readonly string[]).includes(v);
export const MAX_PAGES = 20;
export const MAX_STROKES = 400; // bir sahifada
export const MAX_NUMS = 60000; // hamma sahifalarda jami nuqta sonlari (x va y alohida sanaladi)
export const MAX_MSG_NUMS = 400;
export const MAX_TEXT = 300;
const BUNDLE_BYTES = 9000;

export type Stroke = { id: number; k: number; c: number; w: number; p: number[]; s?: string };
export type BoardMsg =
  | { t: "b"; id: number; k: number; c: number; w: number; p: number[]; r?: 1; s?: string } // chiziqqa nuqta qo'shadi (r: shakl uchun almashtiradi; s: matn)
  | { t: "u" } // joriy sahifada oxirgi chiziqni bekor qilish
  | { t: "x" } // joriy sahifani tozalash
  | { t: "pa" } // yangi sahifa qo'shish va unga o'tish
  | { t: "pg"; i: number } // sahifaga o'tish
  | { t: "pd" } // joriy sahifani o'chirish
  | { t: "im"; id: number } // joriy sahifaga rasm qo'yish (0: olib tashlash)
  | { t: "rs" } // hammasini boshidan (bitta bo'sh sahifa)
  | { t: "m"; l: BoardMsg[] } // bir nechta xabar bir paketda
  | { t: "l"; x?: number; y?: number }; // lazer ko'rsatkich (vaqtinchalik, saqlanmaydi); koordinatasiz: o'chdi

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const int = (v: unknown, min: number, max: number): number | null => (typeof v === "number" && Number.isInteger(v) && v >= min && v <= max ? v : null);
// eslint-disable-next-line no-control-regex
const cleanText = (v: unknown): string => (typeof v === "string" ? v.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "").slice(0, MAX_TEXT) : "");

/** Nuqtalarni tekshiradi: juft son, har biri o'z oralig'ida. Yaroqsiz bo'lsa null. */
function points(v: unknown, max: number): number[] | null {
  if (!Array.isArray(v) || v.length === 0 || v.length % 2 !== 0 || v.length > max) return null;
  const out: number[] = [];
  for (let i = 0; i < v.length; i += 2) {
    const x = int(v[i], 0, BOARD_X), y = int(v[i + 1], 0, BOARD_Y);
    if (x === null || y === null) return null;
    out.push(x, y);
  }
  return out;
}

/** Bitta chiziq/shakl/matnni tekshiradi (xabar ichidagi va snapshot ichidagi). */
function strokeLike(v: Record<string, unknown>, maxNums: number): { id: number; k: number; c: number; w: number; p: number[]; s?: string } | null {
  const id = int(v.id, 0, 2 ** 31), k = int(v.k, 0, 7), c = int(v.c, 0, COLORS.length - 1), w = int(v.w, 0, WIDTHS.length - 1);
  if (id === null || k === null || c === null || w === null) return null;
  const p = points(v.p, maxNums);
  if (!p) return null;
  if (isShape(k)) return p.length === 4 ? { id, k, c, w, p } : null;
  if (k === KIND.text) {
    const s = cleanText(v.s);
    return p.length === 2 && s.trim() ? { id, k, c, w, p, s } : null;
  }
  return { id, k, c, w, p };
}

/** Kelgan doska xabarini tekshiradi; yaroqsiz bo'lsa null (hech qachon xato tashlamaydi). */
export function parseBoard(v: unknown, depth = 0): BoardMsg | null {
  if (!isObj(v)) return null;
  switch (v.t) {
    case "u": return { t: "u" };
    case "x": return { t: "x" };
    case "pa": return { t: "pa" };
    case "pd": return { t: "pd" };
    case "rs": return { t: "rs" };
    case "pg": { const i = int(v.i, 0, MAX_PAGES - 1); return i === null ? null : { t: "pg", i }; }
    case "im": { const id = int(v.id, 0, 2 ** 31); return id === null ? null : { t: "im", id }; }
    case "l": {
      if (v.x === undefined && v.y === undefined) return { t: "l" };
      const x = int(v.x, 0, BOARD_X), y = int(v.y, 0, BOARD_Y);
      return x === null || y === null ? null : { t: "l", x, y };
    }
    case "b": {
      const s = strokeLike(v, MAX_MSG_NUMS);
      return s ? { t: "b", ...s, ...(v.r === 1 && isShape(s.k) && { r: 1 as const }) } : null;
    }
    case "m": {
      if (depth > 0 || !Array.isArray(v.l) || v.l.length === 0 || v.l.length > 400) return null;
      const l: BoardMsg[] = [];
      for (const x of v.l) { const m = parseBoard(x, depth + 1); if (!m) return null; l.push(m); }
      return { t: "m", l };
    }
    default: return null;
  }
}

type Page = { strokes: Stroke[]; nums: number; img: number };
const emptyPage = (): Page => ({ strokes: [], nums: 0, img: 0 });
const strokeNums = (s: Stroke) => s.p.length;

/** Doskadagi sahifalar va chiziqlar. Ustozda ham, o'quvchida ham bir xil xabarlar bilan yangilanadi. */
export class BoardStore {
  pages: Page[] = [emptyPage()];
  cur = 0;
  private laserFns = new Set<(m: { x: number; y: number } | null) => void>();

  get page(): Page { return this.pages[this.cur]!; }
  get strokes(): Stroke[] { return this.page.strokes; }
  get image(): number { return this.page.img; }
  private get totalNums() { return this.pages.reduce((a, p) => a + p.nums, 0); }
  /** Doska to'ldimi (yangi chiziq chizib bo'lmaydi). */
  get full() { return this.totalNums >= MAX_NUMS - 4; }

  /** Lazer ko'rsatkichni tinglash (ichki: chizilmaydi, saqlanmaydi). */
  onLaser(fn: (m: { x: number; y: number } | null) => void) { this.laserFns.add(fn); return () => { this.laserFns.delete(fn); }; }

  /** Xabarni qo'llaydi; doska o'zgargan bo'lsa true. Chegaradan oshsa, ortiqcha qism tashlanadi. */
  apply(m: BoardMsg): boolean {
    switch (m.t) {
      case "l": for (const f of this.laserFns) f(m.x === undefined || m.y === undefined ? null : { x: m.x, y: m.y }); return false;
      case "m": { let ch = false; for (const x of m.l) ch = this.apply(x) || ch; return ch; }
      case "rs": this.pages = [emptyPage()]; this.cur = 0; return true;
      case "x": { const p = this.page; const had = p.strokes.length > 0; p.strokes = []; p.nums = 0; return had; }
      case "u": { const p = this.page; const s = p.strokes.pop(); if (s) p.nums -= strokeNums(s); return !!s; }
      case "pa": {
        if (this.pages.length >= MAX_PAGES) return false;
        this.pages.splice(this.cur + 1, 0, emptyPage());
        this.cur++;
        return true;
      }
      case "pg": { const i = Math.min(m.i, this.pages.length - 1); if (i === this.cur) return false; this.cur = i; return true; }
      case "pd": {
        if (this.pages.length <= 1) return false;
        this.pages.splice(this.cur, 1);
        this.cur = Math.min(this.cur, this.pages.length - 1);
        return true;
      }
      case "im": { if (this.page.img === m.id) return false; this.page.img = m.id; return true; }
      case "b": return this.applyStroke(m);
    }
  }

  private applyStroke(m: Extract<BoardMsg, { t: "b" }>): boolean {
    const page = this.page;
    let s: Stroke | undefined = page.strokes[page.strokes.length - 1];
    if (!s || s.id !== m.id) s = page.strokes.find((x) => x.id === m.id);
    if (!s) {
      s = { id: m.id, k: m.k, c: m.c, w: m.w, p: [] };
      page.strokes.push(s);
      while (page.strokes.length > MAX_STROKES) { const d = page.strokes.shift(); if (d) page.nums -= strokeNums(d); }
    }
    if (m.s !== undefined) s.s = m.s;
    if (m.r) { // shakl: nuqtalarni almashtiradi
      const diff = m.p.length - s.p.length;
      if (this.totalNums + diff > MAX_NUMS) return false;
      page.nums += diff;
      s.p = [...m.p];
      return true;
    }
    const room = MAX_NUMS - this.totalNums;
    if (room <= 0) return false;
    const add = m.p.length <= room ? m.p : m.p.slice(0, room - (room % 2));
    if (add.length === 0) return false;
    s.p.push(...add);
    page.nums += add.length;
    return true;
  }

  /** Bitta chiziqni qayta chizish uchun xabarlar (qayta qilish va snapshot uchun). */
  static strokeMsgs(s: Stroke): BoardMsg[] {
    if (!isFreehand(s.k)) return [{ t: "b", id: s.id, k: s.k, c: s.c, w: s.w, p: [...s.p], ...(isShape(s.k) && { r: 1 as const }), ...(s.s !== undefined && { s: s.s }) }];
    const out: BoardMsg[] = [];
    for (let i = 0; i < s.p.length; i += MAX_MSG_NUMS) out.push({ t: "b", id: s.id, k: s.k, c: s.c, w: s.w, p: s.p.slice(i, i + MAX_MSG_NUMS) });
    return out;
  }

  /** Keyin kirgan o'quvchi uchun hozirgi doska: bo'sh doskadan boshlab qayta chizadigan xabarlar, paketlarga o'ralgan (har biri ~9 KB dan oshmaydi). */
  snapshot(): BoardMsg[] {
    const flat: BoardMsg[] = [{ t: "rs" }];
    this.pages.forEach((p, i) => {
      if (i > 0) flat.push({ t: "pa" });
      if (p.img) flat.push({ t: "im", id: p.img });
      for (const s of p.strokes) flat.push(...BoardStore.strokeMsgs(s));
    });
    if (this.cur !== this.pages.length - 1) flat.push({ t: "pg", i: this.cur });
    const out: BoardMsg[] = [];
    let group: BoardMsg[] = [], size = 0;
    for (const m of flat) {
      const bytes = JSON.stringify(m).length + 1;
      if (group.length && size + bytes > BUNDLE_BYTES) { out.push({ t: "m", l: group }); group = []; size = 0; }
      group.push(m); size += bytes;
    }
    if (group.length) out.push({ t: "m", l: group });
    return out;
  }
}

/** Shakl chizayotganda Shift bosilsa: chiziq 45 gradusga yaxlitlanadi, to'rtburchak kvadrat, ellips aylana bo'ladi. (x0,y0) boshlang'ich, (x,y) hozirgi nuqta. */
export function constrainShape(k: number, x0: number, y0: number, x: number, y: number): [number, number] {
  const dx = x - x0, dy = y - y0;
  if (k === KIND.rect || k === KIND.ellipse) {
    const d = Math.max(Math.abs(dx), Math.abs(dy));
    return [x0 + Math.sign(dx || 1) * d, y0 + Math.sign(dy || 1) * d];
  }
  if (k === KIND.line || k === KIND.arrow) {
    const len = Math.hypot(dx, dy);
    if (len === 0) return [x, y];
    const a = Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) * (Math.PI / 4);
    return [Math.round(x0 + Math.cos(a) * len), Math.round(y0 + Math.sin(a) * len)];
  }
  return [x, y];
}

/** Orqa fon (CSS gradient bilan ekranda, `drawBg` bilan rasmga saqlashda chiziladi). */
export function bgStyle(bg: Bg): { backgroundColor: string; backgroundImage?: string; backgroundSize?: string; backgroundPosition?: string } {
  const line = "rgba(148,163,184,0.55)";
  switch (bg) {
    case "grid": return { backgroundColor: "#ffffff", backgroundImage: `linear-gradient(to right, ${line} 1px, transparent 1px), linear-gradient(to bottom, ${line} 1px, transparent 1px)`, backgroundSize: "3.125% 5.5556%" };
    case "lines": return { backgroundColor: "#ffffff", backgroundImage: `linear-gradient(to bottom, transparent calc(100% - 1px), ${line} 1px)`, backgroundSize: "100% 8.3333%" };
    case "dots": return { backgroundColor: "#ffffff", backgroundImage: "radial-gradient(circle, rgba(100,116,139,0.8) 1.4px, transparent 1.6px)", backgroundSize: "3.125% 5.5556%", backgroundPosition: "1.5625% 2.7778%" };
    case "axes": return { backgroundColor: "#ffffff", backgroundImage: `linear-gradient(to right, transparent calc(50% - 1px), #0f172a calc(50% - 1px), #0f172a calc(50% + 1px), transparent calc(50% + 1px)), linear-gradient(to bottom, transparent calc(50% - 1px), #0f172a calc(50% - 1px), #0f172a calc(50% + 1px), transparent calc(50% + 1px)), linear-gradient(to right, ${line} 1px, transparent 1px), linear-gradient(to bottom, ${line} 1px, transparent 1px)`, backgroundSize: "100% 100%, 100% 100%, 3.125% 5.5556%, 3.125% 5.5556%", backgroundPosition: "0 0, 0 0, 50% 50%, 50% 50%" };
    case "dark": return { backgroundColor: "#1f3a2f" };
    default: return { backgroundColor: "#ffffff" };
  }
}
