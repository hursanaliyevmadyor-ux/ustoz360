import { beforeEach, describe, expect, it, vi } from "vitest";

process.env.AUTH_SECRET = "x".repeat(40);

type Where = { userId?: string; feature?: string; status?: string; model?: unknown };
const h = vi.hoisted(() => ({
  counts: { user: 0, gemini: 0 },
  db: { aiRequest: { count: vi.fn(), create: vi.fn() }, webSearchCache: { count: vi.fn() } },
  settings: vi.fn(), verified: vi.fn(), rate: vi.fn(), llm: vi.fn(), kb: vi.fn(), tavily: vi.fn(), remote: vi.fn(), credits: vi.fn(),
}));
vi.mock("../db", () => ({ db: h.db }));
vi.mock("../settings", () => ({ getSettings: h.settings }));
vi.mock("../auth", async (orig) => ({ ...(await orig<typeof import("../auth")>()), requireVerified: h.verified }));
vi.mock("./gateway", () => ({ checkRate: h.rate }));
vi.mock("./structured", () => ({ runAnyAi: h.llm }));
vi.mock("./kb", async (orig) => ({ ...(await orig<typeof import("./kb")>()), searchKnowledge: h.kb }));
vi.mock("./tavily", async (orig) => ({ ...(await orig<typeof import("./tavily")>()), tavilySearch: h.tavily, tavilyRemoteUsage: h.remote, creditsThisMonth: h.credits }));

import { ApiError } from "../auth";
import type { KbHit } from "./kb";
import { runWebSearch, webHealth, webStats, webUsageToday } from "./websearch";

const ORIGIN = "https://site.example";
const calls: { url: string; init: { headers: Record<string, string>; body: string } }[] = [];
let respond: (url: string) => { status: number; json?: unknown };
const Q = (content: string) => [{ role: "user" as const, content }];

const lexHits = [
  { title: "Attestatsiya tartibi", url: "https://lex.uz/docs/9", content: "Attestatsiya 2026-yil mart oyida boshlanadi. ".repeat(4), score: 0.9 },
  { title: "Blog", url: "https://blog.uz/a", content: "Attestatsiya haqida fikrlar. ".repeat(4), score: 0.95 },
  { title: "Telegram", url: "https://t.me/x", content: "kanal posti ".repeat(8), score: 0.99 },
];
const geminiOk = { candidates: [{ content: { parts: [{ text: "2026-yil mart oyida." }] }, groundingMetadata: { groundingChunks: [{ web: { uri: "https://lex.uz/docs/1", title: "lex.uz" } }], webSearchQueries: ["attestatsiya 2026"] } }], usageMetadata: { promptTokenCount: 30, candidatesTokenCount: 12 } };
const kbHit = (o: Partial<KbHit> = {}): KbHit => ({ kind: "official", title: "Attestatsiya muddatlari", text: "Attestatsiya muddatlari: mart oyi. ".repeat(4), url: "https://lex.uz/docs/55", verified: true, fresh: false, ratio: 1, matched: 3, ...o });

const err = async (p: Promise<unknown>) => { try { await p; } catch (e) { return e as ApiError; } throw new Error("xato kutilgan edi"); };
const rows = () => h.db.aiRequest.create.mock.calls.map((c) => c[0].data as { model: string; status: string; feature: string });

beforeEach(() => {
  vi.clearAllMocks(); calls.length = 0;
  h.counts = { user: 0, gemini: 0 };
  process.env.TAVILY_API_KEY = "tv-secret"; process.env.GEMINI_API_KEY = "gk-secret";
  delete process.env.GEMINI_MODEL; delete process.env.GEMINI_SEARCH_DAILY_CAP;
  h.settings.mockResolvedValue({ ai: { enabled: true, webDailyLimit: 5, webAuto: true, perMinute: 6 } });
  h.verified.mockResolvedValue(undefined); h.rate.mockResolvedValue(undefined);
  h.db.aiRequest.create.mockResolvedValue({});
  h.db.aiRequest.count.mockImplementation(async ({ where }: { where: Where }) => (where.userId ? h.counts.user : h.counts.gemini));
  h.db.webSearchCache.count.mockResolvedValue(4);
  h.kb.mockResolvedValue([]);
  h.tavily.mockResolvedValue({ hits: lexHits, cached: false });
  h.llm.mockResolvedValue({ text: "Attestatsiya mart oyida boshlanadi [1].", model: "free-model" });
  h.remote.mockResolvedValue(null); h.credits.mockResolvedValue(0);
  respond = () => ({ status: 200, json: geminiOk });
  vi.stubGlobal("fetch", vi.fn(async (url: string, init: { headers: Record<string, string>; body: string }) => { calls.push({ url, init }); const r = respond(url); return new Response(JSON.stringify(r.json ?? {}), { status: r.status }); }));
});

