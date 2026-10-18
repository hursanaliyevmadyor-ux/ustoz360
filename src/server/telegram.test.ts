import { beforeEach, describe, expect, it, vi } from "vitest";

process.env.AUTH_SECRET = "x".repeat(40);
process.env.TELEGRAM_BOT_TOKEN = "123:ABC"; process.env.TELEGRAM_BOT_USERNAME = "Test_bot";

const h = vi.hoisted(() => ({
  db: {
    user: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
    auditLog: { create: vi.fn() },
    telegramLogin: { count: vi.fn(), create: vi.fn(), findUnique: vi.fn(), findFirst: vi.fn(), update: vi.fn(), updateMany: vi.fn(), deleteMany: vi.fn() },
    telegramUpdate: { create: vi.fn(), deleteMany: vi.fn() },
    aiChat: { findFirst: vi.fn(), update: vi.fn() },
  },
  startSession: vi.fn(), runFreeAi: vi.fn(), saveExchange: vi.fn(), freeUsageToday: vi.fn(),
}));
vi.mock("./db", () => ({ db: h.db }));
vi.mock("./onboarding", () => ({ landingPath: async () => "/royxat" }));
vi.mock("./ai/gateway", () => ({ runFreeAi: h.runFreeAi, freeUsageToday: h.freeUsageToday }));
vi.mock("./ai/chats", () => ({ saveExchange: h.saveExchange }));
vi.mock("./auth", async (orig) => ({ ...(await orig<typeof import("./auth")>()), startSession: h.startSession }));

import { createTelegramLogin, handleUpdate, pollTelegramLogin } from "./telegram";

const { db } = h;
const calls: { method: string; body: Record<string, unknown> }[] = [];
const sent = () => calls.filter((c) => c.method === "sendMessage").map((c) => String(c.body.text));

beforeEach(() => {
  vi.clearAllMocks(); calls.length = 0;
  vi.stubGlobal("fetch", vi.fn(async (url: string, init: { body: string }) => {
    const method = String(url).split("/").pop()!;
    calls.push({ method, body: JSON.parse(init.body) });
    return new Response(JSON.stringify({ ok: true, result: {} }), { status: 200 });
  }));
  db.auditLog.create.mockResolvedValue({}); db.telegramUpdate.create.mockResolvedValue({}); db.telegramUpdate.deleteMany.mockResolvedValue({});
  db.telegramLogin.count.mockResolvedValue(0); db.telegramLogin.deleteMany.mockResolvedValue({}); db.telegramLogin.update.mockResolvedValue({});
  db.aiChat.findFirst.mockResolvedValue(null);
});

const msg = (text: string, extra: Record<string, unknown> = {}) => ({ update_id: Math.floor(Math.random() * 1e9), message: { chat: { id: 77, type: "private" }, from: { id: 5, first_name: "Ali", username: "ali" }, text, ...extra } });
const contactMsg = (userId: number, phone = "+998 90 123-45-67") => ({ update_id: Math.floor(Math.random() * 1e9), message: { chat: { id: 77, type: "private" }, from: { id: 5, first_name: "Ali", username: "ali" }, contact: { phone_number: phone, user_id: userId } } });
const PHONE = "+998901234567";
const registeredUser = () => db.user.findUnique.mockResolvedValue({ id: "u1", name: "Ali", phone: PHONE, deletedAt: null, telegramUsername: "ali" });
const lastMarkup = () => { const m = calls.filter((c) => c.method === "sendMessage"); return m.at(-1)?.body.reply_markup as { keyboard?: { request_contact?: boolean }[][]; remove_keyboard?: boolean } | undefined; };
const liveRow = (extra: Record<string, unknown> = {}) => ({ id: "L1", code: "abc", consumedAt: null, confirmedAt: null, expiresAt: new Date(Date.now() + 60_000), ...extra });

