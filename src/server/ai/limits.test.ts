import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => {
  const s = { count: vi.fn(), create: vi.fn(async () => ({})), ai: { enabled: true, freeEnabled: true, dailyLimit: null as number | null, freeDailyLimit: null as number | null, perMinute: 6, priceInPerMTok: 3, priceOutPerMTok: 15 }, plan: { aiDaily: 30, freeAiDaily: 50 } };
  return s;
});
vi.mock("../db", () => ({ db: { user: { findUnique: vi.fn() }, aiRequest: { count: h.count, create: h.create } } }));
vi.mock("../settings", () => ({ getSettings: vi.fn(async () => ({ ai: h.ai })), getSetting: vi.fn(async () => h.ai) }));
vi.mock("../entitlements", () => ({ DEFAULT_AI_DAILY: () => 30, DEFAULT_FREE_AI_DAILY: () => 50, getEntitlements: vi.fn(async () => ({ plan: "FREE", planName: "FREE", ...h.plan })) }));

const ok = (text: string) => new Response(JSON.stringify({ choices: [{ message: { content: text } }], model: "m", usage: { prompt_tokens: 1000, completion_tokens: 500 } }), { status: 200 });

beforeEach(() => {
  vi.resetModules(); h.count.mockReset(); h.create.mockClear();
  h.ai = { enabled: true, freeEnabled: true, dailyLimit: null, freeDailyLimit: null, perMinute: 6, priceInPerMTok: 3, priceOutPerMTok: 15 };
  h.plan = { aiDaily: 30, freeAiDaily: 50 };
  process.env.ALLOW_EMAIL_SIGNUP = "1"; process.env.AI_RETRY_MS = "0";
  process.env.FREE_LLM_BASE_URL = "https://a.example.com/v1"; process.env.FREE_LLM_API_KEY = "k"; process.env.FREE_LLM_MODEL = "m";
});
afterEach(() => { vi.unstubAllGlobals(); for (const k of ["ALLOW_EMAIL_SIGNUP", "AI_RETRY_MS", "FREE_LLM_BASE_URL", "FREE_LLM_API_KEY", "FREE_LLM_MODEL", "FREE_LLM2_BASE_URL", "FREE_LLM2_API_KEY", "FREE_LLM2_MODEL"]) delete process.env[k]; });