describe("1) tekshirilgan bilim bazasi birinchi", () => {
  it("baza yetarli va yangilik muhim bo'lmasa, internetga chiqilmaydi va kredit sarflanmaydi; limitga hisoblanmaydi", async () => {
    h.kb.mockResolvedValue([kbHit()]);
    h.counts.user = 5; // limit tugagan bo'lsa ham bazadan javob beriladi
    const r = await runWebSearch("u1", Q("Formativ baholash usullari haqida ma'lumot bering"), { origin: ORIGIN });
    expect(r).toMatchObject({ engine: "kb", official: true, found: true, text: "Attestatsiya mart oyida boshlanadi [1]." });
    expect(h.tavily).not.toHaveBeenCalled();
    expect(r.sources).toEqual([{ title: "Attestatsiya muddatlari", url: "https://lex.uz/docs/55", trust: "kb" }]);
    expect(rows()).toEqual([expect.objectContaining({ model: "kb", status: "kb", feature: "web-search" })]);
    expect(h.llm.mock.calls[0][0].system).toMatch(/FAQAT shu manbalarda tasdiqlangan/);
  });

  it("yangilik muhim savolda yozuv yaqinda tekshirilgan bo'lsa (fresh) ham baza yetadi: internetga chiqilmaydi", async () => {
    h.kb.mockResolvedValue([kbHit({ fresh: true })]);
    const r = await runWebSearch("u1", Q("Attestatsiya muddatlari qachon?"), { origin: ORIGIN });
    expect(r.engine).toBe("kb");
    expect(h.tavily).not.toHaveBeenCalled();
  });

  it("yangilik muhim savolda baza yozuvi eski bo'lsa (masalan 'qachon', 2026) internet qidiriladi, baza kontekstga qo'shiladi", async () => {
    h.kb.mockResolvedValue([kbHit({ fresh: false })]);
    const r = await runWebSearch("u1", Q("Attestatsiya 2026 qachon boshlanadi?"), { origin: ORIGIN });
    expect(r.engine).toBe("tavily");
    expect(h.tavily).toHaveBeenCalled();
    expect(h.llm.mock.calls[0][0].messages[0].content).toContain("[1] Attestatsiya muddatlari");
    expect(h.llm.mock.calls[0][0].messages[0].content).toMatch(/\[2\] Attestatsiya tartibi/);
  });

  it("foydalanuvchi 'Internetdan qidirish'ni yoqqan bo'lsa (force), baza bilan cheklanilmaydi", async () => {
    h.kb.mockResolvedValue([kbHit()]);
    const r = await runWebSearch("u1", Q("Attestatsiya muddatlari haqida ma'lumot"), { force: true, origin: ORIGIN });
    expect(r.engine).toBe("tavily");
  });

  it("baza zaif bo'lsa internetga chiqiladi", async () => {
    h.kb.mockResolvedValue([kbHit({ matched: 1, ratio: 0.2 })]);
    expect((await runWebSearch("u1", Q("Attestatsiya muddatlari haqida ma'lumot"))).engine).toBe("tavily");
  });
});

