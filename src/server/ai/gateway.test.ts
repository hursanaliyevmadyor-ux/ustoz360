import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../db", () => ({ db: { user: { findUnique: vi.fn() }, aiRequest: { count: vi.fn().mockResolvedValue(0), create: vi.fn().mockResolvedValue({}) } } }));

const ok = (text: string) => new Response(JSON.stringify({ choices: [{ message: { content: text } }], model: "m", usage: { prompt_tokens: 1, completion_tokens: 2 } }), { status: 200 });

describe("runFreeAi zaxira (failover)", () => {
  beforeEach(() => {
    vi.resetModules();
    process.env.ALLOW_EMAIL_SIGNUP = "1"; // tasdiqlash tekshiruvini o'tkazib yuboradi
    process.env.AI_RETRY_MS = "0"; // testlarda kutmaymiz
    process.env.FREE_LLM_BASE_URL = "https://a.example.com/v1"; process.env.FREE_LLM_API_KEY = "ka"; process.env.FREE_LLM_MODEL = "ma";
    process.env.FREE_LLM2_BASE_URL = "https://b.example.com/v1/"; process.env.FREE_LLM2_API_KEY = "kb"; process.env.FREE_LLM2_MODEL = "mb";
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    for (const k of ["ALLOW_EMAIL_SIGNUP", "FREE_LLM_BASE_URL", "FREE_LLM_API_KEY", "FREE_LLM_MODEL", "FREE_LLM2_BASE_URL", "FREE_LLM2_API_KEY", "FREE_LLM2_MODEL"]) delete process.env[k];
  });

  it("birinchi xizmat 429 bersa ikkinchisiga o'tadi", async () => {
    const f = vi.fn().mockResolvedValueOnce(new Response("{}", { status: 429 })).mockResolvedValueOnce(ok("salom"));
    vi.stubGlobal("fetch", f);
    const { runFreeAi } = await import("./gateway");
    const r = await runFreeAi("u1", [{ role: "user", content: "hi" }]);
    expect(r.text).toBe("salom");
    expect(f).toHaveBeenCalledTimes(2);
    expect(f.mock.calls[1][0]).toBe("https://b.example.com/v1/chat/completions");
  });

  it("hammasi yiqilsa 503 xato beradi", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}", { status: 500 })));
    const { runFreeAi } = await import("./gateway");
    await expect(runFreeAi("u1", [{ role: "user", content: "hi" }])).rejects.toMatchObject({ status: 503 });
  });

  it("5xx xatoda bir marta qayta uriniladi va muvaffaqiyatli bo'lsa javob qaytadi", async () => {
    const f = vi.fn().mockResolvedValueOnce(new Response("{}", { status: 502 })).mockResolvedValueOnce(ok("qayta"));
    vi.stubGlobal("fetch", f);
    const { runFreeAi } = await import("./gateway");
    const r = await runFreeAi("u1", [{ role: "user", content: "hi" }]);
    expect(r.text).toBe("qayta");
    expect(f.mock.calls[1][0]).toBe("https://a.example.com/v1/chat/completions"); // xuddi shu xizmatga qayta urinish
  });

  it("limit (429) qayta urinilmaydi, darhol keyingi xizmatga o'tadi", async () => {
    const f = vi.fn().mockResolvedValue(new Response("{}", { status: 429 }));
    vi.stubGlobal("fetch", f);
    const { runFreeAi } = await import("./gateway");
    await expect(runFreeAi("u1", [{ role: "user", content: "hi" }])).rejects.toMatchObject({ status: 503 });
    expect(f).toHaveBeenCalledTimes(2); // har bir xizmatga bittadan
  });

  it("10 tagacha bepul xizmat qo'llab-quvvatlanadi: 6-10 o'rinlar ham zaxira sifatida ishlaydi", async () => {
    for (const k of ["FREE_LLM_API_KEY", "FREE_LLM2_API_KEY"]) delete process.env[k];
    process.env.FREE_LLM10_BASE_URL = "https://j.example.com/v1"; process.env.FREE_LLM10_API_KEY = "kj"; process.env.FREE_LLM10_MODEL = "mj";
    process.env.FREE_LLM6_BASE_URL = "https://f.example.com/v1"; process.env.FREE_LLM6_API_KEY = "kf";
    const f = vi.fn().mockResolvedValueOnce(new Response("{}", { status: 429 })).mockResolvedValueOnce(ok("o'ninchi"));
    vi.stubGlobal("fetch", f);
    try {
      const { runFreeAi, aiHealth } = await import("./gateway");
      const r = await runFreeAi("u1", [{ role: "user", content: "hi" }]);
      expect(r.text).toBe("o'ninchi");
      expect(f.mock.calls.map((c) => c[0])).toEqual(["https://f.example.com/v1/chat/completions", "https://j.example.com/v1/chat/completions"]);
      expect(typeof aiHealth).toBe("function");
    } finally {
      for (const k of ["FREE_LLM10_BASE_URL", "FREE_LLM10_API_KEY", "FREE_LLM10_MODEL", "FREE_LLM6_BASE_URL", "FREE_LLM6_API_KEY"]) delete process.env[k];
    }
  });

  it("kalit yo'q bo'lsa sozlanmagan deb hisoblanadi", async () => {
    delete process.env.FREE_LLM_API_KEY; delete process.env.FREE_LLM2_API_KEY;
    const { freeConfigured } = await import("./gateway");
    expect(freeConfigured()).toBe(false);
  });
});
