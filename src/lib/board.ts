/**
 * Doska: ustoz (va ustoz chaqirgan o'quvchi) chizadi, hamma ko'radi. Chiziqlar ustoz brauzerida turadi va LiveKit ma'lumot kanalida
 * ("board" topic) yuboriladi; keyin kirganga ustoz hozirgi doskani (barcha sahifalar bilan) qayta yuboradi. Bazaga yozilmaydi.
 * Koordinatalar doska o'lchamidan mustaqil: x 0..10000 (kengligi), y 0..5625 (balandligi, 16:9).
 * Toza mantiq: brauzerga tegmaydi, shuning uchun sinab ko'riladi.
 */
export const BOARD_X = 10000;
export const BOARD_Y = 5625;
export const COLORS = ["#111827", "#ffffff", "#6b7280", "#1d4ed8", "#0ea5e9", "#16a34a", "#84cc16", "#eab308", "#ea580c", "#dc2626", "#db2777", "#7c3aed"] as const;
export const COLOR_NAMES = ["Qora", "Oq", "Kulrang", "Ko'k", "Moviy", "Yashil", "Och yashil", "Sariq", "To'q sariq", "Qizil", "Pushti", "Binafsha"] as const;
/** Qalamning qalinligi (1600 pikselli doskada, pikselda). Marker 3 baravar, o'chirg'ich 4 baravar keng. */
export const WIDTHS = [3, 6, 12, 22] as const;
export const WIDTH_NAMES = ["Juda ingichka", "Ingichka", "O'rta", "Qalin"] as const;
/** Chiziq turlari: 0 qalam, 1 marker, 2 o'chirg'ich, 3 chiziq, 4 strelka, 5 to'rtburchak, 6 ellips, 7 matn (va stiker), 8 uchburchak, 9 to'g'ri burchakli uchburchak, 10 romb, 11 yulduz, 12 ikki tomonlama strelka. */
export const KIND = { pen: 0, hl: 1, eraser: 2, line: 3, arrow: 4, rect: 5, ellipse: 6, text: 7, triangle: 8, rtri: 9, diamond: 10, star: 11, darrow: 12 } as const;
export const MAX_KIND = 12;
export const isFreehand = (k: number) => k <= 2;
export const isShape = (k: number) => (k >= 3 && k <= 6) || k >= 8;
/** Yopiq shakl (to'ldirish mumkin): to'rtburchak, ellips, uchburchaklar, romb, yulduz. */
export const isClosed = (k: number) => k === KIND.rect || k === KIND.ellipse || (k >= 8 && k <= 11);
/** Shakl parametrlari (bitlar): 1 to'ldirilgan, 2 punktir. */
export const OPT_FILL = 1;
export const OPT_DASH = 2;
/** 1600 pikselli doskada 1 piksel necha doska birligiga teng. */
export const UNIT = BOARD_X / 1600;
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

