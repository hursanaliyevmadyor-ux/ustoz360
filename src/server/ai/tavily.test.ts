import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  db: { webSearchCache: { findUnique: vi.fn(), upsert: vi.fn(), deleteMany: vi.fn() }, aiRequest: { count: vi.fn(), create: vi.fn() } },
}));
vi.mock("../db", () => ({ db: h.db }));

import { cacheKey, creditsThisMonth, tavilyConfigured, tavilyMonthlyCap, tavilyRemoteUsage, tavilySearch } from "./tavily";

const calls: { url: string; init: { headers: Record<string, string>; body?: string } }[] = [];
let respond: (url: string) => { status: number; json?: unknown };
const HITS = [{ title: "Qonun", url: "https://lex.uz/docs/1", content: "Matn", score: 0.9 }];

beforeEach(() => {
  vi.clearAllMocks(); calls.length = 0;
  process.env.TAVILY_API_KEY = "tv-secret-key"; delete process.env.TAVILY_API_BASE; delete process.env.TAVILY_MONTHLY_CAP;
  h.db.webSearchCache.findUnique.mockResolvedValue(null); h.db.webSearchCache.upsert.mockResolvedValue({}); h.db.webSearchCache.deleteMany.mockResolvedValue({});
  h.db.aiRequest.count.mockResolvedValue(0); h.db.aiRequest.create.mockResolvedValue({});
  respond = () => ({ status: 200, json: { results: HITS } });
  vi.stubGlobal("fetch", vi.fn(async (url: string, init: { headers: Record<string, string>; body?: string }) => {
    calls.push({ url, init });
    const r = respond(url);
    return new Response(JSON.stringify(r.json ?? {}), { status: r.status });
  }));
});