describe("saytdan Telegram orqali kirish", () => {
  it("havola va maxfiy kalit beradi, webhook'ni o'zi ulaydi", async () => {
    db.telegramLogin.create.mockResolvedValue({ id: "L1" });
    const r = await createTelegramLogin("https://site.example");
    expect(r.url).toMatch(/^https:\/\/t\.me\/Test_bot\?start=l_[\w-]{20,}$/);
    expect(r.pollKey).toMatch(/^L1\./);
    const hook = calls.find((c) => c.method === "setWebhook")!;
    expect(hook.body.url).toBe("https://site.example/api/telegram/webhook");
    expect(String(hook.body.secret_token)).toMatch(/^[\w-]{20,}$/);
  });

  it("bot nomi '@' bilan yozilgan bo'lsa ham havola to'g'ri chiqadi", async () => {
    db.telegramLogin.create.mockResolvedValue({ id: "L1" });
    const old = process.env.TELEGRAM_BOT_USERNAME;
    process.env.TELEGRAM_BOT_USERNAME = " @Test_bot ";
    try { expect((await createTelegramLogin("https://site.example")).url).toMatch(/^https:\/\/t\.me\/Test_bot\?start=/); }
    finally { process.env.TELEGRAM_BOT_USERNAME = old; }
  });

  it("brauzer kalitisiz yoki noto'g'ri kalit bilan kira olmaydi", async () => {
    db.telegramLogin.create.mockResolvedValue({ id: "L1" });
    const { pollKey } = await createTelegramLogin("https://site.example");
    const stored = db.telegramLogin.create.mock.calls[0][0].data;
    db.telegramLogin.findUnique.mockResolvedValue({ id: "L1", pollHash: stored.pollHash, userId: "u1", confirmedAt: new Date(), consumedAt: null, expiresAt: new Date(Date.now() + 60_000) });
    expect(await pollTelegramLogin("L1.noto'g'ri")).toEqual({ status: "expired" });
    expect(h.startSession).not.toHaveBeenCalled();
    db.telegramLogin.updateMany.mockResolvedValue({ count: 1 });
    expect(await pollTelegramLogin(pollKey)).toEqual({ status: "ok", next: "/royxat" });
    expect(h.startSession).toHaveBeenCalledWith("u1");
  });

  it("bot tasdiqlamaguncha 'pending', ikkinchi marta ishlatib bo'lmaydi", async () => {
    db.telegramLogin.create.mockResolvedValue({ id: "L1" });
    const { pollKey } = await createTelegramLogin("https://site.example");
    const hash = db.telegramLogin.create.mock.calls[0][0].data.pollHash;
    db.telegramLogin.findUnique.mockResolvedValue({ id: "L1", pollHash: hash, userId: null, confirmedAt: null, consumedAt: null, expiresAt: new Date(Date.now() + 60_000) });
    expect(await pollTelegramLogin(pollKey)).toEqual({ status: "pending" });
    db.telegramLogin.findUnique.mockResolvedValue({ id: "L1", pollHash: hash, userId: "u1", confirmedAt: new Date(), consumedAt: null, expiresAt: new Date(Date.now() + 60_000) });
    db.telegramLogin.updateMany.mockResolvedValue({ count: 0 }); // boshqa so'rov allaqachon ishlatgan
    expect(await pollTelegramLogin(pollKey)).toEqual({ status: "expired" });
    expect(h.startSession).not.toHaveBeenCalled();
  });
});

