import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { freeCooldown, healable, rankFreeModels } from "./freeheal";

describe("freeheal: toza funksiyalar", () => {
  it("faqat OpenRouter va Google xostlari tuzatiladi", () => {
    expect(healable("openrouter.ai")).toBe(true);
    expect(healable("generativelanguage.googleapis.com")).toBe(true);
    expect(healable("api.groq.com")).toBe(false);
    expect(healable("evil-openrouter.ai.example.com")).toBe(false);
  });
  it("OpenRouter: faqat :free, katta kontekst oldinda", () => {
    const items = [{ id: "a/x", context_length: 999_999 }, { id: "b/y:free", context_length: 8_000 }, { id: "c/z:free", context_length: 128_000 }, { context_length: 1 }];
    expect(rankFreeModels("openrouter.ai", items)).toEqual(["c/z:free", "b/y:free"]);
  });
  it("Google: models/ old qo'shimchasi olinadi, yangi flash oldinda, tts va embedding tashlanadi", () => {
    const items = [{ id: "models/gemini-2.5-flash-lite" }, { id: "models/gemini-3.7-flash" }, { id: "models/gemini-3.6-flash" }, { id: "models/gemini-3.7-flash-tts" }, { id: "models/text-embedding-004" }];
    expect(rankFreeModels("generativelanguage.googleapis.com", items)).toEqual(["gemini-3.7-flash", "gemini-3.6-flash", "gemini-2.5-flash-lite"]);
  });
  it("boshqa xostlarda ro'yxat tartibi saqlanadi", () => {
    expect(rankFreeModels("api.groq.com", [{ id: "m1" }, { id: "m2" }])).toEqual(["m1", "m2"]);
  });
  it("404 va 429 modelni chetga qo'yadi, 401 va 400 esa yo'q", () => {
    expect(freeCooldown(404)).toMatchObject({ reason: "gone" });
    expect(freeCooldown(429, "limit: 0")).toMatchObject({ reason: "quota", ms: 30 * 60_000 });
    expect(freeCooldown(429)).toMatchObject({ reason: "quota", ms: 90_000 });
    expect(freeCooldown(401)).toBeNull();
    expect(freeCooldown(400)).toBeNull();
  });
});

const h = vi.hoisted(() => ({ count: vi.fn(), create: vi.fn(async () => ({})) }));
vi.mock("../db", () => ({ db: { user: { findUnique: vi.fn() }, aiRequest: { count: h.count, create: h.create } } }));
vi.mock("../settings", () => ({ getSettings: vi.fn(async () => ({ ai: { enabled: true, freeEnabled: true, dailyLimit: null, freeDailyLimit: null, perMinute: 60, priceInPerMTok: 0, priceOutPerMTok: 0 } })), getSetting: vi.fn(async () => ({ enabled: true, freeEnabled: true })) }));
vi.mock("../entitlements", () => ({ DEFAULT_AI_DAILY: () => 30, DEFAULT_FREE_AI_DAILY: () => 50, getEntitlements: vi.fn(async () => ({ plan: "FREE", planName: "FREE", aiDaily: 30, freeAiDaily: 50 })) }));

const chat = (model: string) => new Response(JSON.stringify({ choices: [{ message: { content: "javob" } }], model, usage: { prompt_tokens: 1, completion_tokens: 1 } }), { status: 200 });
const models = (ids: string[]) => new Response(JSON.stringify({ data: ids.map((id) => ({ id, context_length: 100_000 })) }), { status: 200 });

