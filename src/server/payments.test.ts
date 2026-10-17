import { beforeEach, describe, expect, it, vi } from "vitest";
import { signBody } from "./paymentlogic";

type Pay = { id: string; userId: string; kind: string; courseId: string | null; planKey: string | null; amount: number; currency: string; provider: string; providerRef: string | null; reference: string; status: string; createdAt: Date; paidAt: Date | null; meta?: unknown };

const h = vi.hoisted(() => {
  const state = { payments: [] as Pay[], access: [] as { userId: string; courseId: string; paymentId?: string | null }[], subs: [] as { userId: string; planKey: string; paymentId: string; endsAt: Date | null }[], events: [] as { eventId: string }[], course: { id: "c1", title: "Kurs", priceUzs: 5000, status: "APPROVED", authorId: "author" } as Record<string, unknown> | null, mode: "manual", seq: 0 };
  const match = (p: Pay, w: Record<string, unknown>) => Object.entries(w).every(([k, v]) => (k === "OR" ? true : typeof v === "object" && v !== null ? true : (p as unknown as Record<string, unknown>)[k] === v));
  const db = {
    course: { findUnique: vi.fn(async () => state.course) },
    courseAccess: {
      findUnique: vi.fn(async ({ where }: { where: { userId_courseId: { userId: string; courseId: string } } }) => state.access.find((a) => a.userId === where.userId_courseId.userId && a.courseId === where.userId_courseId.courseId) ?? null),
      create: vi.fn(async ({ data }: { data: { userId: string; courseId: string } }) => { state.access.push(data); return data; }),
      upsert: vi.fn(async ({ create }: { create: { userId: string; courseId: string; paymentId?: string } }) => { if (!state.access.some((a) => a.userId === create.userId && a.courseId === create.courseId)) state.access.push(create); return create; }),
      deleteMany: vi.fn(async ({ where }: { where: { paymentId: string } }) => { state.access = state.access.filter((a) => a.paymentId !== where.paymentId); return { count: 1 }; }),
    },
    subscription: {
      findFirst: vi.fn(async () => null),
      create: vi.fn(async ({ data }: { data: { userId: string; planKey: string; paymentId: string; endsAt: Date | null } }) => { state.subs.push(data); return data; }),
      updateMany: vi.fn(async () => ({ count: 1 })),
    },
    payment: {
      findUnique: vi.fn(async ({ where }: { where: { id?: string; reference?: string } }) => state.payments.find((p) => (where.id ? p.id === where.id : p.reference === where.reference)) ?? null),
      findFirst: vi.fn(async ({ where }: { where: Record<string, unknown> }) => state.payments.find((p) => match(p, where)) ?? null),
      create: vi.fn(async ({ data }: { data: Partial<Pay> }) => { const p = { id: `p${++state.seq}`, currency: "UZS", providerRef: null, createdAt: new Date(), paidAt: null, status: "PENDING", courseId: null, planKey: null, ...data } as Pay; state.payments.push(p); return p; }),
      updateMany: vi.fn(async ({ where, data }: { where: { id: string; status: string }; data: Partial<Pay> }) => { const p = state.payments.find((x) => x.id === where.id && x.status === where.status); if (!p) return { count: 0 }; Object.assign(p, data); return { count: 1 }; }),
    },
    webhookEvent: {
      findUnique: vi.fn(async ({ where }: { where: { provider_eventId: { eventId: string } } }) => state.events.find((e) => e.eventId === where.provider_eventId.eventId) ?? null),
      create: vi.fn(async ({ data }: { data: { eventId: string } }) => { state.events.push(data); return data; }),
    },
    $transaction: vi.fn(async (arg: unknown) => (typeof arg === "function" ? (arg as (tx: unknown) => Promise<unknown>)(db) : Promise.all(arg as Promise<unknown>[]))),
  };
  return { state, db };
});

vi.mock("./db", () => ({ db: h.db }));
vi.mock("./audit", () => ({ audit: vi.fn(async () => {}) }));
vi.mock("./notify", () => ({ notify: vi.fn(async () => {}) }));
vi.mock("./settings", () => ({ getSetting: vi.fn(async () => ({ mode: h.state.mode, manualInstructions: "Karta 0000", minPriceUzs: 0 })) }));

import { cancelPayment, confirmPayment, createOrder, handleWebhook, refundPayment } from "./payments";