describe("bot: telefon raqami bilan ro'yxatdan o'tish", () => {
  it("/start l_... yangi foydalanuvchi: raqam tugmasi chiqadi, hali kirish tasdiqlanmaydi va akkaunt ochilmaydi", async () => {
    db.user.findUnique.mockResolvedValue(null);
    db.telegramLogin.findUnique.mockResolvedValue(liveRow());
    await handleUpdate(msg("/start l_abc"), "https://site.example");
    expect(db.telegramLogin.update).toHaveBeenCalledWith({ where: { id: "L1" }, data: { telegramId: "5" } });
    expect(db.user.create).not.toHaveBeenCalled();
    expect(lastMarkup()?.keyboard?.[0][0].request_contact).toBe(true);
    expect(sent()[0]).toContain("Telefon raqamni yuborish");
  });

  it("raqam yuborilsa: akkaunt ochiladi, raqam saqlanadi, kirish tasdiqlanadi va tabrik keladi", async () => {
    db.user.findUnique.mockResolvedValue(null);
    db.user.create.mockResolvedValue({ id: "u1", name: "Ali", phone: null, deletedAt: null, telegramUsername: "ali" });
    db.user.update.mockResolvedValue({});
    db.telegramLogin.findFirst.mockResolvedValue(liveRow({ telegramId: "5" }));
    await handleUpdate(contactMsg(5), "https://site.example");
    expect(db.user.update).toHaveBeenCalledWith({ where: { id: "u1" }, data: { phone: PHONE } });
    expect(db.telegramLogin.update).toHaveBeenCalledWith({ where: { id: "L1" }, data: expect.objectContaining({ userId: "u1" }) });
    expect(sent().join("\n")).toContain("Tabriklaymiz, ro'yxatdan o'tdingiz");
    expect(sent().join("\n")).toContain("saytga qaytishingiz mumkin");
  });

  it("boshqa odamning kontakti qabul qilinmaydi", async () => {
    await handleUpdate(contactMsg(9), "https://site.example");
    expect(db.user.create).not.toHaveBeenCalled();
    expect(db.user.update).not.toHaveBeenCalled();
    expect(lastMarkup()?.keyboard?.[0][0].request_contact).toBe(true);
  });

  it("raqam boshqa akkauntga bog'langan bo'lsa ro'yxatdan o'tkazilmaydi", async () => {
    registeredUser();
    db.user.findUnique.mockResolvedValue({ id: "u1", name: "Ali", phone: null, deletedAt: null, telegramUsername: "ali" });
    db.user.update.mockRejectedValue(Object.assign(new Error("dup"), { code: "P2002" }));
    await handleUpdate(contactMsg(5), "https://site.example");
    expect(sent()[0]).toContain("boshqa akkauntga");
    expect(db.telegramLogin.update).not.toHaveBeenCalled();
  });

  it("raqami bor foydalanuvchi /start l_... bossa kirish darhol tasdiqlanadi", async () => {
    registeredUser();
    db.telegramLogin.findUnique.mockResolvedValue(liveRow());
    await handleUpdate(msg("/start l_abc"), "https://site.example");
    expect(db.telegramLogin.update).toHaveBeenCalledWith({ where: { id: "L1" }, data: expect.objectContaining({ userId: "u1" }) });
    expect(sent()[0]).toContain("Xush kelibsiz");
  });

  it("eskirgan havolada tasdiqlanmaydi", async () => {
    registeredUser();
    db.telegramLogin.findUnique.mockResolvedValue(liveRow({ expiresAt: new Date(Date.now() - 1000) }));
    await handleUpdate(msg("/start l_abc"), "https://site.example");
    expect(db.telegramLogin.update).not.toHaveBeenCalled();
    expect(sent()[0]).toContain("eskirgan");
  });

  it("bir xil update ikkinchi marta kelsa javob berilmaydi", async () => {
    db.telegramUpdate.create.mockRejectedValue(Object.assign(new Error("dup"), { code: "P2002" }));
    await handleUpdate(msg("salom"), "https://site.example");
    expect(sent()).toHaveLength(0);
    expect(h.runFreeAi).not.toHaveBeenCalled();
  });

  it("guruh chatlari va botlar e'tiborga olinmaydi", async () => {
    await handleUpdate(msg("salom", { chat: { id: 1, type: "group" } }), "https://site.example");
    await handleUpdate(msg("salom", { from: { id: 9, is_bot: true } }), "https://site.example");
    expect(sent()).toHaveLength(0);
  });
});

describe("bot: AI suhbat", () => {
  it("oddiy savol AI'ga yuboriladi, javob botga va chat tarixiga yoziladi", async () => {
    registeredUser();
    db.aiChat.findFirst.mockResolvedValue({ id: "C1", messages: [{ role: "assistant", content: "javob2" }, { role: "user", content: "savol1" }] });
    h.runFreeAi.mockResolvedValue({ text: "AI javobi", model: "m" });
    await handleUpdate(msg("Dars rejasi tuz"), "https://site.example");
    const sentMessages = h.runFreeAi.mock.calls[0][1];
    expect(sentMessages.map((m: { content: string }) => m.content)).toEqual(["savol1", "javob2", "Dars rejasi tuz"]);
    expect(h.saveExchange).toHaveBeenCalledWith("u1", "C1", "telegram", "Dars rejasi tuz", "AI javobi");
    expect(sent()).toEqual(["AI javobi"]);
  });

  it("raqamini tasdiqlamagan foydalanuvchi AI'dan foydalana olmaydi, raqam so'raladi", async () => {
    db.user.findUnique.mockResolvedValue({ id: "u1", name: "Ali", phone: null, deletedAt: null });
    await handleUpdate(msg("salom"), "https://site.example");
    expect(h.runFreeAi).not.toHaveBeenCalled();
    expect(lastMarkup()?.keyboard?.[0][0].request_contact).toBe(true);
  });

  it("/start bosmagan foydalanuvchiga boshlashni aytadi va AI chaqirilmaydi", async () => {
    db.user.findUnique.mockResolvedValue(null);
    await handleUpdate(msg("salom"), "https://site.example");
    expect(sent()[0]).toContain("/start");
    expect(h.runFreeAi).not.toHaveBeenCalled();
  });

  it("/limit qolgan so'rovlarni ko'rsatadi", async () => {
    registeredUser(); h.freeUsageToday.mockResolvedValue({ used: 3, limit: 50, remaining: 47 });
    await handleUpdate(msg("/limit"), "https://site.example");
    expect(sent()[0]).toContain("47 / 50");
  });
});