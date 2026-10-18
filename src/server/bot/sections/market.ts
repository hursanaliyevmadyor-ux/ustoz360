import { fmtUzs, PLANS, type PlanKey } from "../../../lib/plans";
import { catalog } from "../../market";
import { cancelPayment, createOrder, myPurchases } from "../../payments";
import { getSetting } from "../../settings";
import { clip, esc, fmtDate, safeUrl } from "../botlogic";
import type { Ctx } from "../ctx";
import { b, link, type Btn } from "../tg";
import { heading, nav } from "../ui";

/** USTOZ MARKET botda: tasdiqlangan kurslar katalogi, sotib olish (buyurtma va to'lov ko'rsatmasi), mening kurslarim, obuna tariflari. */
const PAGE = 5;
const STATUS: Record<string, string> = { PENDING: "⏳ Kutilmoqda", PAID: "✅ To'langan", CANCELED: "❌ Bekor qilingan", REFUNDED: "↩️ Qaytarilgan", FAILED: "⚠️ Muvaffaqiyatsiz" };

export async function entry(ctx: Ctx) {
  await ctx.idle();
  await ctx.show({
    text: `${heading("🛒", "Kurslar va obuna")}\nTasdiqlangan kurslar, obuna tariflari va sizning xaridlaringiz.`,
    kb: [[b("🛍 Kurslar katalogi", "m.k.0")], [b("📚 Mening kurslarim", "m.my")], [b("💳 Obuna tariflari", "m.pl")], [b("🧾 Buyurtmalarim", "m.or")], nav()],
  });
}

async function list(ctx: Ctx, page: number) {
  const { courses } = await catalog(ctx.userId, {});
  const pages = Math.max(1, Math.ceil(courses.length / PAGE)), p = Math.min(Math.max(0, page), pages - 1);
  const slice = courses.slice(p * PAGE, p * PAGE + PAGE);
  const lines = [heading("🛍", "Kurslar katalogi"), courses.length ? "Batafsil ko'rish uchun kursni bosing." : "Hozircha sotuvda kurs yo'q."];
  const kb: Btn[][] = slice.map((c) => [b(`${c.owned ? "✅ " : ""}${clip(c.title, 30)} · ${c.priceUzs > 0 ? fmtUzs(c.priceUzs) : "bepul"}`, `m.c.${c.id}`)]);
  if (pages > 1) kb.push([...(p > 0 ? [b("◀️", `m.k.${p - 1}`)] : []), b(`${p + 1}/${pages}`, "x"), ...(p < pages - 1 ? [b("▶️", `m.k.${p + 1}`)] : [])]);
  kb.push(nav("m"));
  await ctx.show({ text: lines.join("\n"), kb });
}

async function course(ctx: Ctx, id: string) {
  const { courses } = await catalog(ctx.userId, {});
  const c = courses.find((x) => x.id === id);
  if (!c) return ctx.toast("Kurs topilmadi yoki sotuvda emas.", true);
  const lines = [
    heading("🎓", c.title), `${esc(c.subject)} · ${c.lessonCount} dars · ${esc(c.author)}`,
    `💰 ${c.priceUzs > 0 ? `<b>${fmtUzs(c.priceUzs)}</b>` : "<b>Bepul</b>"}`, "", esc(clip(c.description, 700)),
  ];
  const kb: Btn[][] = [];
  if (c.owned) kb.push([b("📚 Mening kurslarimda ochish", "m.my")]);
  else kb.push([b(c.priceUzs > 0 ? "🛍 Sotib olish" : "🎁 Bepul olish", `m.b.${id}`)]);
  kb.push(nav("m.k.0"));
  await ctx.show({ text: lines.join("\n"), kb });
}