describe("Tavily mijozi", () => {
  it("kalit bo'lmasa so'rov yuborilmaydi", async () => {
    delete process.env.TAVILY_API_KEY;
    expect(tavilyConfigured()).toBe(false);
    expect(await tavilySearch("u1", "savol")).toBeNull();
    expect(calls).toHaveLength(0);
  });

  it("qidiradi, kreditni hisoblaydi va natijani keshlaydi; kalit faqat sarlavhada", async () => {
    const r = await tavilySearch("u1", "Attestatsiya qachon?");
    expect(r).toEqual({ hits: HITS, cached: false });
    expect(calls[0].url).toBe("https://api.tavily.com/search");
    expect(calls[0].init.headers.authorization).toBe("Bearer tv-secret-key");
    expect(calls[0].init.body).not.toContain("tv-secret-key");
    expect(JSON.parse(calls[0].init.body!)).toMatchObject({ query: "Attestatsiya qachon?", search_depth: "basic", max_results: 8, include_answer: false });
    expect(h.db.aiRequest.create).toHaveBeenCalledWith({ data: expect.objectContaining({ userId: "u1", feature: "web-credit", model: "tavily", status: "ok" }) });
    expect(h.db.webSearchCache.upsert).toHaveBeenCalledTimes(1);
  });

  it("kesh bor bo'lsa API chaqirilmaydi va kredit sarflanmaydi", async () => {
    h.db.webSearchCache.findUnique.mockResolvedValue({ key: "k", results: HITS, createdAt: new Date(Date.now() - 3_600_000) });
    const r = await tavilySearch("u1", "Attestatsiya qachon?");
    expect(r).toEqual({ hits: HITS, cached: true });
    expect(calls).toHaveLength(0);
    expect(h.db.aiRequest.create).not.toHaveBeenCalled();
  });

  it("eskirgan kesh (12 soatdan keyin; yangilik muhim bo'lsa 3 soatdan keyin) yangilanadi", async () => {
    h.db.webSearchCache.findUnique.mockResolvedValue({ key: "k", results: HITS, createdAt: new Date(Date.now() - 13 * 3_600_000) });
    expect((await tavilySearch("u1", "savol"))?.cached).toBe(false);
    h.db.webSearchCache.findUnique.mockResolvedValue({ key: "k", results: HITS, createdAt: new Date(Date.now() - 5 * 3_600_000) });
    expect((await tavilySearch("u1", "savol2"))?.cached).toBe(true);
    expect((await tavilySearch("u1", "savol3", { fresh: true }))?.cached).toBe(false);
  });

  it("oylik chegaraga yetgan bo'lsa (kesh yo'q) so'rov yuborilmaydi; kesh esa baribir beriladi", async () => {
    h.db.aiRequest.count.mockResolvedValue(900);
    expect(await tavilySearch("u1", "savol")).toBeNull();
    expect(calls).toHaveLength(0);
    h.db.webSearchCache.findUnique.mockResolvedValue({ key: "k", results: HITS, createdAt: new Date() });
    expect((await tavilySearch("u1", "savol"))?.cached).toBe(true);
    process.env.TAVILY_MONTHLY_CAP = "50";
    expect(tavilyMonthlyCap()).toBe(50);
  });

  it("rasmiy domenlar va 'yangi' rejimi so'rovga qo'shiladi", async () => {
    await tavilySearch("u1", "qaror", { includeDomains: ["lex.uz", "gov.uz"], fresh: true });
    expect(JSON.parse(calls[0].init.body!)).toMatchObject({ include_domains: ["lex.uz", "gov.uz"], time_range: "year" });
    calls.length = 0;
    await tavilySearch("u1", "boshqa savol");
    const b = JSON.parse(calls[0].init.body!);
    expect(b.include_domains).toBeUndefined();
    expect(b.time_range).toBeUndefined();
  });

  it("xato (429, 500) va tarmoq xatosida null; kredit yozilmaydi, kesh yozilmaydi", async () => {
    respond = () => ({ status: 429 });
    expect(await tavilySearch("u1", "savol")).toBeNull();
    respond = () => ({ status: 500 });
    expect(await tavilySearch("u1", "savol2")).toBeNull();
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("tarmoq"); }));
    expect(await tavilySearch("u1", "savol3")).toBeNull();
    expect(h.db.aiRequest.create).not.toHaveBeenCalled();
    expect(h.db.webSearchCache.upsert).not.toHaveBeenCalled();
  });

  it("bo'sh natija keshlanmaydi (lekin kredit sarflangan)", async () => {
    respond = () => ({ status: 200, json: { results: [] } });
    expect(await tavilySearch("u1", "hech narsa")).toEqual({ hits: [], cached: false });
    expect(h.db.webSearchCache.upsert).not.toHaveBeenCalled();
    expect(h.db.aiRequest.create).toHaveBeenCalledTimes(1);
  });

  it("kesh jadvali bo'lmasa (xato) qidiruv ishlayveradi", async () => {
    h.db.webSearchCache.findUnique.mockRejectedValue(new Error("relation does not exist"));
    h.db.webSearchCache.upsert.mockRejectedValue(new Error("relation does not exist"));
    expect(await tavilySearch("u1", "savol")).toEqual({ hits: HITS, cached: false });
  });

  it("kesh kaliti: katta-kichik harf va bo'shliqqa befarq, sozlamaga sezgir", () => {
    expect(cacheKey("Attestatsiya  Qachon?")).toBe(cacheKey("attestatsiya qachon?"));
    expect(cacheKey("savol")).not.toBe(cacheKey("savol", { fresh: true }));
    expect(cacheKey("savol")).not.toBe(cacheKey("savol", { includeDomains: ["lex.uz"] }));
    expect(cacheKey("savol", { includeDomains: ["b.uz", "a.uz"] })).toBe(cacheKey("savol", { includeDomains: ["a.uz", "b.uz"] }));
  });

  it("shu oy sarflangan kreditlar faqat haqiqiy so'rovlardan hisoblanadi", async () => {
    h.db.aiRequest.count.mockResolvedValue(37);
    expect(await creditsThisMonth(new Date("2026-10-18T00:00:00Z"))).toBe(37);
    expect(h.db.aiRequest.count).toHaveBeenCalledWith({ where: { feature: "web-credit", model: "tavily", status: "ok", createdAt: { gte: new Date("2026-10-01T00:00:00Z") } } });
  });

  it("Tavily hisobidagi sarf (/usage) o'qiladi; shakl o'zgargan yoki xato bo'lsa null", async () => {
    respond = () => ({ status: 200, json: { account: { current_plan: "Researcher", plan_usage: 120, plan_limit: 1000 }, key: { usage: 5 } } });
    expect(await tavilyRemoteUsage()).toEqual({ used: 120, limit: 1000, plan: "Researcher" });
    expect(calls.at(-1)!.url).toBe("https://api.tavily.com/usage");
    respond = () => ({ status: 200, json: { key: { usage: 7, limit: null } } });
    expect(await tavilyRemoteUsage()).toEqual({ used: 7, limit: null, plan: null });
    respond = () => ({ status: 200, json: { boshqa: 1 } });
    expect(await tavilyRemoteUsage()).toBeNull();
    respond = () => ({ status: 404 });
    expect(await tavilyRemoteUsage()).toBeNull();
    delete process.env.TAVILY_API_KEY;
    expect(await tavilyRemoteUsage()).toBeNull();
  });

  it("TAVILY_API_BASE (faqat sinov uchun) manzilni almashtiradi", async () => {
    process.env.TAVILY_API_BASE = "http://127.0.0.1:8098/";
    await tavilySearch("u1", "savol");
    expect(calls[0].url).toBe("http://127.0.0.1:8098/search");
  });
});