export type Stroke = { id: number; k: number; c: number; w: number; p: number[]; s?: string; o?: number };
export type BoardMsg =
  | { t: "b"; id: number; k: number; c: number; w: number; p: number[]; r?: 1; s?: string; o?: number } // chiziqqa nuqta qo'shadi (r: shakl uchun almashtiradi; s: matn; o: to'ldirish/punktir)
  | { t: "mv"; id: number; dx: number; dy: number } // chiziqni siljitish
  | { t: "rm"; id: number } // chiziqni o'chirish
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
function strokeLike(v: Record<string, unknown>, maxNums: number): { id: number; k: number; c: number; w: number; p: number[]; s?: string; o?: number } | null {
  const id = int(v.id, 0, 2 ** 31), k = int(v.k, 0, MAX_KIND), c = int(v.c, 0, COLORS.length - 1), w = int(v.w, 0, WIDTHS.length - 1);
  if (id === null || k === null || c === null || w === null) return null;
  const p = points(v.p, maxNums);
  if (!p) return null;
  const o = v.o === undefined ? 0 : int(v.o, 0, 3);
  if (o === null) return null;
  if (isShape(k)) return p.length === 4 ? { id, k, c, w, p, ...(o && { o }) } : null;
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
    case "mv": {
      const id = int(v.id, 0, 2 ** 31), dx = int(v.dx, -BOARD_X, BOARD_X), dy = int(v.dy, -BOARD_Y, BOARD_Y);
      return id === null || dx === null || dy === null ? null : { t: "mv", id, dx, dy };
    }
    case "rm": { const id = int(v.id, 0, 2 ** 31); return id === null ? null : { t: "rm", id }; }
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
      case "rm": {
        const p = this.page, i = p.strokes.findIndex((x) => x.id === m.id);
        if (i < 0) return false;
        p.nums -= strokeNums(p.strokes[i]!);
        p.strokes.splice(i, 1);
        return true;
      }
      case "mv": {
        const s = this.find(m.id);
        if (!s || s.p.length === 0) return false;
        // shakl o'lchami o'zgarmasligi uchun siljish chegaraga yetganda to'xtaydi
        let minX = BOARD_X, maxX = 0, minY = BOARD_Y, maxY = 0;
        for (let i = 0; i < s.p.length; i += 2) { minX = Math.min(minX, s.p[i]!); maxX = Math.max(maxX, s.p[i]!); minY = Math.min(minY, s.p[i + 1]!); maxY = Math.max(maxY, s.p[i + 1]!); }
        const dx = Math.max(-minX, Math.min(BOARD_X - maxX, m.dx)), dy = Math.max(-minY, Math.min(BOARD_Y - maxY, m.dy));
        if (dx === 0 && dy === 0) return false;
        for (let i = 0; i < s.p.length; i += 2) { s.p[i] = s.p[i]! + dx; s.p[i + 1] = s.p[i + 1]! + dy; }
        return true;
      }
      case "b": return this.applyStroke(m);
    }
  }

  /** Joriy sahifadagi chiziqni raqami bo'yicha topadi. */
  find(id: number): Stroke | undefined { return this.page.strokes.find((x) => x.id === id); }

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
    if (m.o !== undefined) { if (m.o) s.o = m.o; else delete s.o; }
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
    if (!isFreehand(s.k)) return [{ t: "b", id: s.id, k: s.k, c: s.c, w: s.w, p: [...s.p], ...(isShape(s.k) && { r: 1 as const }), ...(s.s !== undefined && { s: s.s }), ...(s.o && { o: s.o }) }];
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
    return bundle(flat);
  }
}

/** Xabarlarni ~9 KB dan oshmaydigan paketlarga (`m`) o'raydi: tarmoqqa kam so'rov ketadi. */
export function bundle(msgs: readonly BoardMsg[]): BoardMsg[] {
  const out: BoardMsg[] = [];
  let group: BoardMsg[] = [], size = 0;
  for (const m of msgs) {
    const bytes = JSON.stringify(m).length + 1;
    if (group.length && (size + bytes > BUNDLE_BYTES || group.length >= 300)) { out.push({ t: "m", l: group }); group = []; size = 0; }
    group.push(m); size += bytes;
  }
  if (group.length) out.push({ t: "m", l: group });
  return out;
}