const secret = "whsec-test";
beforeEach(() => {
  h.state.payments = []; h.state.access = []; h.state.subs = []; h.state.events = []; h.state.seq = 0; h.state.mode = "manual";
  h.state.course = { id: "c1", title: "Kurs", priceUzs: 5000, status: "APPROVED", authorId: "author" };
  delete process.env.PAYMENT_WEBHOOK_SECRET; delete process.env.PAYMENT_CHECKOUT_URL;
  vi.clearAllMocks();
});

describe("buyurtma", () => {
  it("to'lov tizimi yopiq bo'lsa 503 va hech narsa yaratilmaydi", async () => {
    h.state.mode = "off";
    await expect(createOrder("u1", { kind: "COURSE", courseId: "c1" })).rejects.toMatchObject({ status: 503, code: "payments_off" });
    expect(h.state.payments).toHaveLength(0);
  });
  it("narx bazadan olinadi va kirish hali ochilmaydi", async () => {
    const r = await createOrder("u1", { kind: "COURSE", courseId: "c1" });
    expect(r.free).toBe(false);
    expect(h.state.payments[0]).toMatchObject({ amount: 5000, status: "PENDING", provider: "manual" });
    expect(h.state.access).toHaveLength(0);
  });
  it("sotuvda bo'lmagan kurs, o'z kursi va allaqachon sotib olingan kurs rad etiladi", async () => {
    h.state.course = { id: "c1", title: "K", priceUzs: 5000, status: "REVIEW", authorId: "author" };
    await expect(createOrder("u1", { kind: "COURSE", courseId: "c1" })).rejects.toMatchObject({ status: 404 });
    h.state.course = { id: "c1", title: "K", priceUzs: 5000, status: "APPROVED", authorId: "u1" };
    await expect(createOrder("u1", { kind: "COURSE", courseId: "c1" })).rejects.toMatchObject({ status: 400 });
    h.state.course = { id: "c1", title: "K", priceUzs: 5000, status: "APPROVED", authorId: "author" };
    h.state.access.push({ userId: "u1", courseId: "c1" });
    await expect(createOrder("u1", { kind: "COURSE", courseId: "c1" })).rejects.toMatchObject({ status: 409, code: "owned" });
  });
  it("bepul kurs darhol ochiladi, to'lov yaratilmaydi", async () => {
    h.state.course = { id: "c1", title: "K", priceUzs: 0, status: "APPROVED", authorId: "author" };
    const r = await createOrder("u1", { kind: "COURSE", courseId: "c1" });
    expect(r.free).toBe(true);
    expect(h.state.access).toHaveLength(1);
    expect(h.state.payments).toHaveLength(0);
  });
  it("ochiq buyurtma bo'lsa ikkinchisi yaratilmaydi", async () => {
    await createOrder("u1", { kind: "COURSE", courseId: "c1" });
    await createOrder("u1", { kind: "COURSE", courseId: "c1" });
    expect(h.state.payments).toHaveLength(1);
  });
  it("tarif: faqat narxi bor tarif sotib olinadi", async () => {
    await expect(createOrder("u1", { kind: "PLAN", planKey: "FREE" })).rejects.toMatchObject({ status: 400 });
    await expect(createOrder("u1", { kind: "PLAN", planKey: "MARKAZ" })).rejects.toMatchObject({ status: 400 });
    await createOrder("u1", { kind: "PLAN", planKey: "PRO" });
    expect(h.state.payments[0]).toMatchObject({ amount: 39000, planKey: "PRO" });
  });
  it("provayder rejimi kalitlar ulanmaguncha ishlamaydi", async () => {
    h.state.mode = "provider";
    await expect(createOrder("u1", { kind: "COURSE", courseId: "c1" })).rejects.toMatchObject({ status: 503 });
    process.env.PAYMENT_WEBHOOK_SECRET = secret; process.env.PAYMENT_CHECKOUT_URL = "https://pay.example/c?ref={reference}&sum={amount}";
    const r = await createOrder("u1", { kind: "COURSE", courseId: "c1" });
    expect(r.free === false && r.checkoutUrl).toMatch(/^https:\/\/pay\.example\/c\?ref=U360-[A-Z0-9]{8}&sum=5000$/);
  });
});

