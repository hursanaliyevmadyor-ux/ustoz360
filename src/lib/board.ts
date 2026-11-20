/**
 * Doska: ustoz chizadi, hamma ko'radi. Chiziqlar (stroke) ustoz brauzerida turadi va LiveKit ma'lumot kanalida ("board" topic) yuboriladi;
 * keyin kirgan o'quvchiga ustoz hozirgi doskani bo'laklab qayta yuboradi. Bazaga yozilmaydi.
 * Koordinatalar doska o'lchamidan mustaqil: x 0..10000 (kengligi), y 0..5625 (balandligi, 16:9).
 * Toza mantiq: brauzerga tegmaydi, shuning uchun sinab ko'riladi.
 */
export const BOARD_X = 10000;
export const BOARD_Y = 5625;
export const COLORS = ["#111827", "#1d4ed8", "#dc2626", "#16a34a", "#d97706", "#7c3aed"] as const;
export const COLOR_NAMES = ["Qora", "Ko'k", "Qizil", "Yashil", "To'q sariq", "Binafsha"] as const;
/** Qalamning qalinligi (1600 pikselli doskada, pikselda). O'chirg'ich shundan 3 baravar keng. */
export const WIDTHS = [4, 10, 22] as const;
export const WIDTH_NAMES = ["Ingichka", "O'rta", "Qalin"] as const;
export const MAX_STROKES = 400;
export const MAX_NUMS = 60000; // jami nuqta sonlari (x va y alohida sanaladi)
export const MAX_MSG_NUMS = 400;
const SNAP_BYTES = 9000;

export type Stroke = { id: number; c: number; w: number; e: boolean; p: number[] };
export type BoardMsg =
  | { t: "b"; id: number; c: number; w: number; e?: 1; p: number[] } // chiziqqa nuqtalar qo'shadi (yangi bo'lsa, yaratadi)
  | { t: "u" } // oxirgi chiziqni bekor qilish
  | { t: "x" } // doskani tozalash
  | { t: "snap"; i: number; n: number; strokes: Stroke[] }; // keyin kirganga hozirgi doska (i-bo'lak, n ta bo'lakdan)

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const int = (v: unknown, min: number, max: number): number | null => (typeof v === "number" && Number.isInteger(v) && v >= min && v <= max ? v : null);

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
function stroke(v: unknown): Stroke | null {
  if (!isObj(v)) return null;
  const id = int(v.id, 0, 2 ** 31), c = int(v.c, 0, COLORS.length - 1), w = int(v.w, 0, WIDTHS.length - 1), p = points(v.p, MAX_NUMS);
  return id !== null && c !== null && w !== null && p ? { id, c, w, e: v.e === true, p } : null;
}

/** Kelgan doska xabarini tekshiradi; yaroqsiz bo'lsa null (hech qachon xato tashlamaydi). */
export function parseBoard(v: unknown): BoardMsg | null {
  if (!isObj(v)) return null;
  if (v.t === "u") return { t: "u" };
  if (v.t === "x") return { t: "x" };
  if (v.t === "b") {
    const id = int(v.id, 0, 2 ** 31), c = int(v.c, 0, COLORS.length - 1), w = int(v.w, 0, WIDTHS.length - 1), p = points(v.p, MAX_MSG_NUMS);
    return id !== null && c !== null && w !== null && p ? { t: "b", id, c, w, ...(v.e === 1 && { e: 1 as const }), p } : null;
  }
  if (v.t === "snap") {
    const i = int(v.i, 0, 1000), n = int(v.n, 1, 1000);
    if (i === null || n === null || i >= n || !Array.isArray(v.strokes) || v.strokes.length > MAX_STROKES) return null;
    const strokes: Stroke[] = [];
    for (const s of v.strokes) { const x = stroke(s); if (!x) return null; strokes.push(x); }
    return { t: "snap", i, n, strokes };
  }
  return null;
}

/** Doskadagi chiziqlar. Ustozda ham, o'quvchida ham bir xil xabarlar bilan yangilanadi. */
export class BoardStore {
  strokes: Stroke[] = [];
  private nums = 0;

  /** Xabarni qo'llaydi; doska o'zgargan bo'lsa true. Chegaradan oshsa, ortiqcha qism tashlanadi. */
  apply(m: BoardMsg): boolean {
    if (m.t === "x") { const had = this.strokes.length > 0; this.strokes = []; this.nums = 0; return had; }
    if (m.t === "u") { const s = this.strokes.pop(); if (s) this.nums -= s.p.length; return !!s; }
    if (m.t === "snap") {
      if (m.i === 0) { this.strokes = []; this.nums = 0; }
      for (const s of m.strokes) this.add(s);
      return true;
    }
    let s = this.strokes.length ? this.strokes[this.strokes.length - 1] : undefined;
    if (!s || s.id !== m.id) s = this.strokes.find((x) => x.id === m.id);
    if (!s) {
      s = { id: m.id, c: m.c, w: m.w, e: m.e === 1, p: [] };
      this.strokes.push(s);
      while (this.strokes.length > MAX_STROKES) { const d = this.strokes.shift(); if (d) this.nums -= d.p.length; }
    }
    const room = MAX_NUMS - this.nums;
    if (room <= 0) return false;
    const add = m.p.length <= room ? m.p : m.p.slice(0, room - (room % 2));
    if (add.length === 0) return false;
    s.p.push(...add);
    this.nums += add.length;
    return true;
  }

  private add(s: Stroke) {
    if (this.nums + s.p.length > MAX_NUMS) return;
    const last = this.strokes[this.strokes.length - 1];
    if (last && last.id === s.id) { last.p.push(...s.p); this.nums += s.p.length; return; } // uzun chiziqning keyingi bo'lagi
    if (this.strokes.length >= MAX_STROKES) return;
    this.strokes.push({ ...s, p: [...s.p] });
    this.nums += s.p.length;
  }

  /** Doska to'ldimi (yangi chiziq chizib bo'lmaydi). */
  get full() { return this.nums >= MAX_NUMS - 2; }

  /** Keyin kirgan o'quvchi uchun hozirgi doska: har bir bo'lak ~9 KB dan oshmaydi. Doska bo'sh bo'lsa ham bitta bo'sh bo'lak (o'quvchi eskisini tozalasin). */
  snapshot(): BoardMsg[] {
    const groups: Stroke[][] = [[]];
    let size = 0;
    for (const s of this.strokes) {
      // uzun chiziq bir necha bo'lakka bo'linadi (bir xil id: qabul qiluvchida qo'shiladi)
      for (let i = 0; i < s.p.length; i += 600) {
        const part: Stroke = { ...s, p: s.p.slice(i, i + 600) };
        const bytes = part.p.length * 6 + 60;
        if (size + bytes > SNAP_BYTES && groups[groups.length - 1]!.length) { groups.push([]); size = 0; }
        groups[groups.length - 1]!.push(part);
        size += bytes;
      }
    }
    return groups.map((strokes, i) => ({ t: "snap" as const, i, n: groups.length, strokes }));
  }
}
