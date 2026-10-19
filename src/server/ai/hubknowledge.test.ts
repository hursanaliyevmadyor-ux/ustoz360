import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/** Gateway darajasidagi yagona bilim manbasi: Claude ham, bepul xizmatlar ham, har qanday funksiya (chat, DARSYOR, ...) tasdiqlangan bilimni oladi. */
const h = vi.hoisted(() => ({ count: vi.fn(), create: vi.fn(async () => ({})), mode: vi.fn(), lookup: vi.fn(), claude: vi.fn() }));
vi.mock("../db", () => ({ db: { user: { findUnique: vi.fn() }, aiRequest: { count: h.count, create: h.create } } }));
vi.mock("../settings", () => ({ getSettings: vi.fn(async () => ({ ai: { enabled: true, freeEnabled: true, perMinute: 60, priceInPerMTok: 0, priceOutPerMTok: 0, providerRoles: {} } })) }));
vi.mock("../entitlements", () => ({ DEFAULT_AI_DAILY: () => 30, DEFAULT_FREE_AI_DAILY: () => 50, getEntitlements: vi.fn(async () => ({ plan: "FREE", planName: "FREE", aiDaily: 30, freeAiDaily: 50 })) }));
vi.mock("../hub/lookup", () => ({ hubMode: h.mode, hubLookup: h.lookup }));
vi.mock("@anthropic-ai/sdk", () => ({ default: class { beta = { messages: { create: h.claude } }; static RateLimitError = class extends Error {}; } }));

const ENTRY = { id: "e1", questionCanonical: "Kasrlarni qo'shish qoidasi", answer: "Umumiy maxraj topiladi, suratlar qo'shiladi." };
const GROUNDED = { decision: { kind: "grounded", hits: [{ entry: ENTRY, matched: 3, dice: 0.9, ratio: 0.9, answerRatio: 0.9 }] }, subject: "", topic: "", needsFresh: false };
const NONE = { decision: { kind: "none" }, subject: "", topic: "", needsFresh: false };
const ok = (text: string) => new Response(JSON.stringify({ choices: [{ message: { content: text } }], model: "m", usage: { prompt_tokens: 1, completion_tokens: 1 } }), { status: 200 });
const sentSystem = (f: ReturnType<typeof vi.fn>) => JSON.parse(f.mock.calls[0][1].body).messages[0].content as string;

beforeEach(() => {
  vi.resetModules(); vi.clearAllMocks();
  h.count.mockResolvedValue(0); h.mode.mockResolvedValue("on"); h.lookup.mockResolvedValue(GROUNDED);
  process.env.ALLOW_EMAIL_SIGNUP = "1"; process.env.AI_RETRY_MS = "0";
  process.env.FREE_LLM_BASE_URL = "https://a.example.com/v1"; process.env.FREE_LLM_API_KEY = "k"; process.env.FREE_LLM_MODEL = "m";
});
afterEach(() => { vi.unstubAllGlobals(); for (const k of ["ALLOW_EMAIL_SIGNUP", "AI_RETRY_MS", "FREE_LLM_BASE_URL", "FREE_LLM_API_KEY", "FREE_LLM_MODEL", "ANTHROPIC_API_KEY"]) delete process.env[k]; });

