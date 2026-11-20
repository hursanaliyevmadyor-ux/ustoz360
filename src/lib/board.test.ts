import { describe, expect, it } from "vitest";
import {
  BGS, BOARD_X, BOARD_Y, BoardHistory, BoardStore, COLORS, KIND, MAX_MSG_NUMS, MAX_NUMS, MAX_PAGES, MAX_STROKES, MAX_TEXT, OPT_DASH, OPT_FILL, TEMPLATES, UNIT,
  bgStyle, bundle, constrainShape, hitTest, isBg, parseBoard, shapePoly, strokeBBox, strokeDistance, templateMsgs, type BoardMsg, type Stroke,
} from "./board";

const pen = (id: number, n: number, extra: Partial<Extract<BoardMsg, { t: "b" }>> = {}): BoardMsg => ({ t: "b", id, k: 0, c: 2, w: 1, p: Array.from({ length: n * 2 }, (_, i) => (i * 37) % 5000), ...extra });
const rect = (id: number, p = [10, 20, 300, 400]): BoardMsg => ({ t: "b", id, k: KIND.rect, c: 0, w: 1, p, r: 1 });

describe("parseBoard", () => {
  it("to'g'ri xabarlarni qabul qiladi", () => {
    expect(parseBoard({ t: "b", id: 1, k: 0, c: 2, w: 0, p: [1, 2, 3, 4] })).toEqual({ t: "b", id: 1, k: 0, c: 2, w: 0, p: [1, 2, 3, 4] });
    expect(parseBoard({ t: "b", id: 1, k: 1, c: 0, w: 3, p: [0, 0] })).toMatchObject({ k: 1 });
    for (const t of ["u", "x", "pa", "pd", "rs"]) expect(parseBoard({ t })).toEqual({ t });
    expect(parseBoard({ t: "pg", i: 3 })).toEqual({ t: "pg", i: 3 });
    expect(parseBoard({ t: "im", id: 0 })).toEqual({ t: "im", id: 0 });
    expect(parseBoard({ t: "l" })).toEqual({ t: "l" });
    expect(parseBoard({ t: "l", x: 5, y: 6 })).toEqual({ t: "l", x: 5, y: 6 });
    expect(parseBoard({ t: "b", id: 1, k: 0, c: 0, w: 0, p: [BOARD_X, BOARD_Y] })).not.toBeNull();
  });
  it("shakl va matn", () => {
    expect(parseBoard(rect(1))).toEqual(rect(1));
    expect(parseBoard({ t: "b", id: 2, k: 7, c: 0, w: 1, p: [5, 6], s: "Salom\ndunyo" })).toMatchObject({ s: "Salom\ndunyo" });
    // r faqat shakllar uchun saqlanadi
    expect(parseBoard({ t: "b", id: 1, k: 0, c: 0, w: 0, p: [1, 2], r: 1 })).not.toHaveProperty("r");
  });
  it("yaroqsizlarini rad etadi", () => {
    const base = { t: "b", id: 1, k: 0, c: 0, w: 0, p: [1, 2] };
    const bad: unknown[] = [null, 5, "x", [], {}, { t: "z" }, { t: "b" },
      { ...base, c: 12 }, { ...base, w: 5 }, { ...base, k: 13 }, { ...base, k: -1 }, { ...base, id: -1 },
      { ...base, p: [1] }, { ...base, p: [] }, { ...base, p: [1, 2, 3] },
      { ...base, p: [BOARD_X + 1, 0] }, { ...base, p: [0, BOARD_Y + 1] }, { ...base, p: [1.5, 2] }, { ...base, p: ["1", 2] }, { ...base, p: [NaN, 2] },
      { ...base, p: new Array(MAX_MSG_NUMS + 2).fill(1) },
      { ...base, k: 3, p: [1, 2] }, { ...base, k: 5, p: [1, 2, 3, 4, 5, 6] }, // shakl faqat 2 nuqta
      { ...base, k: 7 }, { ...base, k: 7, s: "   " }, { ...base, k: 7, p: [1, 2, 3, 4], s: "x" }, // matn: bitta nuqta va bo'sh bo'lmagan satr
      { t: "pg", i: -1 }, { t: "pg", i: MAX_PAGES }, { t: "pg" }, { t: "im", id: "1" }, { t: "l", x: 1 }, { t: "l", x: BOARD_X + 1, y: 0 },
      { t: "m" }, { t: "m", l: [] }, { t: "m", l: [{ t: "z" }] }, { t: "m", l: [{ t: "m", l: [{ t: "u" }] }] }]; // ichma-ich paket yo'q
    for (const b of bad) expect(parseBoard(b), JSON.stringify(b)).toBeNull();
  });
  it("matn uzunligi cheklanadi, boshqaruv belgilari olib tashlanadi", () => {
    const m = parseBoard({ t: "b", id: 1, k: 7, c: 0, w: 0, p: [1, 2], s: "a\u0000b" + "x".repeat(1000) }) as Extract<BoardMsg, { t: "b" }>;
    expect(m.s!.length).toBeLessThanOrEqual(MAX_TEXT);
    expect(m.s!.startsWith("ab")).toBe(true);
  });
  it("paket ichidagi xabarlar tekshiriladi", () => {
    expect(parseBoard({ t: "m", l: [{ t: "pa" }, { t: "b", id: 1, k: 0, c: 0, w: 0, p: [1, 2] }] })).toEqual({ t: "m", l: [{ t: "pa" }, { t: "b", id: 1, k: 0, c: 0, w: 0, p: [1, 2] }] });
  });
});

