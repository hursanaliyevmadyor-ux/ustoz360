import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({ db: { officialInfo: { findMany: vi.fn() }, libraryDoc: { findMany: vi.fn() }, libraryChunk: { findMany: vi.fn() } } }));
vi.mock("../db", () => ({ db: h.db }));

import { kbScore, kbStrong, questionTokenCount, searchKnowledge } from "./kb";

describe("bilim bazasi moslik bahosi", () => {
  it("savol so'zlarining qanchasi matnda borligi (o'zbekcha qo'shimchalarga chidamli)", () => {
    const s = kbScore("attestatsiya muddatlari qachon", "Attestatsiya muddatlari 2026-yil mart oyida");
    expect(s.matched).toBe(2); // "qachon" to'xtatuvchi so'z
    expect(s.ratio).toBe(1);
    expect(kbScore("kasrlarni qo'shish", "Oddiy kasrlar va ularni qo'shish").matched).toBe(2);
    expect(kbScore("fizika", "Kimyo darsligi")).toEqual({ matched: 0, ratio: 0 });
    expect(kbScore("", "matn")).toEqual({ matched: 0, ratio: 0 });
  });

  it("yetarli moslik: kamida 2 ta so'z (savol qisqa bo'lsa 1 ta) va 60%", () => {
    expect(kbStrong({ matched: 3, ratio: 0.75 }, 4)).toBe(true);
    expect(kbStrong({ matched: 1, ratio: 0.5 }, 2)).toBe(false);
    expect(kbStrong({ matched: 2, ratio: 0.4 }, 5)).toBe(false);
    expect(kbStrong({ matched: 1, ratio: 1 }, 1)).toBe(true);
    expect(kbStrong({ matched: 0, ratio: 0 }, 0)).toBe(false);
    expect(questionTokenCount("Attestatsiya muddatlari qachon?")).toBe(2);
  });
});

describe("bilim bazasini qidirish", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.db.officialInfo.findMany.mockResolvedValue([]); h.db.libraryDoc.findMany.mockResolvedValue([]); h.db.libraryChunk.findMany.mockResolvedValue([]);
  });

  it("rasmiy ma'lumotlardan mos yozuvlar; tekshirilgan belgisi va faqat https havola saqlanadi", async () => {
    const now = new Date();
    h.db.officialInfo.findMany.mockResolvedValue([
      { title: "Attestatsiya muddatlari", note: "Mart oyida boshlanadi", sourceName: "Vazirlik", url: "https://lex.uz/docs/1", verified: true, verifiedAt: now, updatedAt: now },
      { title: "Imtihon sanalari", note: "Iyun", sourceName: null, url: "http://insecure.uz", verified: false, verifiedAt: null, updatedAt: now },
      { title: "Boshqa mavzu", note: "Fizika", sourceName: null, url: null, verified: true, verifiedAt: now, updatedAt: now },
    ]);
    const r = await searchKnowledge("attestatsiya muddatlari");
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ kind: "official", title: "Attestatsiya muddatlari", url: "https://lex.uz/docs/1", verified: true, fresh: true, matched: 2, ratio: 1 });
    expect(h.db.officialInfo.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { active: true } }));
  });

  it("faqat ommaviy va tayyor kutubxona hujjatlarining mos parchalari; tartib moslik bo'yicha", async () => {
    h.db.libraryDoc.findMany.mockResolvedValue([{ id: "d1", title: "Formativ baholash qo'llanmasi" }]);
    h.db.libraryChunk.findMany.mockResolvedValue([
      { docId: "d1", text: "Formativ baholash usullari: kuzatuv, so'rov." },
      { docId: "d1", text: "Boshqa mavzu haqida matn." },
    ]);
    const r = await searchKnowledge("formativ baholash usullari", "https://site.uz");
    expect(r).toEqual([expect.objectContaining({ kind: "library", title: "Formativ baholash qo'llanmasi", url: "https://site.uz/bilimxona", verified: true })]);
    const where = h.db.libraryDoc.findMany.mock.calls[0][0].where;
    expect(where).toMatchObject({ visibility: "PUBLIC", status: "READY" });
    expect(JSON.stringify(where.OR)).toContain("formativ");
  });

  it("savoldan so'z chiqmasa yoki baza xato bersa bo'sh natija (xato tashlanmaydi)", async () => {
    expect(await searchKnowledge("va bu")).toEqual([]);
    h.db.officialInfo.findMany.mockRejectedValue(new Error("baza")); h.db.libraryDoc.findMany.mockRejectedValue(new Error("baza"));
    expect(await searchKnowledge("attestatsiya muddatlari")).toEqual([]);
  });

  it("yozuv 'yangi' hisoblanishi: tekshirilgan va 45 kun ichida yangilangan bo'lsa", async () => {
    const old = new Date(Date.now() - 60 * 86_400_000);
    h.db.officialInfo.findMany.mockResolvedValue([
      { title: "Eski yozuv attestatsiya", note: null, sourceName: null, url: null, verified: true, verifiedAt: old, updatedAt: old },
      { title: "Tekshirilmagan attestatsiya", note: null, sourceName: null, url: null, verified: false, verifiedAt: null, updatedAt: new Date() },
      { title: "Yangi attestatsiya", note: null, sourceName: null, url: null, verified: true, verifiedAt: null, updatedAt: new Date() },
    ]);
    const r = await searchKnowledge("attestatsiya");
    expect(Object.fromEntries(r.map((x) => [x.title, x.fresh]))).toEqual({ "Eski yozuv attestatsiya": false, "Tekshirilmagan attestatsiya": false, "Yangi attestatsiya": true });
  });

  it("natija 4 tagacha, eng mosi birinchi", async () => {
    h.db.officialInfo.findMany.mockResolvedValue(Array.from({ length: 8 }, (_, i) => ({ title: i === 5 ? "Attestatsiya muddatlari" : `Attestatsiya ${i}`, note: null, sourceName: null, url: null, verified: true, verifiedAt: null, updatedAt: new Date() })));
    const r = await searchKnowledge("attestatsiya muddatlari");
    expect(r).toHaveLength(4);
    expect(r[0].title).toBe("Attestatsiya muddatlari");
  });
});