describe("AI shlyuzi: limitlar va jurnal", () => {
  it("daqiqalik chegara oshsa 429 (rate_limited) va tashqi xizmatga murojaat qilinmaydi", async () => {
    h.count.mockResolvedValueOnce(6); // oxirgi daqiqadagi so'rovlar
    const f = vi.fn(); vi.stubGlobal("fetch", f);
    const { runFreeAi } = await import("./gateway");
    await expect(runFreeAi("u1", [{ role: "user", content: "salom" }])).rejects.toMatchObject({ status: 429, code: "rate_limited" });
    expect(f).not.toHaveBeenCalled();
  });
  it("kunlik limit tugasa 429 (daily_limit) va 'blocked' yozuvi qoldiriladi", async () => {
    h.count.mockResolvedValueOnce(0).mockResolvedValueOnce(50);
    const f = vi.fn(); vi.stubGlobal("fetch", f);
    const { runFreeAi } = await import("./gateway");
    await expect(runFreeAi("u1", [{ role: "user", content: "salom" }])).rejects.toMatchObject({ status: 429, code: "daily_limit" });
    expect(h.create).toHaveBeenCalledWith({ data: expect.objectContaining({ status: "blocked", feature: "free-chat" }) });
    expect(f).not.toHaveBeenCalled();
  });
  it("tarif limiti hisobga olinadi: PRO uchun kattaroq kunlik chegara", async () => {
    h.plan = { aiDaily: 60, freeAiDaily: 100 };
    h.count.mockResolvedValueOnce(0).mockResolvedValueOnce(60); // 60 ta ishlatilgan: FREE (50) uchun blok, PRO (100) uchun ruxsat
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(ok("javob")));
    const { runFreeAi } = await import("./gateway");
    await expect(runFreeAi("u1", [{ role: "user", content: "salom" }])).resolves.toMatchObject({ text: "javob" });
  });
  it("admin AI'ni o'chirgan bo'lsa 503 (ai_disabled)", async () => {
    h.ai.enabled = false;
    const f = vi.fn(); vi.stubGlobal("fetch", f);
    const { runFreeAi } = await import("./gateway");
    await expect(runFreeAi("u1", [{ role: "user", content: "salom" }])).rejects.toMatchObject({ status: 503, code: "ai_disabled" });
    expect(f).not.toHaveBeenCalled();
  });
  it("muvaffaqiyatli so'rovda kechikish, prompt versiyasi va narx jurnalga yoziladi", async () => {
    h.count.mockResolvedValue(0);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(ok("javob")));
    const { runFreeAi } = await import("./gateway");
    await runFreeAi("u1", [{ role: "user", content: "salom" }], { feature: "lesson", promptVersion: "lesson@2" });
    const row = (h.create.mock.calls.at(-1) as unknown as [{ data: Record<string, unknown> }])[0].data;
    expect(row).toMatchObject({ userId: "u1", status: "ok", inputTokens: 1000, outputTokens: 500, promptVersion: "lesson@2", costMicro: 10_500 });
    expect(typeof row.latencyMs).toBe("number");
  });
  it("narx kiritilmagan bo'lsa xarajat hisoblanmaydi (null)", async () => {
    h.ai.priceInPerMTok = 0; h.ai.priceOutPerMTok = 0; h.count.mockResolvedValue(0);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(ok("javob")));
    const { runFreeAi } = await import("./gateway");
    await runFreeAi("u1", [{ role: "user", content: "salom" }]);
    expect((h.create.mock.calls.at(-1) as unknown as [{ data: Record<string, unknown> }])[0].data.costMicro).toBeNull();
  });
  it("javob bergan xizmatning slot nomi jurnalga yoziladi (kalit emas)", async () => {
    h.count.mockResolvedValue(0);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(ok("javob")));
    const { runFreeAi } = await import("./gateway");
    await runFreeAi("u1", [{ role: "user", content: "salom" }]);
    const row = (h.create.mock.calls.at(-1) as unknown as [{ data: Record<string, unknown> }])[0].data;
    expect(row.provider).toBe("free1");
    expect(JSON.stringify(row)).not.toContain('"k"');
  });
  it("birinchi xizmat limitga yetsa, ikkinchisi javob beradi va jurnalda free2 turadi", async () => {
    h.count.mockResolvedValue(0);
    process.env.FREE_LLM2_BASE_URL = "https://b.example.com/v1"; process.env.FREE_LLM2_API_KEY = "k2"; process.env.FREE_LLM2_MODEL = "m2";
    vi.stubGlobal("fetch", vi.fn().mockImplementation(async (url: string) => (String(url).startsWith("https://a.") ? new Response("{}", { status: 429 }) : ok("ikkinchi"))));
    const { runFreeAi } = await import("./gateway");
    await expect(runFreeAi("u1", [{ role: "user", content: "salom" }])).resolves.toMatchObject({ text: "ikkinchi" });
    expect((h.create.mock.calls.at(-1) as unknown as [{ data: Record<string, unknown> }])[0].data.provider).toBe("free2");
  });
  it("hamma xizmat xato bersa provayder nomi yozilmaydi (bo'sh)", async () => {
    h.count.mockResolvedValue(0);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}", { status: 429 })));
    const { runFreeAi } = await import("./gateway");
    await expect(runFreeAi("u1", [{ role: "user", content: "salom" }])).rejects.toMatchObject({ status: 503 });
    const row = (h.create.mock.calls.at(-1) as unknown as [{ data: Record<string, unknown> }])[0].data;
    expect(row).toMatchObject({ status: "error" }); expect(row.provider).toBeUndefined();
  });
  it("'provider' ustuni bazada hali yo'q bo'lsa, yozuv ustunsiz qayta uriniladi: javob va limit hisobi buzilmaydi", async () => {
    h.count.mockResolvedValue(0);
    h.create.mockRejectedValueOnce(new Error("column \"provider\" does not exist"));
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(ok("javob")));
    const { runFreeAi } = await import("./gateway");
    await expect(runFreeAi("u1", [{ role: "user", content: "salom" }])).resolves.toMatchObject({ text: "javob" });
    expect(h.create).toHaveBeenCalledTimes(2);
    const calls = h.create.mock.calls as unknown as [{ data: Record<string, unknown> }][];
    expect(calls[0][0].data.provider).toBe("free1");
    expect(calls[1][0].data.provider).toBeUndefined();
    expect(calls[1][0].data).toMatchObject({ userId: "u1", status: "ok", feature: "free-chat" });
    err.mockRestore();
  });
});