describe("BoardStore: chizish", () => {
  it("nuqtalar bir chiziqqa qo'shiladi, yangi id yangi chiziq", () => {
    const b = new BoardStore();
    expect(b.apply({ t: "b", id: 1, k: 0, c: 0, w: 0, p: [1, 1, 2, 2] })).toBe(true);
    b.apply({ t: "b", id: 1, k: 0, c: 0, w: 0, p: [3, 3] });
    b.apply({ t: "b", id: 2, k: 2, c: 2, w: 1, p: [9, 9] });
    expect(b.strokes).toHaveLength(2);
    expect(b.strokes[0]!.p).toEqual([1, 1, 2, 2, 3, 3]);
    expect(b.strokes[1]).toMatchObject({ id: 2, k: 2, c: 2, w: 1 });
  });
  it("shakl: r bilan nuqtalar almashadi (sudrash paytida), qo'shilmaydi", () => {
    const b = new BoardStore();
    b.apply(rect(1, [0, 0, 10, 10])); b.apply(rect(1, [0, 0, 500, 300])); b.apply(rect(1, [0, 0, 700, 400]));
    expect(b.strokes).toHaveLength(1);
    expect(b.strokes[0]!.p).toEqual([0, 0, 700, 400]);
    b.apply({ t: "u" }); expect(b.page.nums).toBe(0);
  });
  it("matn saqlanadi", () => {
    const b = new BoardStore();
    b.apply({ t: "b", id: 1, k: 7, c: 0, w: 2, p: [100, 200], s: "x² + y²" });
    expect(b.strokes[0]).toMatchObject({ k: 7, s: "x² + y²", p: [100, 200] });
  });
  it("bekor qilish va tozalash faqat joriy sahifada", () => {
    const b = new BoardStore();
    b.apply(pen(1, 3)); b.apply({ t: "pa" }); b.apply(pen(2, 3)); b.apply(pen(3, 3));
    expect(b.apply({ t: "u" })).toBe(true);
    expect(b.strokes.map((s) => s.id)).toEqual([2]);
    expect(b.apply({ t: "x" })).toBe(true);
    expect(b.strokes).toEqual([]);
    b.apply({ t: "pg", i: 0 });
    expect(b.strokes.map((s) => s.id)).toEqual([1]); // birinchi sahifa tegilmagan
    expect(b.apply({ t: "x" })).toBe(true);
    expect(b.apply({ t: "u" })).toBe(false);
    expect(b.apply({ t: "x" })).toBe(false);
    b.apply(pen(9, 2)); expect(b.full).toBe(false);
  });
  it("chiziqlar soni cheklangan: eskilari tashlanadi", () => {
    const b = new BoardStore();
    for (let i = 0; i < MAX_STROKES + 25; i++) b.apply(pen(i, 1));
    expect(b.strokes).toHaveLength(MAX_STROKES);
    expect(b.strokes[0]!.id).toBe(25);
  });
  it("nuqtalar umumiy soni hamma sahifalarda cheklangan", () => {
    const b = new BoardStore();
    for (let i = 0; i < MAX_NUMS / MAX_MSG_NUMS + 5; i++) b.apply({ t: "b", id: 1, k: 0, c: 0, w: 0, p: new Array(MAX_MSG_NUMS).fill(5) });
    expect(b.strokes[0]!.p.length).toBe(MAX_NUMS);
    expect(b.full).toBe(true);
    expect(b.apply(pen(2, 3))).toBe(false);
    b.apply({ t: "pa" }); // yangi sahifa ham to'la hisobda
    expect(b.apply(pen(3, 3))).toBe(false);
  });
});