describe("freeheal: runFreeAi modelni o'zi tuzatadi", () => {
  beforeEach(() => {
    vi.resetModules(); h.count.mockReset(); h.count.mockResolvedValue(0); h.create.mockClear();
    process.env.ALLOW_EMAIL_SIGNUP = "1"; process.env.AI_RETRY_MS = "0";
    process.env.FREE_LLM_BASE_URL = "https://openrouter.ai/api/v1"; process.env.FREE_LLM_API_KEY = "k"; process.env.FREE_LLM_MODEL = "old/model:free";
    vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); for (const k of ["ALLOW_EMAIL_SIGNUP", "AI_RETRY_MS", "FREE_LLM_BASE_URL", "FREE_LLM_API_KEY", "FREE_LLM_MODEL", "FREE_LLM2_BASE_URL", "FREE_LLM2_API_KEY", "FREE_LLM2_MODEL"]) delete process.env[k]; });

  it("muhitdagi model 404 bersa, ro'yxatdagi keyingi :free model sinaladi va eslab qolinadi", async () => {
    const f = vi.fn().mockImplementation(async (url: string, init?: { body?: string }) => {
      if (String(url).endsWith("/models")) return models(["new/model:free", "old/model:free"]);
      const m = JSON.parse(init?.body ?? "{}").model as string;
      return m === "old/model:free" ? new Response("{}", { status: 404 }) : chat(m);
    });
    vi.stubGlobal("fetch", f);
    const { runFreeAi } = await import("./gateway");
    await expect(runFreeAi("u1", [{ role: "user", content: "salom" }])).resolves.toMatchObject({ text: "javob", model: "new/model:free" });
    const chatBodies = () => f.mock.calls.filter((c) => String(c[0]).endsWith("/chat/completions")).map((c) => JSON.parse(c[1].body).model);
    expect(chatBodies()).toEqual(["old/model:free", "new/model:free"]);
    // keyingi so'rov to'g'ridan-to'g'ri ishlagan modeldan boshlanadi
    await runFreeAi("u1", [{ role: "user", content: "yana" }]);
    expect(chatBodies().at(-1)).toBe("new/model:free");
    expect(chatBodies()).toHaveLength(3);
  });
  it("429 (kvota) bergan model ham chetga qo'yiladi", async () => {
    const f = vi.fn().mockImplementation(async (url: string, init?: { body?: string }) => {
      if (String(url).endsWith("/models")) return models(["old/model:free", "other/model:free"]);
      return JSON.parse(init?.body ?? "{}").model === "old/model:free" ? new Response("{}", { status: 429 }) : chat("other/model:free");
    });
    vi.stubGlobal("fetch", f);
    const { runFreeAi } = await import("./gateway");
    await expect(runFreeAi("u1", [{ role: "user", content: "salom" }])).resolves.toMatchObject({ model: "other/model:free" });
  });
  it("401 (kalit xatosi) da model almashtirilmaydi va /models so'ralmaydi", async () => {
    const f = vi.fn().mockResolvedValue(new Response("{}", { status: 401 }));
    vi.stubGlobal("fetch", f);
    const { runFreeAi } = await import("./gateway");
    await expect(runFreeAi("u1", [{ role: "user", content: "salom" }])).rejects.toMatchObject({ status: 503 });
    expect(f.mock.calls.some((c) => String(c[0]).endsWith("/models"))).toBe(false);
  });
  it("boshqa xostda (Groq) 404 bersa, model almashtirilmaydi", async () => {
    process.env.FREE_LLM_BASE_URL = "https://api.groq.com/openai/v1";
    const f = vi.fn().mockResolvedValue(new Response("{}", { status: 404 }));
    vi.stubGlobal("fetch", f);
    const { runFreeAi } = await import("./gateway");
    await expect(runFreeAi("u1", [{ role: "user", content: "salom" }])).rejects.toMatchObject({ status: 503 });
    expect(f.mock.calls.some((c) => String(c[0]).endsWith("/models"))).toBe(false);
  });
  it("mos model topilmasa xato qaytadi (cheksiz aylanmaydi)", async () => {
    const f = vi.fn().mockImplementation(async (url: string) => (String(url).endsWith("/models") ? models(["old/model:free"]) : new Response("{}", { status: 404 })));
    vi.stubGlobal("fetch", f);
    const { runFreeAi } = await import("./gateway");
    await expect(runFreeAi("u1", [{ role: "user", content: "salom" }])).rejects.toMatchObject({ status: 503 });
    expect(f.mock.calls.filter((c) => String(c[0]).endsWith("/chat/completions")).length).toBeLessThanOrEqual(4);
  });
  it("ulanishni sinash: muhitdagi nom 404, lekin sayt boshqa modelni topsa, `healed` qaytadi", async () => {
    const f = vi.fn().mockImplementation(async (url: string, init?: { body?: string }) => {
      if (String(url).endsWith("/models")) return models(["new/model:free"]);
      return JSON.parse(init?.body ?? "{}").model === "old/model:free" ? new Response("{}", { status: 404 }) : chat("new/model:free");
    });
    vi.stubGlobal("fetch", f);
    const { aiHealth } = await import("./gateway");
    const r = await aiHealth();
    expect(r.free[0]).toMatchObject({ env: "FREE_LLM", ok: false, error: "404", healed: "new/model:free" });
  });
});
