import { describe, expect, it } from "vitest";
import { BGS, BOARD_X, BOARD_Y, BoardStore, KIND, MAX_MSG_NUMS, MAX_NUMS, MAX_PAGES, MAX_STROKES, MAX_TEXT, bgStyle, constrainShape, isBg, parseBoard, type BoardMsg } from "./board";

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
      { ...base, c: 9 }, { ...base, w: 5 }, { ...base, k: 8 }, { ...base, k: -1 }, { ...base, id: -1 },
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