describe("AI sog'liq tekshiruvi (admin)", () => {
  it("kalitsiz holatda hech narsa chaqirilmaydi", async () => {
    delete process.env.FREE_LLM_API_KEY;
    const f = vi.fn(); vi.stubGlobal("fetch", f);
    const { aiHealth } = await import("./gateway");
    const r = await aiHealth();
    expect(r.claude.configured).toBe(false); expect(r.free).toEqual([]); expect(f).not.toHaveBeenCalled();
  });
  it("natijada kalit ham, to'liq manzil ham yo'q: faqat xost, holat va vaqt", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}", { status: 401 })));
    const { aiHealth } = await import("./gateway");
    const r = await aiHealth();
    expect(r.free[0]).toMatchObject({ env: "FREE_LLM", host: "a.example.com", ok: false, error: "401" });
    expect(JSON.stringify(r)).not.toContain("https://");
    expect(JSON.stringify(r)).not.toContain('"k"');
  });
});

describe("tuzilmali javob (Zod)", () => {
  it("noto'g'ri javobdan keyin xatoni aytib qayta so'raydi va to'g'ri javobni qaytaradi", async () => {
    h.count.mockResolvedValue(0);
    const f = vi.fn().mockResolvedValueOnce(ok("Albatta! Mana javob")).mockResolvedValueOnce(ok('{"sections":[{"title":"A","content":"matn"}]}'));
    vi.stubGlobal("fetch", f);
    const { z } = await import("zod");
    const { generateStructured } = await import("./structured");
    const r = await generateStructured({ userId: "u1", feature: "lesson", prompt: "yoz", schema: z.object({ sections: z.array(z.object({ title: z.string(), content: z.string() })) }), shape: "{}", maxTokens: 100, promptVersion: "t@1" });
    expect(r.data.sections[0].title).toBe("A");
    expect(f).toHaveBeenCalledTimes(2);
    const second = JSON.parse((f.mock.calls[1][1] as { body: string }).body);
    expect(second.messages.at(-1).content).toMatch(/formati noto'g'ri/);
  });
  it("ikki marta noto'g'ri bo'lsa 502", async () => {
    h.count.mockResolvedValue(0);
    vi.stubGlobal("fetch", vi.fn().mockImplementation(async () => ok("json emas")));
    const { z } = await import("zod");
    const { generateStructured } = await import("./structured");
    await expect(generateStructured({ userId: "u1", feature: "lesson", prompt: "yoz", schema: z.object({ a: z.string() }), shape: "{}", maxTokens: 100, promptVersion: "t@1" })).rejects.toMatchObject({ status: 502 });
  });
  it("hech qaysi AI ulanmagan bo'lsa 503 (ai_unconfigured): to'qilgan javob yo'q", async () => {
    delete process.env.FREE_LLM_API_KEY; delete process.env.ANTHROPIC_API_KEY;
    const { z } = await import("zod");
    const { generateStructured } = await import("./structured");
    await expect(generateStructured({ userId: "u1", feature: "lesson", prompt: "yoz", schema: z.object({ a: z.string() }), shape: "{}", maxTokens: 100, promptVersion: "t@1" })).rejects.toMatchObject({ status: 503, code: "ai_unconfigured" });
  });
});