async function orderScreen(ctx: Ctx, o: Awaited<ReturnType<typeof createOrder>>) {
  if (o.free) { await ctx.toast("Kursga kirish ochildi 🎁"); return myCourses(ctx); }
  const url = safeUrl(o.checkoutUrl);
  const lines = [
    heading("🧾", `Buyurtma: ${clip(o.title, 50)}`), "",
    `Summa: <b>${fmtUzs(o.payment.amount)}</b>`, `To'lov kodi: <code>${esc(o.payment.reference)}</code>`, "",
    o.instructions ? esc(o.instructions) : url ? "To'lash uchun pastdagi tugmani bosing." : "To'lov bo'yicha ma'lumot tez orada beriladi.",
    "", "<i>To'lov tasdiqlangach, kirish avtomatik ochiladi va sizga xabar keladi.</i>",
  ];
  const kb: Btn[][] = [];
  if (url) kb.push([link("💳 To'lash", url)]);
  kb.push([b("🧾 Buyurtmalarim", "m.or")], [b("❌ Buyurtmani bekor qilish", `m.cx.${o.payment.id}`)], nav("m"));
  await ctx.show({ text: lines.join("\n"), kb });
}

async function myCourses(ctx: Ctx) {
  const { courses } = await myPurchases(ctx.userId);
  const lines = [heading("📚", "Mening kurslarim"), courses.length ? "Ochish uchun kursni bosing." : "Hali kursingiz yo'q. Katalogdan tanlang."];
  const kb: Btn[][] = courses.slice(0, 10).map((c) => (safeUrl(c.accessUrl) ? [link(`▶️ ${clip(c.title, 40)}`, safeUrl(c.accessUrl)!)] : [b(`${clip(c.title, 40)} (havola yo'q)`, "x")]));
  kb.push([b("🛍 Katalog", "m.k.0")], nav("m"));
  await ctx.show({ text: lines.join("\n"), kb });
}

async function plans(ctx: Ctx) {
  const contact = (await getSetting("general").catch(() => null))?.supportContact;
  const lines = [heading("💳", "Obuna tariflari"), ""];
  for (const k of ["FREE", "PRO", "PREMIUM", "MARKAZ"] as PlanKey[]) {
    const p = PLANS[k];
    lines.push(`<b>${esc(p.name)}</b> · ${p.priceUzs === null ? "kelishuv asosida" : p.priceUzs === 0 ? "bepul" : `${fmtUzs(p.priceUzs)}/oy`}`, ...p.features.map((f) => `   • ${esc(f)}`), "");
  }
  if (contact) lines.push(`Savol bo'lsa: ${esc(contact)}`);
  await ctx.show({ text: lines.join("\n"), kb: [[b("PRO sotib olish", "m.bp.PRO"), b("PREMIUM sotib olish", "m.bp.PREMIUM")], nav("m")] });
}

async function orders(ctx: Ctx) {
  const { payments } = await myPurchases(ctx.userId);
  const lines = [heading("🧾", "Buyurtmalarim"), payments.length ? "" : "Hali buyurtma yo'q."];
  const kb: Btn[][] = [];
  for (const p of payments.slice(0, 6)) {
    lines.push(`${STATUS[p.status] ?? p.status}: <b>${esc(clip(p.title, 40))}</b>, ${fmtUzs(p.amount)} (${fmtDate(p.createdAt)})`);
    if (p.status === "PENDING") kb.push([b(`❌ Bekor qilish: ${clip(p.title, 24)}`, `m.cx.${p.id}`)]);
  }
  kb.push(nav("m"));
  await ctx.show({ text: lines.join("\n"), kb });
}

export async function onCb(ctx: Ctx, a: string[]) {
  const [act, x] = a;
  switch (act) {
    case "k": return list(ctx, Number(x) || 0);
    case "c": return course(ctx, x);
    case "b": return orderScreen(ctx, await createOrder(ctx.userId, { kind: "COURSE", courseId: x }));
    case "bp": return orderScreen(ctx, await createOrder(ctx.userId, { kind: "PLAN", planKey: x }));
    case "my": return myCourses(ctx);
    case "pl": return plans(ctx);
    case "or": return orders(ctx);
    case "cx": await cancelPayment(x, { userId: ctx.userId, admin: false }); await ctx.toast("Buyurtma bekor qilindi"); return orders(ctx);
    default: return entry(ctx);
  }
}
