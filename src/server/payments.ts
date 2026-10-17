import { Prisma } from "@prisma/client";
import { PLANS, isPlanKey } from "../lib/plans";
import { ApiError } from "./auth";
import { audit } from "./audit";
import { db } from "./db";
import { nextSubscriptionEnd } from "./entitlementlogic";
import { notify } from "./notify";
import { canTransition, checkoutUrl, makeReference, verifySignature, webhookEventSchema } from "./paymentlogic";
import { getSetting } from "./settings";

/**
 * To'lov xizmati (provayderga bog'liq emas). Qoida: kurs yoki obuna FAQAT to'lov serverda tasdiqlangandan keyin (status PAID) beriladi.
 * Narx doim bazadan olinadi (brauzer yuborgan summaga ishonilmaydi). Kalitlar faqat muhit o'zgaruvchilarida.
 */
const TX = { maxWait: 15_000, timeout: 60_000 } as const;

export type OrderInput = { kind: "COURSE"; courseId: string } | { kind: "PLAN"; planKey: string };

/** Admin panel va foydalanuvchiga ko'rsatiladigan holat: kalit qiymatlari emas, faqat ulangan/ulanmagan. */
export function paymentStatus() {
  const webhook = Boolean(process.env.PAYMENT_WEBHOOK_SECRET);
  const checkout = Boolean(process.env.PAYMENT_CHECKOUT_URL);
  return {
    webhookSecret: webhook, checkoutUrl: checkout,
    providerReady: webhook && checkout,
    providers: [
      { id: "manual", name: "Bank o'tkazmasi (admin tasdiqlaydi)", ready: true },
      { id: "webhook", name: "Umumiy webhook (HMAC imzo)", ready: webhook && checkout },
      { id: "click", name: "Click", ready: false, note: "Provayder shartnomasi va kalitlari kerak" },
      { id: "payme", name: "Payme", ready: false, note: "Provayder shartnomasi va kalitlari kerak" },
    ],
  };
}

async function activeProvider(): Promise<"manual" | "webhook"> {
  const { mode } = await getSetting("payments");
  if (mode === "manual") return "manual";
  if (mode === "provider" && paymentStatus().providerReady) return "webhook";
  throw new ApiError(503, "To'lov tizimi hali ulanmagan.", "payments_off");
}

const view = (p: { id: string; kind: string; courseId: string | null; planKey: string | null; amount: number; reference: string; status: string; provider: string; createdAt: Date; paidAt: Date | null }) => ({
  id: p.id, kind: p.kind, courseId: p.courseId, planKey: p.planKey, amount: p.amount, reference: p.reference, status: p.status, provider: p.provider,
  createdAt: p.createdAt.toISOString(), paidAt: p.paidAt?.toISOString() ?? null,
});

export async function createOrder(userId: string, input: OrderInput) {
  let amount: number; let courseId: string | null = null; let planKey: string | null = null; let title: string;
  if (input.kind === "COURSE") {
    const c = await db.course.findUnique({ where: { id: input.courseId }, select: { id: true, title: true, priceUzs: true, status: true, authorId: true } });
    if (!c || c.status !== "APPROVED") throw new ApiError(404, "Kurs topilmadi yoki sotuvda emas.");
    if (c.authorId === userId) throw new ApiError(400, "O'z kursingizni sotib olib bo'lmaydi.");
    if (await db.courseAccess.findUnique({ where: { userId_courseId: { userId, courseId: c.id } }, select: { id: true } })) throw new ApiError(409, "Bu kursga allaqachon kirishingiz bor.", "owned");
    if (c.priceUzs <= 0) { // bepul kurs: to'lov kerak emas
      await db.courseAccess.create({ data: { userId, courseId: c.id } });
      await audit(userId, "market.free_access", { courseId: c.id });
      return { free: true as const, courseId: c.id };
    }
    amount = c.priceUzs; courseId = c.id; title = c.title;
  } else {
    if (!isPlanKey(input.planKey) || !PLANS[input.planKey].priceUzs) throw new ApiError(400, "Bu tarifni sotib olib bo'lmaydi.");
    amount = PLANS[input.planKey].priceUzs!; planKey = input.planKey; title = `${PLANS[input.planKey].name} tarifi`;
  }
  const provider = await activeProvider();
  // Shu maqsad uchun ochiq buyurtma bo'lsa, yangisini yaratmaymiz.
  const open = await db.payment.findFirst({ where: { userId, status: "PENDING", ...(courseId ? { courseId } : { planKey }) } });
  const p = open ?? await db.payment.create({ data: { userId, kind: input.kind, courseId, planKey, amount, provider, reference: makeReference(), meta: { title } } });
  const { manualInstructions } = await getSetting("payments");
  const url = provider === "webhook" && process.env.PAYMENT_CHECKOUT_URL ? checkoutUrl(process.env.PAYMENT_CHECKOUT_URL, { reference: p.reference, amount: p.amount }) : null;
  return { free: false as const, payment: view(p), title, instructions: provider === "manual" ? manualInstructions : null, checkoutUrl: url };
}