describe("bepul xizmatlar (runFreeAi): tasdiqlangan bilim har qanday chaqiruvga qo'shiladi", () => {
  it("on: oddiy chaqiruvda ham (chat, mashq izohi, ...) bilim ko'rsatmaga qo'shiladi, asosiy ko'rsatma saqlanadi", async () => {
    const f = vi.fn().mockImplementation(async () => ok("javob")); vi.stubGlobal("fetch", f);
    const { runFreeAi } = await import("./gateway");
    await runFreeAi("u1", [{ role: "user", content: "Kasrlarni qo'shish qoidasi nima?" }]);
    expect(sentSystem(f)).toContain("USTOZ 360 platformasidagi AI yordamchisan");
    expect(sentSystem(f)).toContain("<tasdiqlangan_bilim>");
    expect(sentSystem(f)).toContain("Umumiy maxraj topiladi");
  });

  it("o'z ko'rsatmasi bor chaqiruvda (DARSYOR, internet qidiruvi) ham: ko'rsatma + bilim bloki", async () => {
    const f = vi.fn().mockImplementation(async () => ok("javob")); vi.stubGlobal("fetch", f);
    const { runFreeAi } = await import("./gateway");
    await runFreeAi("u1", [{ role: "user", content: "x" }], { system: "MAXSUS KO'RSATMA", knowledge: "matematika kasrlar" });
    expect(sentSystem(f).startsWith("MAXSUS KO'RSATMA")).toBe(true);
    expect(sentSystem(f)).toContain("<tasdiqlangan_bilim>");
    expect(h.lookup).toHaveBeenCalledWith("matematika kasrlar", { topic: false });
  });

  it("knowledge=false, off/shadow rejim yoki mos bilim yo'q: ko'rsatma o'zgarmaydi", async () => {
    const f = vi.fn().mockImplementation(async () => ok("javob")); vi.stubGlobal("fetch", f);
    const { runFreeAi } = await import("./gateway");
    await runFreeAi("u1", [{ role: "user", content: "x" }], { system: "S", knowledge: false });
    expect(sentSystem(f)).toBe("S"); expect(h.lookup).not.toHaveBeenCalled();
    f.mockClear(); h.mode.mockResolvedValue("shadow");
    await runFreeAi("u1", [{ role: "user", content: "x" }], { system: "S" });
    expect(sentSystem(f)).toBe("S");
    f.mockClear(); h.mode.mockResolvedValue("on"); h.lookup.mockResolvedValue(NONE);
    await runFreeAi("u1", [{ role: "user", content: "x" }], { system: "S" });
    expect(sentSystem(f)).toBe("S");
  });

  it("bilim qidiruvi buzilsa AI baribir javob beradi", async () => {
    h.lookup.mockRejectedValue(new Error("baza"));
    vi.stubGlobal("fetch", vi.fn().mockImplementation(async () => ok("javob")));
    const { runFreeAi } = await import("./gateway");
    await expect(runFreeAi("u1", [{ role: "user", content: "x" }])).resolves.toMatchObject({ text: "javob" });
  });

  it("limit tugagan so'rovda bilim qidirilmaydi (ortiqcha ish yo'q)", async () => {
    h.count.mockResolvedValueOnce(0).mockResolvedValueOnce(50);
    vi.stubGlobal("fetch", vi.fn());
    const { runFreeAi } = await import("./gateway");
    await expect(runFreeAi("u1", [{ role: "user", content: "x" }])).rejects.toMatchObject({ code: "daily_limit" });
    expect(h.lookup).not.toHaveBeenCalled();
  });
});

describe("Claude (runAi): bilim bepul xizmatlardagi kabi qo'shiladi", () => {
  it("on: Claude'ga yuboriladigan system ichida bilim bloki bor", async () => {
    process.env.ANTHROPIC_API_KEY = "test";
    h.claude.mockResolvedValue({ content: [{ type: "text", text: "javob" }], usage: { input_tokens: 1, output_tokens: 1 }, model: "m", stop_reason: "end_turn" });
    const { runAi } = await import("./gateway");
    await runAi({ userId: "u1", feature: "chat", messages: [{ role: "user", content: "Kasrlarni qo'shish qoidasi nima?" }], maxTokens: 100 });
    const params = h.claude.mock.calls[0][0] as { system: string };
    expect(params.system).toContain("<tasdiqlangan_bilim>");
    expect(params.system).toContain("Umumiy maxraj topiladi");
    h.claude.mockClear();
    await runAi({ userId: "u1", feature: "chat", messages: [{ role: "user", content: "x" }], maxTokens: 100, knowledge: false, system: "S" });
    expect((h.claude.mock.calls[0][0] as { system: string }).system).toBe("S");
  });
});