/** Shakl chizayotganda Shift bosilsa: chiziq 45 gradusga yaxlitlanadi, to'rtburchak kvadrat, ellips aylana bo'ladi. (x0,y0) boshlang'ich, (x,y) hozirgi nuqta. */
export function constrainShape(k: number, x0: number, y0: number, x: number, y: number): [number, number] {
  const dx = x - x0, dy = y - y0;
  if (isShape(k) && k !== KIND.line && k !== KIND.arrow && k !== KIND.darrow) {
    const d = Math.max(Math.abs(dx), Math.abs(dy));
    return [x0 + Math.sign(dx || 1) * d, y0 + Math.sign(dy || 1) * d];
  }
  if (k === KIND.line || k === KIND.arrow || k === KIND.darrow) {
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

// ---------------------------------------------------------------------------
// Geometriya: shakl nuqtalari, chegara qutisi, bosilgan chiziqni topish (tanlash va obyekt o'chirg'ich uchun)
// ---------------------------------------------------------------------------
export type Pt = readonly [number, number];

/** Yopiq shaklning (uchburchak, romb, yulduz) cho'qqilari; ikkita burchak nuqtasi bilan berilgan qutiga joylashadi. */
export function shapePoly(k: number, x1: number, y1: number, x2: number, y2: number): Pt[] {
  const l = Math.min(x1, x2), r = Math.max(x1, x2), t = Math.min(y1, y2), b = Math.max(y1, y2);
  const mx = (l + r) / 2, my = (t + b) / 2;
  if (k === KIND.triangle) return [[mx, t], [r, b], [l, b]];
  if (k === KIND.rtri) return [[l, t], [l, b], [r, b]];
  if (k === KIND.diamond) return [[mx, t], [r, my], [mx, b], [l, my]];
  if (k === KIND.star) {
    const rx = (r - l) / 2, ry = (b - t) / 2, out: Pt[] = [];
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 5, f = i % 2 === 0 ? 1 : 0.42;
      out.push([mx + Math.cos(a) * rx * f, my + Math.sin(a) * ry * f]);
    }
    return out;
  }
  return [[l, t], [r, t], [r, b], [l, b]];
}

/** Matn o'lchami (doska birligida): kenglik taxminiy (belgi soni bo'yicha), balandlik qatorlar soni bo'yicha. */
function textBox(s: Stroke): { w: number; h: number } {
  const size = (FONT_SIZES[s.w] ?? FONT_SIZES[1]) * UNIT;
  const lines = (s.s ?? "").split("\n");
  return { w: Math.max(...lines.map((x) => [...x].length), 1) * size * 0.6, h: lines.length * size * 1.2 };
}

/** Chiziqning chegara qutisi (qalinlik hisobga olinmagan); bo'sh bo'lsa null. */
export function strokeBBox(s: Stroke): { x1: number; y1: number; x2: number; y2: number } | null {
  if (s.p.length < 2) return null;
  let x1 = BOARD_X, y1 = BOARD_Y, x2 = 0, y2 = 0;
  for (let i = 0; i < s.p.length; i += 2) { x1 = Math.min(x1, s.p[i]!); x2 = Math.max(x2, s.p[i]!); y1 = Math.min(y1, s.p[i + 1]!); y2 = Math.max(y2, s.p[i + 1]!); }
  if (s.k === KIND.text) { const t = textBox(s); return { x1, y1, x2: x1 + t.w, y2: y1 + t.h }; }
  return { x1, y1, x2, y2 };
}

function segDist(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax, dy = by - ay, len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}
const polyDist = (poly: readonly Pt[], x: number, y: number) => Math.min(...poly.map((a, i) => { const b = poly[(i + 1) % poly.length]!; return segDist(x, y, a[0], a[1], b[0], b[1]); }));
function inPoly(poly: readonly Pt[], x: number, y: number): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i]!, [xj, yj] = poly[j]!;
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** Nuqtadan chiziqqacha masofa (doska birligida): ichi to'ldirilgan yopiq shaklda ichkarida 0. */
export function strokeDistance(s: Stroke, x: number, y: number): number {
  const p = s.p, n = p.length / 2;
  if (n === 0) return Infinity;
  const half = ((WIDTHS[s.w] ?? WIDTHS[1]) * (s.k === KIND.hl ? 3.5 : 1) * UNIT) / 2;
  if (s.k === KIND.text) {
    const b = strokeBBox(s)!;
    return Math.max(0, Math.max(b.x1 - x, x - b.x2), Math.max(b.y1 - y, y - b.y2));
  }
  if (isFreehand(s.k)) {
    if (n === 1) return Math.max(0, Math.hypot(x - p[0]!, y - p[1]!) - half);
    let d = Infinity;
    for (let i = 0; i < n - 1; i++) d = Math.min(d, segDist(x, y, p[i * 2]!, p[i * 2 + 1]!, p[i * 2 + 2]!, p[i * 2 + 3]!));
    return Math.max(0, d - half);
  }
  const [x1, y1, x2, y2] = [p[0]!, p[1]!, p[2]!, p[3]!];
  if (s.k === KIND.line || s.k === KIND.arrow || s.k === KIND.darrow) return Math.max(0, segDist(x, y, x1, y1, x2, y2) - half);
  const fill = !!((s.o ?? 0) & OPT_FILL);
  if (s.k === KIND.ellipse) {
    const rx = Math.abs(x2 - x1) / 2, ry = Math.abs(y2 - y1) / 2;
    if (rx === 0 || ry === 0) return Math.max(0, segDist(x, y, x1, y1, x2, y2) - half);
    const d = Math.hypot((x - (x1 + x2) / 2) / rx, (y - (y1 + y2) / 2) / ry);
    if (fill && d <= 1) return 0;
    return Math.max(0, Math.abs(d - 1) * Math.min(rx, ry) - half);
  }
  const poly = shapePoly(s.k, x1, y1, x2, y2);
  if (fill && inPoly(poly, x, y)) return 0;
  return Math.max(0, polyDist(poly, x, y) - half);
}