describe("tasdiqlash (idempotent)", () => {
  it("to'lov tasdiqlangach kirish ochiladi, takroriy tasdiq hech narsani o'zgartirmaydi", async () => {
    await createOrder("u1", { kind: "COURSE", courseId: "c1" });
    const id = h.state.payments[0].id;
    const a = await confirmPayment(id, { adminId: "adm" });
    const b = await confirmPayment(id, { adminId: "adm" });
    expect(a.already).toBe(false); expect(b.already).toBe(true);
    expect(h.state.access).toHaveLength(1);
    expect(h.state.payments[0].status).toBe("PAID");
  });
  it("bir vaqtda ikki marta tasdiqlansa ham kirish bir marta beriladi", async () => {
    await createOrder("u1", { kind: "PLAN", planKey: "PRO" });
    const id = h.state.payments[0].id;
    await Promise.all([confirmPayment(id, { adminId: "a" }), confirmPayment(id, { adminId: "a" })]);
    expect(h.state.subs).toHaveLength(1);
    expect(h.state.subs[0].planKey).toBe("PRO");
  });
  it("bekor qilingan buyurtmani tasdiqlab bo'lmaydi", async () => {
    await createOrder("u1", { kind: "COURSE", courseId: "c1" });
    const id = h.state.payments[0].id;
    await cancelPayment(id, { userId: "u1", admin: false });
    await expect(confirmPayment(id, { adminId: "a" })).rejects.toMatchObject({ status: 409 });
    expect(h.state.access).toHaveLength(0);
  });
  it("boshqa foydalanuvchi buyurtmani bekor qila olmaydi; to'langanni bekor qilib bo'lmaydi", async () => {
    await createOrder("u1", { kind: "COURSE", courseId: "c1" });
    const id = h.state.payments[0].id;
    await expect(cancelPayment(id, { userId: "u2", admin: false })).rejects.toMatchObject({ status: 404 });
    await confirmPayment(id, {});
    await expect(cancelPayment(id, { userId: "u1", admin: false })).rejects.toMatchObject({ status: 409 });
  });
  it("qaytarilganda kirish olib tashlanadi, faqat to'langanni qaytarish mumkin", async () => {
    await createOrder("u1", { kind: "COURSE", courseId: "c1" });
    const id = h.state.payments[0].id;
    await expect(refundPayment(id, "adm")).rejects.toMatchObject({ status: 409 });
    await confirmPayment(id, {});
    await refundPayment(id, "adm");
    expect(h.state.access).toHaveLength(0);
    expect(h.state.payments[0].status).toBe("REFUNDED");
  });
});

describe("webhook", () => {
  const body = (o: Record<string, unknown>) => JSON.stringify({ eventId: "e1", status: "paid", ...o });
  const send = (raw: string, sig = signBody(secret, raw)) => handleWebhook(raw, sig);

  it("kalit sozlanmagan bo'lsa 503", async () => {
    await expect(handleWebhook("{}", "x")).rejects.toMatchObject({ status: 503 });
  });
  it("noto'g'ri imzo 401, hech narsa o'zgarmaydi", async () => {
    process.env.PAYMENT_WEBHOOK_SECRET = secret;
    await createOrder("u1", { kind: "COURSE", courseId: "c1" });
    const raw = body({ reference: h.state.payments[0].reference, amount: 5000 });
    await expect(send(raw, "00".repeat(32))).rejects.toMatchObject({ status: 401 });
    expect(h.state.payments[0].status).toBe("PENDING");
  });
  it("to'g'ri imzo va summa: to'lov tasdiqlanadi, takroriy xabar duplikat deb qaytadi", async () => {
    process.env.PAYMENT_WEBHOOK_SECRET = secret;
    await createOrder("u1", { kind: "COURSE", courseId: "c1" });
    const raw = body({ reference: h.state.payments[0].reference, amount: 5000 });
    expect(await send(raw)).toEqual({ ok: true });
    expect(await send(raw)).toEqual({ duplicate: true });
    expect(h.state.access).toHaveLength(1);
    expect(h.state.payments[0].status).toBe("PAID");
  });
  it("summa mos kelmasa tasdiqlanmaydi (409)", async () => {
    process.env.PAYMENT_WEBHOOK_SECRET = secret;
    await createOrder("u1", { kind: "COURSE", courseId: "c1" });
    await expect(send(body({ reference: h.state.payments[0].reference, amount: 1 }))).rejects.toMatchObject({ status: 409 });
    expect(h.state.payments[0].status).toBe("PENDING");
    expect(h.state.access).toHaveLength(0);
  });
  it("noma'lum buyurtma 404; 'failed' holati kutilayotgan buyurtmani yopadi", async () => {
    process.env.PAYMENT_WEBHOOK_SECRET = secret;
    await expect(send(body({ reference: "U360-NOMALUM1", amount: 5000 }))).rejects.toMatchObject({ status: 404 });
    await createOrder("u1", { kind: "COURSE", courseId: "c1" });
    await send(body({ eventId: "e2", status: "failed", reference: h.state.payments[0].reference, amount: 5000 }));
    expect(h.state.payments[0].status).toBe("FAILED");
  });
});
