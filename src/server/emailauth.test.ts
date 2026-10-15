import { beforeEach, describe, expect, it, vi } from "vitest";

process.env.AUTH_SECRET = "x".repeat(40);
process.env.SMTP_HOST = "smtp.test"; process.env.SMTP_USER = "u@test"; process.env.SMTP_PASS = "p";

const h = vi.hoisted(() => ({
  db: {
    user: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
    emailCode: { findFirst: vi.fn(), count: vi.fn(), create: vi.fn(), update: vi.fn() },
    authSession: { deleteMany: vi.fn() },
    auditLog: { create: vi.fn(), deleteMany: vi.fn() },
  },
  sent: [] as { kind: string; to: string; code: string }[],
  startSession: vi.fn(),
}));
vi.mock("./db", () => ({ db: h.db }));
vi.mock("./mail", () => ({
  mailConfigured: () => true,
  sendVerifyCode: async (to: string, code: string) => { h.sent.push({ kind: "verify", to, code }); },
  sendResetCode: async (to: string, code: string) => { h.sent.push({ kind: "reset", to, code }); },
}));
vi.mock("./auth", async (orig) => ({ ...(await orig<typeof import("./auth")>()), startSession: h.startSession }));

import { consumeCode, issueCode } from "./emailcode";
import { forgotPassword, resetPassword, startRegistration, verifyEmail } from "./emailauth";

const { db } = h;
beforeEach(() => {
  vi.clearAllMocks(); h.sent.length = 0;
  db.emailCode.findFirst.mockResolvedValue(null); db.emailCode.count.mockResolvedValue(0); db.emailCode.create.mockResolvedValue({});
  db.emailCode.update.mockResolvedValue({}); db.auditLog.create.mockResolvedValue({}); db.auditLog.deleteMany.mockResolvedValue({});
  db.authSession.deleteMany.mockResolvedValue({});
});

/** Yaratilgan kod xeshini saqlab, keyingi consumeCode uchun "bazadagi qator" sifatida qaytaradi. */
async function issueAndStore(email: string, purpose: "verify" | "reset") {
  const code = await issueCode(email, purpose);
  const stored = db.emailCode.create.mock.calls.at(-1)![0].data;
  return { code, row: { id: "c1", attempts: 0, ...stored } };
}

describe("emailcode", () => {
  it("6 xonali kod yaratadi va xeshini saqlaydi (kodning o'zini emas)", async () => {
    const { code, row } = await issueAndStore("a@b.uz", "verify");
    expect(code).toMatch(/^\d{6}$/);
    expect(row.codeHash).not.toContain(code);
  });
  it("tez-tez so'ralsa 429", async () => {
    db.emailCode.findFirst.mockResolvedValue({ createdAt: new Date() });
    await expect(issueCode("a@b.uz", "reset")).rejects.toMatchObject({ status: 429, code: "too_soon" });
  });
  it("to'g'ri kod qabul qilinadi va ishlatilgan deb belgilanadi", async () => {
    const { code, row } = await issueAndStore("a@b.uz", "verify");
    db.emailCode.findFirst.mockResolvedValue(row);
    await expect(consumeCode("a@b.uz", "verify", code)).resolves.toBeUndefined();
    expect(db.emailCode.update.mock.calls.at(-1)![0].data.usedAt).toBeInstanceOf(Date);
  });
  it("noto'g'ri kod rad etiladi va urinish hisobi oshadi", async () => {
    const { row } = await issueAndStore("a@b.uz", "verify");
    db.emailCode.findFirst.mockResolvedValue(row);
    await expect(consumeCode("a@b.uz", "verify", "000000")).rejects.toMatchObject({ status: 400, code: "bad_code" });
    expect(db.emailCode.update.mock.calls.at(-1)![0].data.attempts).toEqual({ increment: 1 });
  });
  it("5 ta noto'g'ri urinishdan keyin kod bloklanadi", async () => {
    const { code, row } = await issueAndStore("a@b.uz", "verify");
    db.emailCode.findFirst.mockResolvedValue({ ...row, attempts: 5 });
    await expect(consumeCode("a@b.uz", "verify", code)).rejects.toMatchObject({ status: 429, code: "too_many_attempts" });
  });
  it("kod boshqa maqsad uchun ishlamaydi (verify kodi reset uchun yaramaydi)", async () => {
    const { code, row } = await issueAndStore("a@b.uz", "verify");
    db.emailCode.findFirst.mockResolvedValue(row);
    await expect(consumeCode("a@b.uz", "reset", code)).rejects.toMatchObject({ code: "bad_code" });
  });
});

