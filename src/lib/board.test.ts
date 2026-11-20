import { describe, expect, it } from "vitest";
import { BOARD_X, BOARD_Y, BoardStore, MAX_MSG_NUMS, MAX_NUMS, MAX_STROKES, parseBoard, type BoardMsg } from "./board";

const line = (id: number, n: number, extra: Partial<Extract<BoardMsg, { t: "b" }>> = {}): BoardMsg => ({ t: "b", id, c: 1, w: 1, p: Array.from({ length: n * 2 }, (_, i) => (i * 37) % 5000), ...extra });

describe("parseBoard", () => {
  it("to'g'ri xabarlarni qabul qiladi", () => {
    expect(parseBoard({ t: "b", id: 1, c: 2, w: 0, p: [1, 2, 3, 4] })).toEqual({ t: "b", id: 1, c: 2, w: 0, p: [1, 2, 3, 4] });
    expect(parseBoard({ t: "b", id: 1, c: 0, w: 2, e: 1, p: [0, 0] })).toMatchObject({ e: 1 });
    expect(parseBoard({ t: "u" })).toEqual({ t: "u" });
    expect(parseBoard({ t: "x" })).toEqual({ t: "x" });
    expect(parseBoard({ t: "b", id: 1, c: 0, w: 0, p: [BOARD_X, BOARD_Y] })).not.toBeNull();
  });
  it("yaroqsizlarini rad etadi", () => {
    const bad: unknown[] = [null, 5, "x", [], {}, { t: "z" }, { t: "b" },
      { t: "b", id: 1, c: 9, w: 0, p: [1, 2] }, { t: "b", id: 1, c: 0, w: 5, p: [1, 2] }, { t: "b", id: -1, c: 0, w: 0, p: [1, 2] },
      { t: "b", id: 1, c: 0, w: 0, p: [1] }, { t: "b", id: 1, c: 0, w: 0, p: [] }, { t: "b", id: 1, c: 0, w: 0, p: [1, 2, 3] },
      { t: "b", id: 1, c: 0, w: 0, p: [BOARD_X + 1, 0] }, { t: "b", id: 1, c: 0, w: 0, p: [0, BOARD_Y + 1] }, { t: "b", id: 1, c: 0, w: 0, p: [1.5, 2] },
      { t: "b", id: 1, c: 0, w: 0, p: ["1", 2] }, { t: "b", id: 1, c: 0, w: 0, p: [NaN, 2] },
      { t: "b", id: 1, c: 0, w: 0, p: new Array(MAX_MSG_NUMS + 2).fill(1) },
      { t: "snap", i: 1, n: 1, strokes: [] }, { t: "snap", i: 0, n: 1 }, { t: "snap", i: 0, n: 1, strokes: [{ id: 1 }] }];
    for (const b of bad) expect(parseBoard(b), JSON.stringify(b)).toBeNull();
  });
  it("snap xabarini tekshiradi", () => {
    const m = parseBoard({ t: "snap", i: 0, n: 2, strokes: [{ id: 1, c: 0, w: 1, e: true, p: [1, 2, 3, 4] }] });
    expect(m).toEqual({ t: "snap", i: 0, n: 2, strokes: [{ id: 1, c: 0, w: 1, e: true, p: [1, 2, 3, 4] }] });
  });
});

describe("BoardStore", () => {
  it("nuqtalar bir chiziqqa qo'shiladi, yangi id yangi chiziq", () => {
    const b = new BoardStore();
    expect(b.apply({ t: "b", id: 1, c: 0, w: 0, p: [1, 1, 2, 2] })).toBe(true);
    b.apply({ t: "b", id: 1, c: 0, w: 0, p: [3, 3] });
    b.apply({ t: "b", id: 2, c: 2, w: 1, e: 1, p: [9, 9] });
    expect(b.strokes).toHaveLength(2);
    expect(b.strokes[0]!.p).toEqual([1, 1, 2, 2, 3, 3]);
    expect(b.strokes[1]).toMatchObject({ id: 2, c: 2, w: 1, e: true });
  });
  it("bekor qilish va tozalash", () => {
    const b = new BoardStore();
    b.apply(line(1, 3)); b.apply(line(2, 3));
    expect(b.apply({ t: "u" })).toBe(true);
    expect(b.strokes.map((s) => s.id)).toEqual([1]);
    expect(b.apply({ t: "x" })).toBe(true);
    expect(b.strokes).toEqual([]);
    expect(b.apply({ t: "u" })).toBe(false);
    expect(b.apply({ t: "x" })).toBe(false);
    b.apply(line(3, 2)); // tozalangandan keyin sanagich nolga qaytgan
    expect(b.full).toBe(false);
  });
  it("chiziqlar soni cheklangan: eskilari tashlanadi", () => {
    const b = new BoardStore();
    for (let i = 0; i < MAX_STROKES + 25; i++) b.apply(line(i, 1));
    expect(b.strokes).toHaveLength(MAX_STROKES);
    expect(b.strokes[0]!.id).toBe(25);
  });
  it("nuqtalar umumiy soni cheklangan: doska to'lsa, ortiqchasi qo'shilmaydi", () => {
    const b = new BoardStore();
    for (let i = 0; i < MAX_NUMS / MAX_MSG_NUMS + 5; i++) b.apply({ t: "b", id: 1, c: 0, w: 0, p: new Array(MAX_MSG_NUMS).fill(5) });
    expect(b.strokes[0]!.p.length).toBe(MAX_NUMS);
    expect(b.full).toBe(true);
    expect(b.apply(line(2, 3))).toBe(false);
  });
  it("snapshot: bo'laklarga bo'linadi, qabul qiluvchida aynan shunday doska chiqadi", () => {
    const a = new BoardStore();
    for (let i = 1; i <= 30; i++) a.apply(line(i, 100, { c: i % 6, e: i % 7 === 0 ? 1 : undefined }));
    a.apply({ t: "b", id: 99, c: 3, w: 2, p: Array.from({ length: 800 }, (_, i) => i % 5000) }); // juda uzun chiziq bo'linadi
    const snaps = a.snapshot();
    expect(snaps.length).toBeGreaterThan(1);
    for (const s of snaps) expect(JSON.stringify(s).length).toBeLessThan(14000);
    const b = new BoardStore();
    b.apply({ t: "b", id: 500, c: 0, w: 0, p: [7, 7] }); // eski narsa snapshotdan keyin qolmasligi kerak
    for (const s of snaps) { const m = parseBoard(JSON.parse(JSON.stringify(s))); expect(m).not.toBeNull(); b.apply(m!); }
    expect(b.strokes).toEqual(a.strokes);
  });
  it("bo'sh doskaning snapshoti ham bitta bo'lak (qabul qiluvchi eskisini tozalaydi)", () => {
    const snaps = new BoardStore().snapshot();
    expect(snaps).toEqual([{ t: "snap", i: 0, n: 1, strokes: [] }]);
    const b = new BoardStore(); b.apply(line(1, 2)); b.apply(snaps[0]!);
    expect(b.strokes).toEqual([]);
  });
});
