import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

const h = vi.hoisted(() => ({ free: vi.fn(), claude: vi.fn(), freeOn: vi.fn(), claudeOn: vi.fn() }));
vi.mock("./gateway", () => ({ runFreeAi: h.free, runAi: h.claude, freeConfigured: h.freeOn, aiConfigured: h.claudeOn }));

import { generateStructured, runAnyAi } from "./structured";

const schema = z.object({ a: z.string() });
beforeEach(() => { vi.clearAllMocks(); h.freeOn.mockReturnValue(true); h.claudeOn.mockReturnValue(false); });

describe("yagona kirish nuqtasi: bilim manbasi parametri uzatiladi", () => {
  it("runAnyAi: knowledge bepul xizmatga ham, Claude'ga ham o'tadi", async () => {
    h.free.mockResolvedValue({ text: "x", model: "m" }); h.claude.mockResolvedValue({ text: "x", model: "m" });
    const base = { userId: "u1", feature: "chat" as const, messages: [{ role: "user" as const, content: "q" }], maxTokens: 10, promptVersion: "t@1" };
    await runAnyAi({ ...base, knowledge: false });
    expect(h.free.mock.calls[0][2]).toMatchObject({ knowledge: false });
    h.freeOn.mockReturnValue(false); h.claudeOn.mockReturnValue(true);
    await runAnyAi({ ...base, knowledge: "kasrlar" });
    expect(h.claude.mock.calls[0][0]).toMatchObject({ knowledge: "kasrlar" });
  });

  it("generateStructured: bilim qidiruvi asl so'rov bo'yicha; qayta urinishda «format noto'g'ri» xabari bo'yicha emas", async () => {
    h.free.mockResolvedValueOnce({ text: "buzuq", model: "m" }).mockResolvedValueOnce({ text: '{"a":"ok"}', model: "m" });
    const r = await generateStructured({ userId: "u1", feature: "lesson", prompt: "Fan: matematika Mavzu: kasrlar", schema, shape: '{"a":"s"}', maxTokens: 10, promptVersion: "t@1" });
    expect(r.data).toEqual({ a: "ok" });
    expect(h.free).toHaveBeenCalledTimes(2);
    for (const c of h.free.mock.calls) expect(c[2]).toMatchObject({ knowledge: "Fan: matematika Mavzu: kasrlar" });
    h.free.mockClear(); h.free.mockResolvedValue({ text: '{"a":"ok"}', model: "m" });
    await generateStructured({ userId: "u1", feature: "lesson", prompt: "uzun ko'rsatma", knowledge: "matematika kasrlar", schema, shape: "{}", maxTokens: 10, promptVersion: "t@1" });
    expect(h.free.mock.calls[0][2]).toMatchObject({ knowledge: "matematika kasrlar" });
  });
});