/** Bosilgan nuqtadagi eng yuqori chiziqni topadi (o'chirg'ich chiziqlari tanlanmaydi). `tol`: qancha yaqinlikkacha (doska birligida). */
export function hitTest(strokes: readonly Stroke[], x: number, y: number, tol: number): Stroke | null {
  for (let i = strokes.length - 1; i >= 0; i--) {
    const s = strokes[i]!;
    if (s.k !== KIND.eraser && strokeDistance(s, x, y) <= tol) return s;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Shablonlar: bir bosishda doskaga tayyor chizma (jadval, sonlar o'qi, koordinata tekisligi, Venn)
// ---------------------------------------------------------------------------
export const TEMPLATES = [
  { id: "table", name: "Jadval 4×4" },
  { id: "numline", name: "Sonlar o'qi" },
  { id: "axes", name: "Koordinata tekisligi" },
  { id: "venn", name: "Venn diagrammasi" },
] as const;
export type TemplateId = (typeof TEMPLATES)[number]["id"];
const TPL_SIZE: Record<TemplateId, [number, number]> = { table: [5200, 3200], numline: [7200, 1100], axes: [4600, 4600], venn: [5400, 2800] };

/** Shablon xabarlari: (x, y) chap yuqori burchak (doskadan chiqib ketmasligi uchun suriladi). `next` har bir chiziq uchun yangi raqam beradi. */
export function templateMsgs(id: TemplateId, x: number, y: number, c: number, w: number, next: () => number): BoardMsg[] {
  const [W, H] = TPL_SIZE[id];
  const ox = Math.max(0, Math.min(BOARD_X - W, Math.round(x - W / 2))), oy = Math.max(0, Math.min(BOARD_Y - H, Math.round(y - H / 2)));
  const out: BoardMsg[] = [];
  const shape = (k: number, x1: number, y1: number, x2: number, y2: number, ww = w): void => { out.push({ t: "b", id: next(), k, c, w: ww, p: [ox + x1, oy + y1, ox + x2, oy + y2].map(Math.round), r: 1 }); };
  const label = (s: string, lx: number, ly: number): void => { out.push({ t: "b", id: next(), k: KIND.text, c, w: 1, p: [Math.max(0, Math.min(BOARD_X, Math.round(ox + lx))), Math.max(0, Math.min(BOARD_Y, Math.round(oy + ly)))], s }); };
  if (id === "table") {
    shape(KIND.rect, 0, 0, W, H);
    for (let i = 1; i < 4; i++) { shape(KIND.line, (W / 4) * i, 0, (W / 4) * i, H, 0); shape(KIND.line, 0, (H / 4) * i, W, (H / 4) * i, 0); }
  } else if (id === "numline") {
    shape(KIND.darrow, 0, 450, W, 450);
    for (let i = 0; i <= 10; i++) {
      const tx = 400 + ((W - 800) / 10) * i;
      shape(KIND.line, tx, 330, tx, 570, 0);
      const t = String(i - 5);
      label(t, tx - t.length * 130, 640);
    }
  } else if (id === "axes") {
    shape(KIND.arrow, 0, H / 2, W, H / 2); // x o'qi
    shape(KIND.arrow, W / 2, H, W / 2, 0); // y o'qi
    for (let i = -4; i <= 4; i++) {
      if (i === 0) continue;
      shape(KIND.line, W / 2 + (W / 10) * i, H / 2 - 90, W / 2 + (W / 10) * i, H / 2 + 90, 0);
      shape(KIND.line, W / 2 - 90, H / 2 - (H / 10) * i, W / 2 + 90, H / 2 - (H / 10) * i, 0);
    }
    label("x", W - 260, H / 2 + 140); label("y", W / 2 + 160, 40); label("0", W / 2 + 130, H / 2 + 110);
  } else {
    shape(KIND.ellipse, 0, 0, 2800, 2800);
    shape(KIND.ellipse, 2600, 0, 5400, 2800);
    label("A", 900, 1180); label("B", 4200, 1180);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Tarix: bekor qilish va qaytarish (faqat ustozda). Harakatlar chiziq darajasida: qo'shish, o'chirish, siljitish.
// ---------------------------------------------------------------------------
export type Act =
  | { t: "add"; ids: number[]; data?: Stroke[] } // chizildi (data: bekor qilinganda saqlab qo'yiladi, qaytarish uchun)
  | { t: "rm"; strokes: Stroke[] } // o'chirildi yoki tozalandi
  | { t: "mv"; id: number; dx: number; dy: number }; // siljitildi

export class BoardHistory {
  undoStack: Act[] = [];
  redoStack: Act[] = [];
  get canUndo() { return this.undoStack.length > 0; }
  get canRedo() { return this.redoStack.length > 0; }
  clear() { this.undoStack = []; this.redoStack = []; }
  record(a: Act) { this.undoStack.push(a); if (this.undoStack.length > 100) this.undoStack.shift(); this.redoStack = []; }

  private static copy(s: Stroke): Stroke { return { ...s, p: [...s.p] }; }
  private static restore(store: BoardStore, strokes: readonly Stroke[]): BoardMsg[] {
    const msgs = strokes.flatMap((s) => BoardStore.strokeMsgs(s));
    for (const m of msgs) store.apply(m);
    return msgs;
  }
  private static remove(store: BoardStore, ids: readonly number[]): BoardMsg[] {
    const msgs: BoardMsg[] = [];
    for (const id of ids) { const m: BoardMsg = { t: "rm", id }; if (store.apply(m)) msgs.push(m); }
    return msgs;
  }

  /** Oxirgi harakatni bekor qiladi: doskaga qo'llaydi va tarmoqqa yuboriladigan xabarlarni qaytaradi (yo'q bo'lsa null). */
  undo(store: BoardStore): BoardMsg[] | null {
    const a = this.undoStack.pop();
    if (!a) return null;
    this.redoStack.push(a);
    if (a.t === "add") { a.data = a.ids.map((id) => store.find(id)).filter((s): s is Stroke => !!s).map(BoardHistory.copy); return BoardHistory.remove(store, a.ids); }
    if (a.t === "rm") return BoardHistory.restore(store, a.strokes);
    const m: BoardMsg = { t: "mv", id: a.id, dx: -a.dx, dy: -a.dy };
    return store.apply(m) ? [m] : [];
  }

  redo(store: BoardStore): BoardMsg[] | null {
    const a = this.redoStack.pop();
    if (!a) return null;
    this.undoStack.push(a);
    if (a.t === "add") return BoardHistory.restore(store, a.data ?? []);
    if (a.t === "rm") return BoardHistory.remove(store, a.strokes.map((s) => s.id));
    const m: BoardMsg = { t: "mv", id: a.id, dx: a.dx, dy: a.dy };
    return store.apply(m) ? [m] : [];
  }
}