describe("BoardStore: sahifalar va rasm", () => {
  it("sahifa qo'shish, o'tish, o'chirish", () => {
    const b = new BoardStore();
    expect(b.pages).toHaveLength(1);
    b.apply(pen(1, 2)); b.apply({ t: "pa" }); b.apply(pen(2, 2)); b.apply({ t: "pa" });
    expect(b.pages).toHaveLength(3); expect(b.cur).toBe(2);
    b.apply({ t: "pg", i: 0 }); expect(b.cur).toBe(0); expect(b.strokes[0]!.id).toBe(1);
    expect(b.apply({ t: "pg", i: 0 })).toBe(false);
    b.apply({ t: "pa" }); // joriy (0) dan keyin qo'shiladi
    expect(b.cur).toBe(1); expect(b.pages).toHaveLength(4); expect(b.strokes).toEqual([]);
    expect(b.pages[2]!.strokes[0]!.id).toBe(2);
    b.apply({ t: "pd" }); expect(b.pages).toHaveLength(3); expect(b.cur).toBe(1);
    expect(b.strokes[0]!.id).toBe(2);
    b.apply({ t: "pg", i: 99 }); expect(b.cur).toBe(2); // chegaradan oshsa oxirgisiga
  });
  it("oxirgi sahifani o'chirib bo'lmaydi, sahifalar soni cheklangan", () => {
    const b = new BoardStore();
    expect(b.apply({ t: "pd" })).toBe(false);
    for (let i = 0; i < MAX_PAGES + 5; i++) b.apply({ t: "pa" });
    expect(b.pages).toHaveLength(MAX_PAGES);
  });
  it("rasm sahifaga bog'lanadi", () => {
    const b = new BoardStore();
    expect(b.apply({ t: "im", id: 7 })).toBe(true);
    expect(b.image).toBe(7);
    expect(b.apply({ t: "im", id: 7 })).toBe(false);
    b.apply({ t: "pa" }); expect(b.image).toBe(0);
    b.apply({ t: "pg", i: 0 }); expect(b.image).toBe(7);
  });
  it("lazer saqlanmaydi, faqat tinglovchilarga boradi", () => {
    const b = new BoardStore(); const got: unknown[] = [];
    const off = b.onLaser((m) => got.push(m));
    expect(b.apply({ t: "l", x: 5, y: 6 })).toBe(false);
    b.apply({ t: "l" });
    off(); b.apply({ t: "l", x: 1, y: 1 });
    expect(got).toEqual([{ x: 5, y: 6 }, null]);
    expect(b.strokes).toEqual([]);
  });
  it("paket ichidagi xabarlar tartib bilan qo'llanadi", () => {
    const b = new BoardStore();
    expect(b.apply({ t: "m", l: [pen(1, 2), { t: "pa" }, pen(2, 2)] })).toBe(true);
    expect(b.pages).toHaveLength(2);
  });
});

describe("snapshot", () => {
  const build = () => {
    const a = new BoardStore();
    for (let i = 1; i <= 25; i++) a.apply(pen(i, 100, { c: i % 8, k: i % 3 === 0 ? 1 : 0 }));
    a.apply({ t: "b", id: 99, k: 0, c: 3, w: 2, p: Array.from({ length: 1700 }, (_, i) => i % 5000) }); // juda uzun chiziq bo'linadi
    a.apply(rect(100)); a.apply({ t: "b", id: 101, k: 7, c: 4, w: 2, p: [300, 400], s: "Mavzu: kasrlar" });
    a.apply({ t: "pa" }); a.apply({ t: "im", id: 55 }); a.apply(pen(200, 10));
    a.apply({ t: "pa" }); a.apply({ t: "b", id: 300, k: 4, c: 1, w: 0, p: [1, 2, 3, 4], r: 1 });
    a.apply({ t: "pg", i: 1 });
    return a;
  };
  it("qabul qiluvchida aynan shunday doska chiqadi (sahifalar, rasm, matn, joriy sahifa)", () => {
    const a = build();
    const snaps = a.snapshot();
    expect(snaps.length).toBeGreaterThan(1);
    for (const s of snaps) expect(JSON.stringify(s).length).toBeLessThan(14000);
    const b = new BoardStore();
    b.apply(pen(500, 3)); b.apply({ t: "pa" }); // eski narsa snapshotdan keyin qolmasligi kerak
    for (const s of snaps) { const m = parseBoard(JSON.parse(JSON.stringify(s))); expect(m, "paket yaroqli").not.toBeNull(); b.apply(m!); }
    expect(b.pages).toEqual(a.pages);
    expect(b.cur).toBe(a.cur);
  });
  it("bo'sh doskaning snapshoti qabul qiluvchining eskisini tozalaydi", () => {
    const snaps = new BoardStore().snapshot();
    const b = new BoardStore(); b.apply(pen(1, 2)); b.apply({ t: "pa" });
    for (const s of snaps) b.apply(s);
    expect(b.pages).toHaveLength(1); expect(b.strokes).toEqual([]); expect(b.cur).toBe(0);
  });
});

