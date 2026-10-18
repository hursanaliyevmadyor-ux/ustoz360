import { beforeEach, describe, expect, it, vi } from "vitest";

process.env.TELEGRAM_BOT_TOKEN = "123:ABC";

const h = vi.hoisted(() => ({
  db: { user: { findMany: vi.fn() }, botState: { upsert: vi.fn() } },
  digest: vi.fn(),
}));
vi.mock("../db", () => ({ db: h.db }));
vi.mock("./digest", () => ({ digest: h.digest }));

import { reminderText, runReminders } from "./remind";
import type { Digest } from "./digest";

const NOW = new Date("2026-11-05T03:00:00Z"); // Toshkentda 08:00
const base = (o: Partial<Digest> = {}): Digest => ({ today: "2026-11-05", tomorrow: "2026-11-06", plan: [], planFuture: 0, dueErrors: 0, resume: null, seminars: [], daysLeft: null, targetExam: null, planName: "FREE", announcements: [], ...o });

describe("eslatma matni", () => {
  it("aytadigan gap bo'lmasa xabar yo'q (spam yo'q)", () => {
    expect(reminderText(base(), NOW)).toBeNull();
    expect(reminderText(base({ plan: [{ id: "1", title: "Bajarilgan", done: true }] }), NOW)).toBeNull();
    expect(reminderText(base({ daysLeft: 20 }), NOW)).toBeNull();
  });
  it("bugungi bajarilmagan reja, takrorlash va tugallanmagan mashq", () => {
    const t = reminderText(base({
      plan: [{ id: "1", title: "Test <yechish>", done: false }, { id: "2", title: "Tugagan", done: true }],
      dueErrors: 4, resume: { id: "s", kind: "quick", total: 10, answered: 3, remainingSec: null },
    }), NOW)!;
    expect(t).toContain("Bugungi reja</b> (1 ta qoldi)");
    expect(t).toContain("Test &lt;yechish&gt;");
    expect(t).not.toContain("Tugagan");
    expect(t).toContain("<b>4</b> ta");
    expect(t).toContain("3/10");
  });
  it("faqat 36 soat ichidagi seminar eslatiladi", () => {
    const soon = { id: "a", title: "Yaqin seminar", description: null, speaker: null, startsAt: "2026-11-05T09:00:00.000Z", durationMin: null, place: null, link: null, capacity: null };
    const far = { ...soon, id: "b", title: "Uzoq seminar", startsAt: "2026-11-12T09:00:00.000Z" };
    const past = { ...soon, id: "c", title: "O'tgan seminar", startsAt: "2026-11-05T01:00:00.000Z" };
    const t = reminderText(base({ seminars: [soon, far, past] }), NOW)!;
    expect(t).toContain("Yaqin seminar");
    expect(t).toContain("14:00");
    expect(t).not.toContain("Uzoq seminar");
    expect(t).not.toContain("O'tgan seminar");
  });
  it("imtihongacha sanash faqat belgilangan kunlarda", () => {
    expect(reminderText(base({ daysLeft: 7 }), NOW)).toContain("7</b> kun");
    expect(reminderText(base({ daysLeft: 8 }), NOW)).toBeNull();
  });
});

describe("runReminders", () => {
  const sendCalls: { body: Record<string, unknown> }[] = [];
  const user = (id: string, tg: string, st?: { remind: boolean; remindedOn: string | null }) => ({ id, telegramId: tg, botState: st ?? null });
  let status: Record<string, { ok: boolean; error_code?: number }> = {};

  beforeEach(() => {
    vi.clearAllMocks(); sendCalls.length = 0; status = {};
    h.db.botState.upsert.mockResolvedValue({});
    h.digest.mockImplementation(async (id: string) => base(id === "empty" ? {} : { dueErrors: 2 }));
    vi.stubGlobal("fetch", vi.fn(async (_u: string, init: { body: string }) => {
      const body = JSON.parse(init.body);
      sendCalls.push({ body });
      return new Response(JSON.stringify(status[String(body.chat_id)] ?? { ok: true, result: { message_id: 1 } }), { status: 200 });
    }));
  });

  it("faqat yoqib qo'ygan va bugun hali olmaganlarga yuboradi, yuborilganini belgilaydi", async () => {
    h.db.user.findMany.mockResolvedValue([
      user("a", "1"),
      user("b", "2", { remind: false, remindedOn: null }),
      user("c", "3", { remind: true, remindedOn: "2026-11-05" }),
      user("d", "4", { remind: true, remindedOn: "2026-11-04" }),
      user("empty", "5"),
    ]);
    const r = await runReminders(NOW);
    expect(sendCalls.map((c) => c.body.chat_id).sort()).toEqual(["1", "4"]);
    expect(r).toEqual({ sent: 2, skipped: 3, failed: 0, blocked: 0 });
    const marks = h.db.botState.upsert.mock.calls.map((c) => c[0].where.userId).sort();
    expect(marks).toEqual(["a", "d"]);
    expect(h.db.botState.upsert.mock.calls[0][0].update).toEqual({ remindedOn: "2026-11-05" });
    expect(sendCalls[0].body.parse_mode).toBe("HTML");
  });

  it("botni bloklagan foydalanuvchiga eslatma o'chiriladi, boshqa xatolar hisoblanadi", async () => {
    h.db.user.findMany.mockResolvedValue([user("a", "1"), user("b", "2")]);
    status = { "1": { ok: false, error_code: 403 }, "2": { ok: false, error_code: 500 } };
    const r = await runReminders(NOW);
    expect(r).toMatchObject({ sent: 0, blocked: 1, failed: 1 });
    expect(h.db.botState.upsert).toHaveBeenCalledWith(expect.objectContaining({ where: { userId: "a" }, update: { remind: false } }));
    expect(h.db.botState.upsert.mock.calls.some((c) => c[0].where.userId === "b")).toBe(false);
  });

  it("bitta foydalanuvchi uchun xato boshqalarga to'sqinlik qilmaydi", async () => {
    h.db.user.findMany.mockResolvedValue([user("a", "1"), user("b", "2")]);
    h.digest.mockImplementation(async (id: string) => { if (id === "a") throw new Error("baza xatosi"); return base({ dueErrors: 1 }); });
    const r = await runReminders(NOW);
    expect(r).toMatchObject({ sent: 1, failed: 1 });
  });

  it("ro'yxatdan o'tmagan yoki telefonsiz foydalanuvchilar so'rovga kirmaydi", async () => {
    h.db.user.findMany.mockResolvedValue([]);
    await runReminders(NOW);
    expect(h.db.user.findMany.mock.calls[0][0].where).toMatchObject({ telegramId: { not: null }, deletedAt: null, phone: { not: null }, profile: { onboardedAt: { not: null } } });
  });
});
