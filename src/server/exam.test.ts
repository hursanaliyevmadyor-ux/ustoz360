import { beforeEach, describe, expect, it, vi } from "vitest";

process.env.AUTH_SECRET = "x".repeat(40);

const h = vi.hoisted(() => ({
  db: {
    exam: { findFirst: vi.fn() },
    examAttempt: { findFirst: vi.fn(), create: vi.fn() },
  },
}));
vi.mock("./db", () => ({ db: h.db }));

import { gradeAttempt, isWrittenCorrect, normalizeAnswer, shuffled, startAttempt, type OrderItem, type QuestionRow } from "./exam";

const { db } = h;
beforeEach(() => { vi.clearAllMocks(); });

describe("shuffled", () => {
  it("elementlarni yo'qotmaydi va ko'paytirmaydi", () => {
    const src = Array.from({ length: 30 }, (_, i) => i);
    expect([...shuffled(src)].sort((a, b) => a - b)).toEqual(src);
  });
  it("asl massivni o'zgartirmaydi va har safar boshqacha tartib beradi", () => {
    const src = Array.from({ length: 12 }, (_, i) => i);
    const copy = [...src];
    const seen = new Set<string>();
    for (let i = 0; i < 10; i++) seen.add(shuffled(src).join(","));
    expect(src).toEqual(copy);
    expect(seen.size).toBeGreaterThan(5);
  });
});

describe("yozma javobni solishtirish", () => {
  it("katta-kichik harf, bo'shliq va oxirgi tinish belgisiga e'tibor bermaydi", () => {
    expect(isWrittenCorrect("  NYUTON. ", ["nyuton"])).toBe(true);
    expect(isWrittenCorrect("tinch   okean", ["Tinch okean"])).toBe(true);
  });
  it("o'zbekcha apostrof turlarini tenglashtiradi", () => {
    expect(normalizeAnswer("O‘zbekiston")).toBe(normalizeAnswer("O'zbekiston"));
    expect(normalizeAnswer("Oʻzbekiston")).toBe("o'zbekiston");
  });
  it("sonlarni qiymati bo'yicha solishtiradi (9,8 = 9.8, 300 000 = 300000)", () => {
    expect(isWrittenCorrect("9,8", ["9.8"])).toBe(true);
    expect(isWrittenCorrect("300 000", ["300000"])).toBe(true);
    expect(isWrittenCorrect("25.0", ["25"])).toBe(true);
    expect(isWrittenCorrect("26", ["25"])).toBe(false);
  });
  it("bo'sh javob hech qachon to'g'ri emas", () => {
    expect(isWrittenCorrect("   ", ["", " "])).toBe(false);
  });
});

const row = (p: Partial<QuestionRow> & { id: string }): QuestionRow => ({ type: "CHOICE", text: "?", options: ["a", "b", "c", "d"], correct: 0, accepted: null, explanation: null, ...p });

describe("gradeAttempt", () => {
  it("variantlarni aralashtirilgan tartibdan asl tartibga qaytarib tekshiradi", () => {
    // asl: [a,b,c,d], to'g'ri = a (0). Ekranda tartib: perm = [2,0,3,1] => [c,a,d,b], "a" ko'rsatilgan 1-indeksda.
    const order: OrderItem[] = [{ q: "q1", perm: [2, 0, 3, 1] }];
    const qs = new Map([["q1", row({ id: "q1" })]]);
    expect(gradeAttempt(order, { q1: { c: 1 } }, qs).score).toBe(1);
    expect(gradeAttempt(order, { q1: { c: 0 } }, qs).score).toBe(0);
    expect(gradeAttempt(order, {}, qs).score).toBe(0);
  });
  it("tahlilda to'g'ri javobning ko'rsatilgan indeksini qaytaradi", () => {
    const order: OrderItem[] = [{ q: "q1", perm: [3, 2, 1, 0] }];
    const r = gradeAttempt(order, { q1: { c: 0 } }, new Map([["q1", row({ id: "q1" })]]));
    expect(r.review[0]).toMatchObject({ correct: 3, chosen: 0, ok: false });
    expect(r.review[0].options).toEqual(["d", "c", "b", "a"]);
  });
  it("yozma va variantli savollarni birga baholaydi", () => {
    const order: OrderItem[] = [{ q: "q1", perm: [0, 1, 2, 3] }, { q: "q2" }, { q: "q3" }];
    const qs = new Map<string, QuestionRow>([
      ["q1", row({ id: "q1", correct: 2 })],
      ["q2", row({ id: "q2", type: "WRITTEN", options: null, correct: null, accepted: ["100"] })],
      ["q3", row({ id: "q3", type: "WRITTEN", options: null, correct: null, accepted: ["nyuton", "N"] })],
    ]);
    const r = gradeAttempt(order, { q1: { c: 2 }, q2: { t: "100" }, q3: { t: "juul" } }, qs);
    expect(r).toMatchObject({ score: 2, total: 3 });
    expect(r.review.map((x) => x.ok)).toEqual([true, true, false]);
  });
});