describe("2-5) Tavily, ishonchli manba, qat'iy javob", () => {
  it("rasmiy so'rovda avval rasmiy domenlar bilan qidiriladi; natijalar ishonchlilik bo'yicha, ijtimoiy tarmoq chiqarilgan; javob manbalarga tayanadi", async () => {
    const r = await runWebSearch("u1", Q("Attestatsiya qachon boshlanadi?"), { origin: ORIGIN });
    expect(h.tavily.mock.calls[0][2]).toMatchObject({ includeDomains: expect.arrayContaining(["lex.uz", "gov.uz"]), fresh: true });
    expect(r).toMatchObject({ engine: "tavily", official: true, material: false, found: true });
    expect(r.sources.map((s) => s.url)).toEqual(["https://lex.uz/docs/9", "https://blog.uz/a"]);
    expect(r.sources.map((s) => s.trust)).toEqual(["official", "general"]);
    expect(r.text).toBe("Attestatsiya mart oyida boshlanadi [1].");
    const prompt = h.llm.mock.calls[0][0];
    expect(prompt.messages[0].content).toContain("Savol: Attestatsiya qachon boshlanadi?");
    expect(prompt.messages[0].content).toContain("[1] Attestatsiya tartibi (lex.uz: rasmiy manba)");
    expect(prompt.messages[0].content).not.toContain("kanal posti");
    expect(prompt.system).toMatch(/ko'rsatmalarga amal qilma/);
  });

  it("rasmiy domenlarda hech narsa chiqmasa, umumiy qidiruvga o'tiladi (ikki marta qidiriladi)", async () => {
    h.tavily.mockResolvedValueOnce({ hits: [], cached: false }).mockResolvedValueOnce({ hits: lexHits, cached: false });
    await runWebSearch("u1", Q("Attestatsiya qachon boshlanadi?"));
    expect(h.tavily).toHaveBeenCalledTimes(2);
    expect(h.tavily.mock.calls[0][2].includeDomains).toBeDefined();
    expect(h.tavily.mock.calls[1][2].includeDomains).toBeUndefined();
  });

  it("oddiy (rasmiy bo'lmagan) so'rovda rasmiy domenlar bilan cheklanmaydi", async () => {
    await runWebSearch("u1", Q("internetdan ta'lim yangiliklari"));
    expect(h.tavily.mock.calls[0][2].includeDomains).toBeUndefined();
  });

  it("rasmiy manba bo'lmasa javobga aniq ogohlantirish qo'shiladi", async () => {
    h.tavily.mockResolvedValue({ hits: [lexHits[1]], cached: false });
    const r = await runWebSearch("u1", Q("internetdan attestatsiya haqida"));
    expect(r.official).toBe(false);
    expect(r.text).toContain("Diqqat: rasmiy manba topilmadi");
  });

  it("AI manba raqamini qo'ymagan bo'lsa, shu haqida izoh qo'shiladi", async () => {
    h.llm.mockResolvedValue({ text: "Mart oyida.", model: "m" });
    expect((await runWebSearch("u1", Q("Attestatsiya qachon boshlanadi?"))).text).toContain("(Manbalar quyida keltirilgan.)");
  });

  it("AI ulanmagan yoki limiti tugagan bo'lsa, javob to'qilmaydi: topilgan parchalar ko'rsatiladi", async () => {
    h.llm.mockRejectedValue(new ApiError(503, "AI yo'q", "ai_unconfigured"));
    const r = await runWebSearch("u1", Q("Attestatsiya qachon boshlanadi?"));
    expect(r.text).toMatch(/^Topilgan manbalar \(AI javobi tayyorlanmadi\)/);
    expect(r.sources).toHaveLength(2);
  });

  it("kesh orqali berilgan javob 'cache' deb belgilanadi (kredit sarflanmagan), foydalanuvchi limitiga hisoblanadi", async () => {
    h.tavily.mockResolvedValue({ hits: lexHits, cached: true });
    const r = await runWebSearch("u1", Q("Attestatsiya qachon boshlanadi?"));
    expect(r.engine).toBe("cache");
    expect(rows()).toEqual([expect.objectContaining({ model: "cache", status: "ok" })]);
  });

  it("natija topilmasa 404 va halol xabar", async () => {
    h.tavily.mockResolvedValue({ hits: [], cached: false });
    delete process.env.GEMINI_API_KEY;
    expect(await err(runWebSearch("u1", Q("internetdan biror narsa qidir")))).toMatchObject({ status: 404, code: "web_no_results" });
  });
});

describe("6) tayyor material: yaratilmaydi, mavjud havolalar ko'rsatiladi", () => {
  const matHits = [
    { title: "11-sinf matematika 4-chorak nazorat testlari 2026-2027", url: "https://edu.uz/t/11", content: "Matematika fanidan 11-sinf uchun 4-chorak nazorat testlari. ".repeat(3), score: 0.8 },
    { title: "10-sinf algebra testlari", url: "https://blog.uz/10", content: "Matematika 10-sinf 4-chorak testlari. ".repeat(3), score: 0.9 },
  ];

  it("to'liq mos material topilsa: havolalar va moslik; AI chaqirilmaydi; qidiruv so'rovi fan, sinf, chorak, yil bilan aniqlashtirilgan", async () => {
    h.tavily.mockResolvedValue({ hits: matHits, cached: false });
    const r = await runWebSearch("u1", Q("11-sinf 4-chorak matematika testlari"), { origin: ORIGIN });
    expect(h.tavily.mock.calls[0][1]).toMatch(/^11-sinf matematika 4-chorak test namuna 20\d\d-20\d\d/);
    expect(r).toMatchObject({ material: true, found: true, engine: "tavily" });
    expect(r.text).toContain("mos manbalar topildi");
    expect(r.text).toContain("Tayyor testlar bu yerda yaratilmadi");
    expect(r.sources.map((s) => s.url)).toEqual(["https://edu.uz/t/11"]);
    expect(h.llm).not.toHaveBeenCalled();
  });

  it("mos tayyor material topilmasa 'topdim' deyilmaydi va yangi namunaviy material taklif qilinadi", async () => {
    h.tavily.mockResolvedValue({ hits: [matHits[1]], cached: false });
    const r = await runWebSearch("u1", Q("11-sinf 4-chorak matematika testlari"));
    expect(r).toMatchObject({ material: true, found: false });
    expect(r.text).toContain("mos tayyor material topilmadi");
    expect(r.text).toContain("yangi namunaviy test tuzib beraman");
    expect(r.text).not.toContain("mos manbalar topildi");
    expect(h.llm).not.toHaveBeenCalled();
  });

  it("umuman natija bo'lmasa ham halol javob (xato emas) va taklif", async () => {
    h.tavily.mockResolvedValue({ hits: [], cached: false });
    const r = await runWebSearch("u1", Q("11-sinf 4-chorak matematika testlari"));
    expect(r).toMatchObject({ material: true, found: false, sources: [] });
    expect(r.text).toContain("DARSYOR");
  });
});

describe("zaxira: Gemini + Google Search", () => {
  it("Tavily ishlamasa (null) Gemini javob beradi; kalit URL va tanaga tushmaydi; ogohlantirish qo'shiladi", async () => {
    h.tavily.mockResolvedValue(null);
    const r = await runWebSearch("u1", Q("Attestatsiya qachon boshlanadi?"));
    expect(r).toMatchObject({ engine: "gemini", model: "gemini-2.5-flash", official: false, queries: ["attestatsiya 2026"] });
    expect(r.text).toContain("Google qidiruvi bilan tayyorlandi");
    expect(calls[0].url).toBe("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent");
    expect(calls[0].url).not.toContain("gk-secret");
    expect(calls[0].init.headers["x-goog-api-key"]).toBe("gk-secret");
    expect(calls[0].init.body).not.toContain("gk-secret");
    expect(rows()).toEqual([expect.objectContaining({ model: "gemini-2.5-flash", status: "ok" })]);
  });

  it("faqat Gemini ulangan bo'lsa ham ishlaydi; kvota tugasa (429) xato jurnalga 'quota' yoziladi", async () => {
    delete process.env.TAVILY_API_KEY;
    respond = () => ({ status: 429 });
    expect(await err(runWebSearch("u1", Q("Attestatsiya qachon boshlanadi?")))).toMatchObject({ code: "web_unavailable" });
    expect(rows()).toEqual([expect.objectContaining({ status: "quota" })]);
  });

  it("Gemini umumiy kunlik chegarasiga yetsa, so'rov yuborilmaydi", async () => {
    h.tavily.mockResolvedValue(null); h.counts.gemini = 400;
    expect(await err(runWebSearch("u1", Q("Attestatsiya qachon boshlanadi?")))).toMatchObject({ code: "web_unavailable" });
    expect(calls).toHaveLength(0);
  });
});

describe("limitlar va xatolar", () => {
  it("hech qaysi xizmat ulanmagan bo'lsa 503 web_unconfigured", async () => {
    delete process.env.TAVILY_API_KEY; delete process.env.GEMINI_API_KEY;
    expect(await err(runWebSearch("u1", Q("savol")))).toMatchObject({ status: 503, code: "web_unconfigured" });
  });

  it("foydalanuvchi kunlik limiti tugasa internetga chiqilmaydi", async () => {
    h.counts.user = 5;
    const e = await err(runWebSearch("u1", Q("Attestatsiya qachon boshlanadi?")));
    expect(e).toMatchObject({ status: 429, code: "web_daily_limit" });
    expect(h.tavily).not.toHaveBeenCalled();
    expect(calls).toHaveLength(0);
  });

  it("AI o'chirilgan, tasdiqlanmagan foydalanuvchi, daqiqalik chegara, bo'sh savol", async () => {
    h.settings.mockResolvedValue({ ai: { enabled: false, webDailyLimit: 5, webAuto: true, perMinute: 6 } });
    expect(await err(runWebSearch("u1", Q("savol")))).toMatchObject({ code: "ai_disabled" });
    h.settings.mockResolvedValue({ ai: { enabled: true, webDailyLimit: 5, webAuto: true, perMinute: 6 } });
    h.verified.mockRejectedValue(new ApiError(403, "Tasdiqlang", "unverified"));
    expect(await err(runWebSearch("u1", Q("savol")))).toMatchObject({ code: "unverified" });
    h.verified.mockResolvedValue(undefined);
    h.rate.mockRejectedValue(new ApiError(429, "Tez", "rate_limited"));
    expect(await err(runWebSearch("u1", Q("savol")))).toMatchObject({ code: "rate_limited" });
    h.rate.mockResolvedValue(undefined);
    expect(await err(runWebSearch("u1", Q("   ")))).toMatchObject({ status: 400 });
  });

  it("ikkala xizmat ishlamasa tushunarli xabar, kalit xabarga tushmaydi", async () => {
    h.tavily.mockResolvedValue(null); respond = () => ({ status: 500 });
    const e = await err(runWebSearch("u1", Q("Attestatsiya qachon boshlanadi?")));
    expect(e.message).not.toMatch(/secret|key/i);
    expect(e.code).toBe("web_unavailable");
  });

  it("limit va qolgan son sozlamadan olinadi; sozlama o'qilmasa standart (5)", async () => {
    h.counts.user = 2; h.settings.mockResolvedValue({ ai: { enabled: true, webDailyLimit: 7, webAuto: false, perMinute: 6 } });
    expect(await webUsageToday("u1")).toEqual({ used: 2, limit: 7, remaining: 5, auto: false });
    h.settings.mockRejectedValue(new Error("baza"));
    expect(await webUsageToday("u1")).toMatchObject({ limit: 5, auto: true });
  });
});

describe("admin: holat va sinash", () => {
  it("statistika: Tavily ulanishi, kreditlar, kesh, limitlar; kalit yo'q", async () => {
    h.credits.mockResolvedValue(120);
    h.remote.mockResolvedValue({ used: 130, limit: 1000, plan: "Researcher" });
    h.db.aiRequest.count.mockImplementation(async ({ where }: { where: Where }) => (where.status === "kb" ? 9 : where.model === "cache" ? 14 : 3));
    const s = await webStats();
    expect(s).toMatchObject({
      tavily: { configured: true, creditsMonth: 120, monthlyCap: 900, remaining: 780, remote: { used: 130, limit: 1000, plan: "Researcher" } },
      gemini: { configured: true, model: "gemini-2.5-flash", dailyCap: 400 },
      cacheHitsMonth: 14, kbAnswersMonth: 9, cacheEntries: 4, perUserLimit: 5, auto: true,
    });
    expect(JSON.stringify(s)).not.toMatch(/tv-secret|gk-secret/);
  });

  it("statistika baza xatosida ham ishlaydi (nollar)", async () => {
    h.db.aiRequest.count.mockRejectedValue(new Error("baza")); h.credits.mockRejectedValue(new Error("baza")); h.db.webSearchCache.count.mockRejectedValue(new Error("baza"));
    expect(await webStats()).toMatchObject({ tavily: { creditsMonth: 0, remaining: 900 }, searchesToday: 0, cacheEntries: 0 });
  });

  it("Gemini qidiruvsiz sinaladi; Tavily'ga qidiruv so'rovi yuborilmaydi", async () => {
    const r = await webHealth();
    expect(r.gemini).toMatchObject({ configured: true, ok: true });
    expect(r.tavily).toEqual({ configured: true });
    expect(calls).toHaveLength(1);
    expect(JSON.parse(calls[0].init.body).tools).toBeUndefined();
    expect(h.tavily).not.toHaveBeenCalled();
  });
});