async function grant(tx: Prisma.TransactionClient, p: { id: string; userId: string; kind: string; courseId: string | null; planKey: string | null }) {
  if (p.kind === "COURSE" && p.courseId) {
    await tx.courseAccess.upsert({ where: { userId_courseId: { userId: p.userId, courseId: p.courseId } }, create: { userId: p.userId, courseId: p.courseId, paymentId: p.id }, update: {} });
  } else if (p.kind === "PLAN" && p.planKey) {
    const cur = await tx.subscription.findFirst({ where: { userId: p.userId, planKey: p.planKey, status: "ACTIVE", endsAt: { gt: new Date() } }, orderBy: { endsAt: "desc" } });
    await tx.subscription.create({ data: { userId: p.userId, planKey: p.planKey, status: "ACTIVE", source: "PAYMENT", paymentId: p.id, endsAt: nextSubscriptionEnd(cur?.endsAt ?? null) } });
  }
}

/** Idempotent: ikkinchi chaqiruv hech narsani o'zgartirmaydi (kurs/obuna ikki marta berilmaydi). */
export async function confirmPayment(paymentId: string, by: { adminId?: string; providerRef?: string } = {}) {
  const p = await db.payment.findUnique({ where: { id: paymentId } });
  if (!p) throw new ApiError(404, "To'lov topilmadi.");
  if (p.status === "PAID") return { already: true as const, payment: view(p) };
  if (!canTransition(p.status, "PAID")) throw new ApiError(409, "Bu to'lovni tasdiqlab bo'lmaydi.");
  const claimed = await db.$transaction(async (tx) => {
    const r = await tx.payment.updateMany({ where: { id: p.id, status: "PENDING" }, data: { status: "PAID", paidAt: new Date(), ...(by.providerRef && { providerRef: by.providerRef }) } });
    if (r.count === 0) return false;
    await grant(tx, p);
    return true;
  }, TX);
  if (!claimed) return { already: true as const, payment: view((await db.payment.findUnique({ where: { id: p.id } }))!) };
  await audit(by.adminId ?? null, "payment.paid", { paymentId: p.id, kind: p.kind, amount: p.amount, by: by.adminId ? "admin" : "provider" });
  const what = p.kind === "COURSE" ? "Kursga kirish ochildi." : `${PLANS[p.planKey as keyof typeof PLANS]?.name ?? "Tarif"} faollashtirildi.`;
  await notify(p.userId, { kind: "payment", title: "To'lov tasdiqlandi", text: what, href: p.kind === "COURSE" ? "/market/mening-kurslarim" : "/obuna" });
  if (p.kind === "COURSE" && p.courseId) {
    const c = await db.course.findUnique({ where: { id: p.courseId }, select: { authorId: true, title: true } });
    if (c) await notify(c.authorId, { kind: "market", title: "Kursingiz sotildi", text: `«${c.title}» kursini yangi o'quvchi sotib oldi.`, href: "/market/muallif" });
  }
  return { already: false as const, payment: view((await db.payment.findUnique({ where: { id: p.id } }))!) };
}

export async function cancelPayment(paymentId: string, actor: { userId: string; admin: boolean }) {
  const p = await db.payment.findUnique({ where: { id: paymentId } });
  if (!p || (!actor.admin && p.userId !== actor.userId)) throw new ApiError(404, "To'lov topilmadi.");
  if (!canTransition(p.status, "CANCELED")) throw new ApiError(409, "Bu buyurtmani bekor qilib bo'lmaydi.");
  const r = await db.payment.updateMany({ where: { id: p.id, status: "PENDING" }, data: { status: "CANCELED" } });
  if (!r.count) throw new ApiError(409, "Buyurtma holati o'zgargan.");
  await audit(actor.userId, "payment.canceled", { paymentId: p.id });
  return { ok: true as const };
}