describe("ro'yxatdan o'tish", () => {
  it("yangi email: akkaunt ochiladi va tasdiqlash kodi yuboriladi", async () => {
    db.user.findUnique.mockResolvedValue(null); db.user.create.mockResolvedValue({ id: "u1" });
    await startRegistration(" Ali@Mail.uz ", "parol1234");
    expect(db.user.create.mock.calls[0][0].data.email).toBe("ali@mail.uz");
    expect(h.sent).toHaveLength(1);
    expect(h.sent[0]).toMatchObject({ kind: "verify", to: "ali@mail.uz" });
    expect(h.sent[0].code).toMatch(/^\d{6}$/);
  });
  it("tasdiqlangan email qayta ro'yxatdan o'tolmaydi (409)", async () => {
    db.user.findUnique.mockResolvedValue({ id: "u1", passwordHash: "scrypt$a$b", emailVerifiedAt: new Date(), deletedAt: null });
    await expect(startRegistration("a@b.uz", "parol1234")).rejects.toMatchObject({ status: 409 });
    expect(h.sent).toHaveLength(0);
  });
  it("tasdiqlanmagan akkaunt: parol yangilanadi va kod qayta yuboriladi", async () => {
    db.user.findUnique.mockResolvedValue({ id: "u1", passwordHash: "scrypt$old$old", emailVerifiedAt: null, deletedAt: null });
    db.user.update.mockResolvedValue({});
    await startRegistration("a@b.uz", "yangiparol1");
    expect(db.user.update.mock.calls[0][0].data.passwordHash).not.toBe("scrypt$old$old");
    expect(h.sent).toHaveLength(1);
  });
  it("kod to'g'ri bo'lsa email tasdiqlanadi va sessiya ochiladi", async () => {
    const { code, row } = await issueAndStore("a@b.uz", "verify");
    db.emailCode.findFirst.mockResolvedValue(row);
    db.user.findUnique.mockResolvedValue({ id: "u1", emailVerifiedAt: null, deletedAt: null });
    db.user.update.mockResolvedValue({ id: "u1" });
    await verifyEmail("a@b.uz", code);
    expect(db.user.update.mock.calls[0][0].data.emailVerifiedAt).toBeInstanceOf(Date);
    expect(h.startSession).toHaveBeenCalledWith("u1");
  });
});

describe("parolni tiklash", () => {
  it("mavjud bo'lmagan email uchun kod yuborilmaydi, lekin javob bir xil", async () => {
    db.user.findUnique.mockResolvedValue(null);
    await expect(forgotPassword("yoq@b.uz")).resolves.toEqual({ ok: true });
    expect(h.sent).toHaveLength(0);
  });
  it("mavjud email uchun tiklash kodi yuboriladi", async () => {
    db.user.findUnique.mockResolvedValue({ id: "u1", deletedAt: null });
    await forgotPassword("a@b.uz");
    expect(h.sent[0]).toMatchObject({ kind: "reset", to: "a@b.uz" });
  });
  it("tez-tez so'rash chegarasi javobda ko'rinmaydi", async () => {
    db.user.findUnique.mockResolvedValue({ id: "u1", deletedAt: null });
    db.emailCode.findFirst.mockResolvedValue({ createdAt: new Date() });
    await expect(forgotPassword("a@b.uz")).resolves.toEqual({ ok: true });
    expect(h.sent).toHaveLength(0);
  });
  it("kod bilan parol yangilanadi, eski sessiyalar va bloklash hisobi tozalanadi", async () => {
    const { code, row } = await issueAndStore("a@b.uz", "reset");
    db.emailCode.findFirst.mockResolvedValue(row);
    db.user.findUnique.mockResolvedValue({ id: "u1", emailVerifiedAt: null, deletedAt: null });
    db.user.update.mockResolvedValue({});
    await resetPassword("a@b.uz", code, "yangiparol9");
    expect(db.user.update.mock.calls[0][0].data.passwordHash).toMatch(/^scrypt\$/);
    expect(db.authSession.deleteMany).toHaveBeenCalledWith({ where: { userId: "u1" } });
    expect(db.auditLog.deleteMany).toHaveBeenCalled();
  });
  it("noto'g'ri kod bilan parol o'zgarmaydi", async () => {
    const { row } = await issueAndStore("a@b.uz", "reset");
    db.emailCode.findFirst.mockResolvedValue(row);
    await expect(resetPassword("a@b.uz", "123456", "yangiparol9")).rejects.toMatchObject({ code: "bad_code" });
    expect(db.user.update).not.toHaveBeenCalled();
  });
});