describe("fon", () => {
  it("oltita fon, har biriga uslub bor", () => {
    expect([...BGS]).toEqual(["plain", "grid", "lines", "dots", "axes", "dark"]);
    for (const bg of BGS) expect(bgStyle(bg).backgroundColor).toMatch(/^#/);
    expect(bgStyle("grid").backgroundImage).toContain("linear-gradient");
    expect(bgStyle("plain").backgroundImage).toBeUndefined();
    expect(isBg("axes") && !isBg("x") && !isBg(1)).toBe(true);
  });
});

describe("constrainShape", () => {
  it("to'rtburchak va ellips kvadrat/aylana bo'ladi (yo'nalish saqlanadi)", () => {
    expect(constrainShape(KIND.rect, 100, 100, 400, 250)).toEqual([400, 400]);
    expect(constrainShape(KIND.ellipse, 500, 500, 450, 200)).toEqual([200, 200]);
    expect(constrainShape(KIND.rect, 100, 100, 100, 100)).toEqual([101, 101].map((v) => v - 1 + 0)); // nol o'lcham: o'zgarmaydi
  });
  it("chiziq va strelka 45 gradusga yaxlitlanadi, uzunligi saqlanadi", () => {
    expect(constrainShape(KIND.line, 0, 0, 1000, 80)).toEqual([Math.round(Math.hypot(1000, 80)), 0]); // deyarli gorizontal
    const [x, y] = constrainShape(KIND.arrow, 0, 0, 500, 520);
    expect(Math.abs(x - y)).toBeLessThanOrEqual(1);
    expect(constrainShape(KIND.line, 7, 7, 7, 7)).toEqual([7, 7]);
  });
  it("qalam va matn uchun o'zgarmaydi", () => {
    expect(constrainShape(KIND.pen, 0, 0, 123, 45)).toEqual([123, 45]);
  });
});

const st = (id: number, k: number, p: number[], extra: Partial<Stroke> = {}): Stroke => ({ id, k, c: 0, w: 1, p, ...extra });

describe("yangi chiziq turlari va parametrlar", () => {
  it("yangi shakllar 4 ta son talab qiladi, parametr (o) 0..3", () => {
    for (const k of [KIND.triangle, KIND.rtri, KIND.diamond, KIND.star, KIND.darrow]) {
      expect(parseBoard({ t: "b", id: 1, k, c: 0, w: 0, p: [1, 2, 300, 400], r: 1 }), String(k)).not.toBeNull();
      expect(parseBoard({ t: "b", id: 1, k, c: 0, w: 0, p: [1, 2] })).toBeNull();
    }
    expect(parseBoard({ t: "b", id: 1, k: 13, c: 0, w: 0, p: [1, 2, 3, 4] })).toBeNull();
    expect(parseBoard({ t: "b", id: 1, k: 5, c: 0, w: 0, p: [1, 2, 3, 4], o: OPT_FILL | OPT_DASH })).toMatchObject({ o: 3 });
    expect(parseBoard({ t: "b", id: 1, k: 5, c: 0, w: 0, p: [1, 2, 3, 4], o: 4 })).toBeNull();
    expect(parseBoard({ t: "b", id: 1, k: 5, c: 0, w: 0, p: [1, 2, 3, 4], o: -1 })).toBeNull();
    expect(parseBoard({ t: "b", id: 1, k: 5, c: 0, w: 0, p: [1, 2, 3, 4], o: 0 })).not.toHaveProperty("o");
  });
  it("12 rang", () => {
    expect(COLORS).toHaveLength(12);
    expect(parseBoard({ t: "b", id: 1, k: 0, c: 11, w: 0, p: [1, 2] })).not.toBeNull();
    expect(parseBoard({ t: "b", id: 1, k: 0, c: 12, w: 0, p: [1, 2] })).toBeNull();
  });
  it("parametr saqlanadi va snapshotda qaytadi", () => {
    const a = new BoardStore();
    a.apply({ t: "b", id: 1, k: KIND.rect, c: 2, w: 1, p: [10, 10, 500, 400], r: 1, o: 3 });
    expect(a.strokes[0]!.o).toBe(3);
    const b = new BoardStore(); for (const m of a.snapshot()) b.apply(m);
    expect(b.strokes).toEqual(a.strokes);
  });
});

describe("mv va rm", () => {
  it("parse", () => {
    expect(parseBoard({ t: "mv", id: 1, dx: -5, dy: 7 })).toEqual({ t: "mv", id: 1, dx: -5, dy: 7 });
    expect(parseBoard({ t: "rm", id: 4 })).toEqual({ t: "rm", id: 4 });
    for (const bad of [{ t: "mv", id: 1, dx: 1 }, { t: "mv", id: 1, dx: BOARD_X + 1, dy: 0 }, { t: "mv", id: 1, dx: 1.5, dy: 0 }, { t: "rm" }, { t: "rm", id: -1 }]) expect(parseBoard(bad)).toBeNull();
  });
  it("siljitish: nuqtalar suriladi, chegarada shakl o'lchami saqlanadi", () => {
    const b = new BoardStore();
    b.apply(rect(1, [100, 100, 500, 300]));
    expect(b.apply({ t: "mv", id: 1, dx: 50, dy: -20 })).toBe(true);
    expect(b.strokes[0]!.p).toEqual([150, 80, 550, 280]);
    b.apply({ t: "mv", id: 1, dx: -9999, dy: -9999 }); // chap-yuqori chegaraga qadar
    expect(b.strokes[0]!.p).toEqual([0, 0, 400, 200]);
    b.apply({ t: "mv", id: 1, dx: BOARD_X, dy: BOARD_Y });
    expect(b.strokes[0]!.p).toEqual([BOARD_X - 400, BOARD_Y - 200, BOARD_X, BOARD_Y]);
    expect(b.apply({ t: "mv", id: 1, dx: 5, dy: 5 })).toBe(false); // chegarada siljimaydi
    expect(b.apply({ t: "mv", id: 999, dx: 5, dy: 5 })).toBe(false);
  });
  it("o'chirish: nuqtalar hisobi to'g'ri", () => {
    const b = new BoardStore();
    b.apply(pen(1, 5)); b.apply(rect(2));
    const before = b.page.nums;
    expect(b.apply({ t: "rm", id: 1 })).toBe(true);
    expect(b.page.nums).toBe(before - 10);
    expect(b.apply({ t: "rm", id: 1 })).toBe(false);
    expect(b.strokes.map((x) => x.id)).toEqual([2]);
  });
});

describe("geometriya", () => {
  it("shakl nuqtalari", () => {
    expect(shapePoly(KIND.triangle, 0, 0, 100, 100)).toEqual([[50, 0], [100, 100], [0, 100]]);
    expect(shapePoly(KIND.rtri, 0, 0, 100, 100)).toEqual([[0, 0], [0, 100], [100, 100]]);
    expect(shapePoly(KIND.diamond, 100, 100, 0, 0)).toEqual([[50, 0], [100, 50], [50, 100], [0, 50]]); // burchaklar teskari bo'lsa ham
    expect(shapePoly(KIND.star, 0, 0, 100, 100)).toHaveLength(10);
  });
  it("chegara qutisi: chiziq, shakl, matn", () => {
    expect(strokeBBox(st(1, 0, [10, 50, 30, 20, 5, 90]))).toEqual({ x1: 5, y1: 20, x2: 30, y2: 90 });
    expect(strokeBBox(st(1, KIND.rect, [300, 400, 100, 50]))).toEqual({ x1: 100, y1: 50, x2: 300, y2: 400 });
    const t = strokeBBox(st(1, KIND.text, [100, 100], { s: "ab\nabcd", w: 1 }))!;
    expect(t.x1).toBe(100); expect(t.x2).toBeGreaterThan(100 + 4 * 40 * UNIT * 0.5); expect(t.y2).toBeGreaterThan(t.y1 + 2 * 44 * UNIT);
    expect(strokeBBox(st(1, 0, []))).toBeNull();
  });
  it("masofa: chiziq, kesma, to'ldirilgan va to'ldirilmagan shakllar", () => {
    const line = st(1, KIND.line, [0, 0, 1000, 0]);
    expect(strokeDistance(line, 500, 300)).toBeCloseTo(300 - (6 * UNIT) / 2, 0);
    expect(strokeDistance(line, 1300, 0)).toBeGreaterThan(250);
    const rc = st(2, KIND.rect, [1000, 1000, 3000, 2000]);
    expect(strokeDistance(rc, 2000, 1500)).toBeGreaterThan(400); // ichi bo'sh: markaz uzoq
    expect(strokeDistance({ ...rc, o: OPT_FILL }, 2000, 1500)).toBe(0);
    expect(strokeDistance(rc, 1000, 1500)).toBe(0); // chetida
    const el = st(3, KIND.ellipse, [0, 0, 2000, 1000]);
    expect(strokeDistance(el, 1000, 0)).toBeLessThan(40); // yuqori nuqtasi
    expect(strokeDistance({ ...el, o: OPT_FILL }, 1000, 500)).toBe(0);
    const tri = st(4, KIND.triangle, [0, 0, 1000, 1000], { o: OPT_FILL });
    expect(strokeDistance(tri, 500, 700)).toBe(0); expect(strokeDistance(tri, 50, 50)).toBeGreaterThan(30);
    expect(strokeDistance(st(5, 0, [100, 100]), 100, 100)).toBe(0);
  });
  it("hitTest: eng yuqori chiziqni topadi, o'chirg'ichni o'tkazib yuboradi", () => {
    const list = [st(1, KIND.rect, [0, 0, 2000, 2000], { o: OPT_FILL }), st(2, KIND.line, [0, 1000, 2000, 1000]), st(3, KIND.eraser, [0, 1000, 2000, 1000])];
    expect(hitTest(list, 1000, 1010, 60)!.id).toBe(2); // chiziq to'rtburchak ustida
    expect(hitTest(list, 1000, 400, 60)!.id).toBe(1);
    expect(hitTest(list, 5000, 5000, 60)).toBeNull();
    expect(hitTest([], 1, 1, 60)).toBeNull();
    const text = st(9, KIND.text, [500, 500], { s: "Salom" });
    expect(hitTest([text], 600, 600, 20)!.id).toBe(9);
  });
});

describe("shablonlar", () => {
  it("har bir shablon yaroqli xabarlar beradi, doskaga sig'adi, raqamlar takrorlanmaydi", () => {
    for (const t of TEMPLATES) {
      let n = 100;
      const msgs = templateMsgs(t.id, 5000, 2800, 2, 1, () => n++);
      expect(msgs.length, t.id).toBeGreaterThan(3);
      const ids = new Set<number>();
      for (const m of msgs) {
        const parsed = parseBoard(JSON.parse(JSON.stringify(m)));
        expect(parsed, `${t.id} ${JSON.stringify(m)}`).not.toBeNull();
        expect(m.t).toBe("b"); ids.add((m as { id: number }).id);
      }
      expect(ids.size).toBe(msgs.length);
      const b = new BoardStore(); msgs.forEach((m) => b.apply(m));
      for (const s of b.strokes) for (let i = 0; i < s.p.length; i += 2) { expect(s.p[i]).toBeGreaterThanOrEqual(0); expect(s.p[i]).toBeLessThanOrEqual(BOARD_X); expect(s.p[i + 1]).toBeLessThanOrEqual(BOARD_Y); }
    }
  });
  it("burchakka bosilsa ham doska ichida qoladi", () => {
    for (const t of TEMPLATES) for (const [x, y] of [[0, 0], [BOARD_X, BOARD_Y], [BOARD_X, 0]] as const) {
      const b = new BoardStore(); let n = 1;
      templateMsgs(t.id, x, y, 0, 1, () => n++).forEach((m) => b.apply(m));
      for (const s of b.strokes) if (s.k !== KIND.text) for (let i = 0; i < s.p.length; i += 2) { expect(s.p[i]).toBeGreaterThanOrEqual(0); expect(s.p[i + 1]).toBeLessThanOrEqual(BOARD_Y); }
    }
  });
});

describe("bundle", () => {
  it("xabarlarni paketlarga o'raydi: tartib saqlanadi, har biri chegaradan oshmaydi, parse o'tadi", () => {
    const msgs = Array.from({ length: 200 }, (_, i) => pen(i, 20));
    const packs = bundle(msgs);
    expect(packs.length).toBeGreaterThan(1);
    for (const p of packs) { expect(JSON.stringify(p).length).toBeLessThan(14000); expect(parseBoard(JSON.parse(JSON.stringify(p)))).not.toBeNull(); }
    const flat = packs.flatMap((p) => (p as { l: BoardMsg[] }).l);
    expect(flat).toEqual(msgs);
    expect(bundle([])).toEqual([]);
  });
});

describe("BoardHistory", () => {
  const draw = (b: BoardStore, h: BoardHistory, id: number) => { b.apply(pen(id, 3)); h.record({ t: "add", ids: [id] }); };
  it("chizilganni bekor qiladi va qaytaradi, xabarlar tarmoqqa mos", () => {
    const b = new BoardStore(), h = new BoardHistory();
    draw(b, h, 1); draw(b, h, 2);
    expect(h.canUndo).toBe(true); expect(h.canRedo).toBe(false);
    const u = h.undo(b)!;
    expect(u).toEqual([{ t: "rm", id: 2 }]);
    expect(b.strokes.map((s) => s.id)).toEqual([1]);
    expect(h.canRedo).toBe(true);
    const r = h.redo(b)!;
    expect(r.length).toBeGreaterThan(0);
    expect(b.strokes.map((s) => s.id)).toEqual([1, 2]);
    expect(h.redo(b)).toBeNull();
  });
  it("yangi harakat qaytarish ro'yxatini tozalaydi", () => {
    const b = new BoardStore(), h = new BoardHistory();
    draw(b, h, 1); h.undo(b); expect(h.canRedo).toBe(true);
    draw(b, h, 2); expect(h.canRedo).toBe(false);
  });
  it("o'chirilgan va tozalangan chiziqlar qaytadi", () => {
    const b = new BoardStore(), h = new BoardHistory();
    draw(b, h, 1); draw(b, h, 2); draw(b, h, 3);
    const all = b.strokes.map((s) => ({ ...s, p: [...s.p] }));
    b.apply({ t: "x" }); h.record({ t: "rm", strokes: all });
    expect(b.strokes).toEqual([]);
    h.undo(b);
    expect(b.strokes).toEqual(all);
    const r = h.redo(b)!; // qaytarish: yana tozalanadi
    expect(r.every((m) => m.t === "rm")).toBe(true);
    expect(b.strokes).toEqual([]);
  });
  it("siljitish bekor qilinadi (teskari xabar) va qaytariladi", () => {
    const b = new BoardStore(), h = new BoardHistory();
    b.apply(rect(1, [100, 100, 300, 300]));
    b.apply({ t: "mv", id: 1, dx: 200, dy: 50 }); h.record({ t: "mv", id: 1, dx: 200, dy: 50 });
    expect(h.undo(b)).toEqual([{ t: "mv", id: 1, dx: -200, dy: -50 }]);
    expect(b.strokes[0]!.p).toEqual([100, 100, 300, 300]);
    h.redo(b); expect(b.strokes[0]!.p).toEqual([300, 150, 500, 350]);
  });
  it("shablon (ko'p chiziq) bitta harakat sifatida bekor qilinadi", () => {
    const b = new BoardStore(), h = new BoardHistory(); let n = 10;
    const msgs = templateMsgs("table", 4000, 2000, 0, 1, () => n++);
    msgs.forEach((m) => b.apply(m)); h.record({ t: "add", ids: msgs.map((m) => (m as { id: number }).id) });
    expect(b.strokes.length).toBe(msgs.length);
    const u = h.undo(b)!;
    expect(u).toHaveLength(msgs.length); expect(b.strokes).toEqual([]);
    h.redo(b); expect(b.strokes.length).toBe(msgs.length);
  });
  it("tarix 100 tagacha", () => {
    const b = new BoardStore(), h = new BoardHistory();
    for (let i = 0; i < 130; i++) draw(b, h, i);
    expect(h.undoStack).toHaveLength(100);
  });
});