describe("startAttempt: har urinishda yangi tartib", () => {
  const exam = (n: number, extra: Record<string, unknown> = {}) => ({
    id: "E1", durationMin: 20, pickCount: null, ...extra,
    questions: Array.from({ length: n }, (_, i) => ({ id: `q${i}`, type: i % 4 === 3 ? "WRITTEN" : "CHOICE", options: ["a", "b", "c", "d"] })),
  });

  it("barcha savollar bir martadan, variantlar tartibi to'liq almashtirma (permutatsiya)", async () => {
    db.exam.findFirst.mockResolvedValue(exam(12)); db.examAttempt.findFirst.mockResolvedValue(null); db.examAttempt.create.mockResolvedValue({ id: "A1" });
    await startAttempt("u1", "x");
    const order = db.examAttempt.create.mock.calls[0][0].data.order as OrderItem[];
    expect(order.map((o) => o.q).sort()).toEqual(Array.from({ length: 12 }, (_, i) => `q${i}`).sort());
    for (const o of order) if (o.perm) expect([...o.perm].sort()).toEqual([0, 1, 2, 3]);
    expect(order.filter((o) => !o.perm).length).toBe(3);
  });

  it("ketma-ket urinishlarda tartib bir xil bo'lib qolmaydi", async () => {
    db.exam.findFirst.mockResolvedValue(exam(12)); db.examAttempt.findFirst.mockResolvedValue(null); db.examAttempt.create.mockResolvedValue({ id: "A" });
    const seen = new Set<string>();
    for (let i = 0; i < 8; i++) { await startAttempt("u1", "x"); seen.add(JSON.stringify(db.examAttempt.create.mock.calls.at(-1)![0].data.order)); }
    expect(seen.size).toBeGreaterThan(4);
  });

  it("pickCount bo'lsa, banka ichidan shuncha savol tanlanadi", async () => {
    db.exam.findFirst.mockResolvedValue(exam(12, { pickCount: 5 })); db.examAttempt.findFirst.mockResolvedValue(null); db.examAttempt.create.mockResolvedValue({ id: "A1" });
    await startAttempt("u1", "x");
    expect((db.examAttempt.create.mock.calls[0][0].data.order as OrderItem[]).length).toBe(5);
  });

  it("tugallanmagan urinish bo'lsa, yangisi ochilmaydi, o'shani davom ettiradi", async () => {
    db.exam.findFirst.mockResolvedValue(exam(6)); db.examAttempt.findFirst.mockResolvedValue({ id: "OLD" });
    expect(await startAttempt("u1", "x")).toEqual({ id: "OLD", resumed: true });
    expect(db.examAttempt.create).not.toHaveBeenCalled();
  });

  it("imtihon topilmasa 404", async () => {
    db.exam.findFirst.mockResolvedValue(null);
    await expect(startAttempt("u1", "yoq")).rejects.toMatchObject({ status: 404 });
  });
});
