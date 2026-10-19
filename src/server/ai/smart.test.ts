import { beforeEach, describe, expect, it, vi } from "vitest";

process.env.AUTH_SECRET = "x".repeat(40);

const h = vi.hoisted(() => ({
  settings: vi.fn(), free: vi.fn(), web: vi.fn(), configured: vi.fn(),
  mode: vi.fn(), lookup: vi.fn(), serve: vi.fn(), record: vi.fn(), propose: vi.fn(),
}));
vi.mock("../settings", () => ({ getSettings: h.settings }));
vi.mock("./gateway", () => ({ runFreeAi: h.free }));
vi.mock("./websearch", () => ({ runWebSearch: h.web, webSearchConfigured: h.configured }));
vi.mock("../hub/knowledge", () => ({ hubMode: h.mode, hubLookup: h.lookup, serveDirect: h.serve, recordOutcome: h.record, proposeCandidate: h.propose }));

import { ApiError } from "../auth";
import { smartFreeChat } from "./smart";

const Q = (c: string) => [{ role: "user" as const, content: c }];
const WEB = { text: "Mart oyida [1].", sources: [{ title: "lex.uz", url: "https://lex.uz/1", trust: "official" }], queries: [], engine: "tavily" };

beforeEach(() => {
  vi.clearAllMocks();
  h.configured.mockReturnValue(true);
  h.settings.mockResolvedValue({ ai: { webAuto: true } });
  h.free.mockResolvedValue({ text: "Oddiy AI javobi", model: "m" });
  h.web.mockResolvedValue(WEB);
  h.mode.mockResolvedValue("off");
  h.lookup.mockResolvedValue(null);
  h.serve.mockResolvedValue(undefined); h.record.mockResolvedValue(undefined); h.propose.mockResolvedValue({ created: false });
});

describe("chat: avtomatik internet qidiruvi", () => {
  it("yangi/rasmiy ma'lumot so'ralsa qidiruv oqimi ishlaydi, manbalar bilan", async () => {
    const r = await smartFreeChat("u1", Q("Attestatsiya qachon boshlanadi?"), { origin: "https://site.uz" });
    expect(r).toMatchObject({ reply: "Mart oyida [1].", searched: true, engine: "tavily", sources: [{ url: "https://lex.uz/1" }] });
    expect(h.web).toHaveBeenCalledWith("u1", expect.any(Array), { origin: "https://site.uz" });
    expect(h.free).not.toHaveBeenCalled();
  });

  it("tayyor material so'ralsa ham qidiriladi", async () => {
    await smartFreeChat("u1", Q("11-sinf 4-chorak matematika testlari"));
    expect(h.web).toHaveBeenCalled();
  });

  it("umumiy bilim va yaratish so'rovlari oddiy AI'ga ketadi (kredit sarflanmaydi)", async () => {
    for (const q of ["Fotosintez nima?", "5-sinf matematika dars rejasi tuzib ber"]) {
      const r = await smartFreeChat("u1", Q(q));
      expect(r).toEqual({ reply: "Oddiy AI javobi", sources: [], queries: [], searched: false });
    }
    expect(h.web).not.toHaveBeenCalled();
  });

  it("administrator avtomatik qidirishni o'chirgan bo'lsa yoki xizmat ulanmagan bo'lsa oddiy AI", async () => {
    h.settings.mockResolvedValue({ ai: { webAuto: false } });
    expect((await smartFreeChat("u1", Q("Attestatsiya qachon boshlanadi?"))).searched).toBe(false);
    h.settings.mockResolvedValue({ ai: { webAuto: true } }); h.configured.mockReturnValue(false);
    expect((await smartFreeChat("u1", Q("Attestatsiya qachon boshlanadi?"))).searched).toBe(false);
    expect(h.web).not.toHaveBeenCalled();
  });

  it("qidiruv imkonsiz bo'lsa (limit, xizmat yo'q, natija yo'q) foydalanuvchi to'silmaydi: oddiy AI javob beradi", async () => {
    for (const code of ["web_daily_limit", "web_unavailable", "web_no_results", "web_unconfigured"]) {
      h.web.mockRejectedValueOnce(new ApiError(503, "x", code));
      const r = await smartFreeChat("u1", Q("Attestatsiya qachon boshlanadi?"));
      expect(r.searched, code).toBe(false);
      expect(r.reply).toBe("Oddiy AI javobi");
    }
  });

  it("boshqa xatolar (daqiqalik chegara, email tasdiqlanmagan) o'tkazib yuborilmaydi", async () => {
    h.web.mockRejectedValueOnce(new ApiError(429, "Tez", "rate_limited"));
    await expect(smartFreeChat("u1", Q("Attestatsiya qachon boshlanadi?"))).rejects.toMatchObject({ code: "rate_limited" });
    h.web.mockRejectedValueOnce(new Error("kutilmagan"));
    await expect(smartFreeChat("u1", Q("Attestatsiya qachon boshlanadi?"))).rejects.toThrow("kutilmagan");
    expect(h.free).not.toHaveBeenCalled();
  });

  it("sozlamalarni o'qib bo'lmasa avtomatik qidirish ishlamaydi (xavfsiz tomonga)", async () => {
    h.settings.mockRejectedValue(new Error("baza"));
    expect((await smartFreeChat("u1", Q("Attestatsiya qachon boshlanadi?"))).searched).toBe(false);
  });
});