/** Admin: to'langan to'lovni qaytarish. Kirish olib tashlanadi (pul qaytarish provayder/bank orqali alohida bajariladi). */
export async function refundPayment(paymentId: string, adminId: string) {
  const p = await db.payment.findUnique({ where: { id: paymentId } });
  if (!p) throw new ApiError(404, "To'lov topilmadi.");
  if (!canTransition(p.status, "REFUNDED")) throw new ApiError(409, "Faqat to'langan to'lovni qaytarish mumkin.");
  await db.$transaction(async (tx) => {
    const r = await tx.payment.updateMany({ where: { id: p.id, status: "PAID" }, data: { status: "REFUNDED" } });
    if (!r.count) throw new ApiError(409, "To'lov holati o'zgargan.");
    await tx.courseAccess.deleteMany({ where: { paymentId: p.id } });
    await tx.subscription.updateMany({ where: { paymentId: p.id }, data: { status: "CANCELED", endsAt: new Date() } });
  }, TX);
  await audit(adminId, "payment.refunded", { paymentId: p.id, amount: p.amount });
  await notify(p.userId, { kind: "payment", title: "To'lov qaytarildi", text: "To'lovingiz qaytarildi, kirish yopildi.", href: "/obuna" });
  return { ok: true as const };
}

/**
 * Provayder webhooki (umumiy format, HMAC-SHA256 imzo). Takroriy xabar xavfsiz: tasdiqlash idempotent.
 * Summa buyurtma summasiga to'liq teng bo'lmasa tasdiqlanmaydi.
 */
export async function handleWebhook(raw: string, signature: string | null) {
  const secret = process.env.PAYMENT_WEBHOOK_SECRET;
  if (!secret) throw new ApiError(503, "Webhook sozlanmagan.");
  if (!verifySignature(secret, raw, signature)) throw new ApiError(401, "Imzo noto'g'ri.");
  let body: unknown;
  try { body = JSON.parse(raw); } catch { throw new ApiError(400, "Xabar formati noto'g'ri."); }
  const ev = webhookEventSchema.parse(body);
  if (await db.webhookEvent.findUnique({ where: { provider_eventId: { provider: "webhook", eventId: ev.eventId } }, select: { id: true } })) return { duplicate: true as const };
  const p = await db.payment.findUnique({ where: { reference: ev.reference } });
  if (!p) throw new ApiError(404, "Buyurtma topilmadi.");
  if (ev.status === "paid") {
    if (ev.amount !== p.amount) { await audit(null, "payment.amount_mismatch", { paymentId: p.id, expected: p.amount, got: ev.amount }); throw new ApiError(409, "Summa mos kelmadi."); }
    await confirmPayment(p.id, { providerRef: ev.providerRef ?? ev.eventId });
  } else {
    await db.payment.updateMany({ where: { id: p.id, status: "PENDING" }, data: { status: "FAILED" } });
  }
  try { await db.webhookEvent.create({ data: { provider: "webhook", eventId: ev.eventId } }); }
  catch (e) { if ((e as { code?: string }).code !== "P2002") throw e; }
  return { ok: true as const };
}

// ---------- ro'yxatlar ----------

export async function myPurchases(userId: string) {
  const [pays, access] = await Promise.all([
    db.payment.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: 50, include: { course: { select: { title: true } } } }),
    db.courseAccess.findMany({ where: { userId }, orderBy: { grantedAt: "desc" }, include: { course: { select: { id: true, title: true, subject: true, kind: true, accessUrl: true, lessonCount: true } } } }),
  ]);
  return {
    payments: pays.map((p) => ({ ...view(p), title: p.course?.title ?? (p.planKey ? `${PLANS[p.planKey as keyof typeof PLANS]?.name ?? p.planKey} tarifi` : "To'lov") })),
    courses: access.map((a) => ({ id: a.course.id, title: a.course.title, subject: a.course.subject, kind: a.course.kind, accessUrl: a.course.accessUrl, lessonCount: a.course.lessonCount, grantedAt: a.grantedAt.toISOString() })),
  };
}

export async function adminPayments(opts: { status?: string; take?: number } = {}) {
  const where = opts.status ? { status: opts.status } : {};
  const [rows, sums] = await Promise.all([
    db.payment.findMany({ where, orderBy: { createdAt: "desc" }, take: Math.min(opts.take ?? 100, 500), include: { user: { select: { name: true, email: true } }, course: { select: { title: true } } } }),
    db.payment.groupBy({ by: ["status"], _sum: { amount: true }, _count: true }),
  ]);
  return {
    payments: rows.map((p) => ({ ...view(p), user: p.user.name ?? p.user.email ?? "—", title: p.course?.title ?? (p.planKey ? `${p.planKey} tarifi` : "—") })),
    totals: Object.fromEntries(sums.map((s) => [s.status, { count: s._count, amount: s._sum.amount ?? 0 }])),
  };
}
