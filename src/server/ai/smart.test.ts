import { beforeEach, describe, expect, it, vi } from "vitest";

process.env.AUTH_SECRET = "x".repeat(40);

const h = vi.hoisted(() => ({ settings: vi.fn(), free: vi.fn(), web: vi.fn(), configured: vi.fn() }));
vi.mock("../settings", () => ({ getSettings: h.settings }));
vi.mock("./gateway", () => ({ runFreeAi: h.free }));
vi.mock("./websearch", () => ({ runWebSearch: h.web, webSearchConfigured: h.configured }));

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