const ENTRY = { id: "e1", questionCanonical: "Kasrlarni qo'shish qoidasi", answer: "Umumiy maxraj topiladi, suratlar qo'shiladi.", subject: "matematika", topic: "Kasrlar", category: "general", status: "APPROVED", scope: "GLOBAL", expiresAt: null, reviewedAt: new Date("2026-10-05T00:00:00Z"), sourceReferences: [{ title: "Darslik", url: "https://edu.uz/k" }] };
const HIT = { entry: ENTRY, matched: 3, dice: 1, ratio: 1, answerRatio: 1 };
const lookup = (decision: unknown) => ({ decision, subject: "matematika", topic: "Kasrlar", needsFresh: false });

describe("chat: AI Bilim markazi (hubMode)", () => {
  it("off: bilim markazi umuman chaqirilmaydi, javob avvalgidek", async () => {
    const r = await smartFreeChat("u1", Q("Kasrlarni qo'shish qoidasi nima?"));
    expect(r).toEqual({ reply: "Oddiy AI javobi", sources: [], queries: [], searched: false });
    expect(h.lookup).not.toHaveBeenCalled(); expect(h.record).not.toHaveBeenCalled(); expect(h.propose).not.toHaveBeenCalled();
  });

  it("on + to'g'ridan-to'g'ri mos: AI chaqirilmaydi, manbali javob va belgi qaytadi", async () => {
    h.mode.mockResolvedValue("on"); h.lookup.mockResolvedValue(lookup({ kind: "direct", hit: HIT }));
    const r = await smartFreeChat("u1", Q("Kasrlarni qo'shish qoidasi nima?"));
    expect(r.origin).toBe("kb"); expect(r.entryId).toBe("e1"); expect(r.searched).toBe(false);
    expect(r.reply).toContain("Umumiy maxraj topiladi"); expect(r.reply).toContain("✅ Tasdiqlangan bilim (tekshirilgan: 05.10.2026)");
    expect(r.sources).toEqual([{ title: "Darslik", url: "https://edu.uz/k", trust: "official" }]);
    expect(h.serve).toHaveBeenCalledWith("u1", "e1", expect.any(Number));
    expect(h.record).toHaveBeenCalledWith({ subject: "matematika", topic: "Kasrlar", outcome: "kb" });
    expect(h.free).not.toHaveBeenCalled(); expect(h.web).not.toHaveBeenCalled(); expect(h.propose).not.toHaveBeenCalled();
  });

  it("shadow: javob o'zgarmaydi (AI javob beradi), faqat «bo'lardi» natija o'lchanadi", async () => {
    h.mode.mockResolvedValue("shadow"); h.lookup.mockResolvedValue(lookup({ kind: "direct", hit: HIT }));
    const r = await smartFreeChat("u1", Q("Kasrlarni qo'shish qoidasi nima?"));
    expect(r.reply).toBe("Oddiy AI javobi"); expect(r.origin).toBeUndefined();
    expect(h.serve).not.toHaveBeenCalled();
    expect(h.free.mock.calls[0][2]).toBeUndefined(); // tayanch (system) berilmaydi
    expect(h.record).toHaveBeenCalledWith({ subject: "matematika", topic: "Kasrlar", outcome: "kb" });
  });

  it("on + qisman mos: yozuv AI ga «ma'lumot bloki» sifatida tayanch bo'ladi; natija «grounded»", async () => {
    h.mode.mockResolvedValue("on"); h.lookup.mockResolvedValue(lookup({ kind: "grounded", hits: [HIT] }));
    await smartFreeChat("u1", Q("Kasrlarni qo'shish va ayirish farqi nima?"));
    expect(h.free.mock.calls[0][2].system).toContain("<tasdiqlangan_bilim>");
    expect(h.free.mock.calls[0][2].system).toContain("Umumiy maxraj topiladi");
    expect(h.record).toHaveBeenCalledWith({ subject: "matematika", topic: "Kasrlar", outcome: "grounded" });
  });

  it("on: topilmasa AI javob beradi va nomzod taklif qilinadi (shartlarni nomzod funksiyasi tekshiradi)", async () => {
    h.mode.mockResolvedValue("on"); h.lookup.mockResolvedValue(lookup({ kind: "none" }));
    h.free.mockResolvedValue({ text: "Yangi AI javobi", model: "m", provider: "free2" });
    const r = await smartFreeChat("u1", Q("Kasrlarni qo'shish qoidasi nima?"));
    expect(r.reply).toBe("Yangi AI javobi");
    expect(h.record).toHaveBeenCalledWith({ subject: "matematika", topic: "Kasrlar", outcome: "ai" });
    expect(h.propose).toHaveBeenCalledWith(expect.objectContaining({ userId: "u1", mode: "on", kb: "none", answer: "Yangi AI javobi", provider: "free2", model: "m" }));
  });

  it("on: tashqariga ketadigan matndan shaxsiy ma'lumot olib tashlanadi, o'zgarmas matn buzilmaydi", async () => {
    h.mode.mockResolvedValue("on"); h.lookup.mockResolvedValue(lookup({ kind: "none" }));
    await smartFreeChat("u1", [{ role: "user", content: "Menga +998 90 123 45 67 ga yozing, kasrlarni qo'shish qoidasi nima?" }]);
    expect(h.free.mock.calls[0][1][0].content).toBe("Menga [telefon] ga yozing, kasrlarni qo'shish qoidasi nima?");
    h.free.mockClear(); h.mode.mockResolvedValue("shadow");
    await smartFreeChat("u1", [{ role: "user", content: "tel +998 90 123 45 67" }]);
    expect(h.free.mock.calls[0][1][0].content).toBe("tel +998 90 123 45 67"); // shadow javobga ta'sir qilmaydi
  });

  it("rasmiy ma'lumotdan (engine kb) chiqqan internet javobi nomzod bo'lmaydi; boshqa dvigatel bo'ladi", async () => {
    h.mode.mockResolvedValue("on"); h.lookup.mockResolvedValue(lookup({ kind: "none" }));
    h.web.mockResolvedValue({ ...WEB, engine: "kb", model: "m" });
    await smartFreeChat("u1", Q("Attestatsiya qachon boshlanadi?"));
    expect(h.propose).not.toHaveBeenCalled();
    h.web.mockResolvedValue({ ...WEB, engine: "tavily", model: "tavily" });
    await smartFreeChat("u1", Q("Attestatsiya qachon boshlanadi?"));
    expect(h.propose).toHaveBeenCalledWith(expect.objectContaining({ provider: "tavily", sources: [{ title: "lex.uz", url: "https://lex.uz/1", trust: "official" }] }));
  });

  it("AI xato bersa (5xx) ehtiyoj «javobsiz» deb yoziladi; limit xatosi (429) yozilmaydi; xato baribir uzatiladi", async () => {
    h.mode.mockResolvedValue("on"); h.lookup.mockResolvedValue(lookup({ kind: "none" }));
    h.free.mockRejectedValueOnce(new ApiError(503, "band"));
    await expect(smartFreeChat("u1", Q("Kasrlarni qo'shish qoidasi nima?"))).rejects.toMatchObject({ status: 503 });
    expect(h.record).toHaveBeenCalledWith({ subject: "matematika", topic: "Kasrlar", outcome: "error" });
    h.record.mockClear(); h.free.mockRejectedValueOnce(new ApiError(429, "limit", "daily_limit"));
    await expect(smartFreeChat("u1", Q("Kasrlarni qo'shish qoidasi nima?"))).rejects.toMatchObject({ status: 429 });
    expect(h.record).not.toHaveBeenCalled();
  });

  it("bilim markazi ishlamasa (lookup null) chat to'silmaydi", async () => {
    h.mode.mockResolvedValue("on"); h.lookup.mockResolvedValue(null);
    expect((await smartFreeChat("u1", Q("Kasrlarni qo'shish qoidasi nima?"))).reply).toBe("Oddiy AI javobi");
  });

  it("to'g'ridan-to'g'ri javobdan oldingi tekshiruv (tasdiqlanmagan akkaunt, chegara) xatosi uzatiladi", async () => {
    h.mode.mockResolvedValue("on"); h.lookup.mockResolvedValue(lookup({ kind: "direct", hit: HIT }));
    h.serve.mockRejectedValueOnce(new ApiError(429, "Tez", "rate_limited"));
    await expect(smartFreeChat("u1", Q("Kasrlarni qo'shish qoidasi nima?"))).rejects.toMatchObject({ code: "rate_limited" });
    expect(h.free).not.toHaveBeenCalled();
  });
});
