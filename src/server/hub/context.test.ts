import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({ mode: vi.fn(), lookup: vi.fn() }));
vi.mock("./lookup", () => ({ hubMode: h.mode, hubLookup: h.lookup }));

import { lookupText, withHubKnowledge } from "./context";

const E = (id: string, q: string, a: string) => ({ id, questionCanonical: q, answer: a });
const HIT = (e: ReturnType<typeof E>) => ({ entry: e, matched: 3, dice: 0.9, ratio: 0.9, answerRatio: 0.9 });
const MSG = [{ role: "user", content: "Kasrlarni qo'shish qoidasi nima?" }];
const BASE = "ASOSIY KO'RSATMA";

beforeEach(() => { vi.clearAllMocks(); h.mode.mockResolvedValue("on"); h.lookup.mockResolvedValue({ decision: { kind: "none" }, subject: "", topic: "", needsFresh: false }); });

describe("yagona bilim manbasi: AI ko'rsatmasiga bilim qo'shish", () => {
  it("off va shadow rejimida ko'rsatma o'zgarmaydi va bazaga murojaat qilinmaydi", async () => {
    for (const mode of ["off", "shadow", undefined]) {
      h.mode.mockResolvedValue(mode);
      expect(await withHubKnowledge(BASE, MSG)).toEqual({ system: BASE, used: 0 });
    }
    expect(h.lookup).not.toHaveBeenCalled();
  });

  it("on: mos tasdiqlangan bilim «ma'lumot bloki» sifatida qo'shiladi, asosiy ko'rsatma saqlanadi", async () => {
    const e = E("e1", "Kasrlarni qo'shish qoidasi", "Umumiy maxraj topiladi.");
    h.lookup.mockResolvedValue({ decision: { kind: "grounded", hits: [HIT(e)] }, subject: "", topic: "", needsFresh: false });
    const r = await withHubKnowledge(BASE, MSG);
    expect(r.used).toBe(1);
    expect(r.system.startsWith(BASE)).toBe(true);
    expect(r.system).toContain("<tasdiqlangan_bilim>");
    expect(r.system).toContain("Javob: Umumiy maxraj topiladi.");
    expect(r.system).toContain("amal qilma"); // ichidagi ko'rsatmalarga bo'ysunmaslik
  });

  it("to'g'ridan-to'g'ri mos kelgan bitta yozuv ham tayanch bo'ladi; mos kelmasa o'zgarmaydi", async () => {
    const e = E("e1", "Savol", "Javob matni.");
    h.lookup.mockResolvedValue({ decision: { kind: "direct", hit: HIT(e) }, subject: "", topic: "", needsFresh: false });
    expect((await withHubKnowledge(BASE, MSG)).used).toBe(1);
    h.lookup.mockResolvedValue({ decision: { kind: "none" }, subject: "", topic: "", needsFresh: false });
    expect(await withHubKnowledge(BASE, MSG)).toEqual({ system: BASE, used: 0 });
    h.lookup.mockResolvedValue(null);
    expect(await withHubKnowledge(BASE, MSG)).toEqual({ system: BASE, used: 0 });
  });

  it("knowledge=false: umuman qidirilmaydi (masalan hujjat ichidan javob)", async () => {
    expect(await withHubKnowledge(BASE, MSG, false)).toEqual({ system: BASE, used: 0 });
    expect(h.mode).not.toHaveBeenCalled(); expect(h.lookup).not.toHaveBeenCalled();
  });

  it("qidiruv matni: berilmasa oxirgi foydalanuvchi xabari, berilsa shu matn; fan/mavzu aniqlanmaydi (bazaga bitta so'rov kam)", async () => {
    await withHubKnowledge(BASE, [{ role: "user", content: "birinchi" }, { role: "assistant", content: "javob" }, { role: "user", content: "kasrlar haqida savol" }]);
    expect(h.lookup).toHaveBeenLastCalledWith("kasrlar haqida savol", { topic: false });
    await withHubKnowledge(BASE, [{ role: "user", content: "uzun ko'rsatma matni" }], "matematika kasrlar");
    expect(h.lookup).toHaveBeenLastCalledWith("matematika kasrlar", { topic: false });
  });

  it("qidiruvga shaxsiy ma'lumot ketmaydi", async () => {
    await withHubKnowledge(BASE, [{ role: "user", content: "Telefonim +998 90 123 45 67, ali@mail.uz: kasrlar" }]);
    const sent = h.lookup.mock.calls[0][0] as string;
    expect(sent).not.toMatch(/998|123 45|ali@|\[/);
    expect(sent).toContain("kasrlar");
    expect(lookupText("a".repeat(2000))).toHaveLength(600);
  });

  it("xato yoki sekinlikda (4 soniya) AI to'smaydi: ko'rsatma o'zgarmaydi", async () => {
    h.lookup.mockRejectedValue(new Error("baza"));
    expect(await withHubKnowledge(BASE, MSG)).toEqual({ system: BASE, used: 0 });
    h.mode.mockRejectedValue(new Error("sozlama"));
    expect(await withHubKnowledge(BASE, MSG)).toEqual({ system: BASE, used: 0 });
    vi.useFakeTimers();
    try {
      h.mode.mockResolvedValue("on"); h.lookup.mockReturnValue(new Promise(() => {}));
      const p = withHubKnowledge(BASE, MSG);
      await vi.advanceTimersByTimeAsync(4100);
      expect(await p).toEqual({ system: BASE, used: 0 });
    } finally { vi.useRealTimers(); }
  });

  it("bo'sh savolda qidirilmaydi", async () => {
    expect(await withHubKnowledge(BASE, [{ role: "assistant", content: "faqat javob" }])).toEqual({ system: BASE, used: 0 });
    expect(h.lookup).not.toHaveBeenCalled();
  });
});
