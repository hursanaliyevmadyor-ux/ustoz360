import { REGIONS } from "../../../lib/regions";
import { freeUsageToday } from "../../ai/gateway";
import { db } from "../../db";
import { getEntitlements } from "../../entitlements";
import { esc, fmtDate, personName } from "../botlogic";
import { saveRemind, type Ctx } from "../ctx";
import { EXAM_LABEL, saveProfile } from "../profile";
import { b, link, sendScreen, type Btn } from "../tg";
import { HELP, heading, MENU_MARKUP, nav } from "../ui";

/** Profil va ro'yxatdan o'tishni yakunlash (ism, viloyat, tuman): saytdagi /royxat bilan bir xil talablar. */

export async function entry(ctx: Ctx) {
  await ctx.idle();
  const [u, ent, sub, ai, courses, pending] = await Promise.all([
    db.user.findUnique({ where: { id: ctx.userId }, select: { name: true, phone: true, email: true, profile: { select: { region: true, district: true, targetExam: true, examDate: true } } } }),
    getEntitlements(ctx.userId).catch(() => null),
    db.subscription.findFirst({ where: { userId: ctx.userId, status: "ACTIVE", endsAt: { gt: new Date() } }, orderBy: { endsAt: "desc" }, select: { endsAt: true } }),
    freeUsageToday(ctx.userId).catch(() => null),
    db.courseAccess.count({ where: { userId: ctx.userId } }),
    db.payment.count({ where: { userId: ctx.userId, status: "PENDING" } }),
  ]);
  const p = u?.profile;
  const lines = [
    heading("👤", "Profil"), `<b>${esc(u?.name ?? "Ism kiritilmagan")}</b>`,
    u?.phone ? `📱 ${esc(u.phone)}` : "", p?.region ? `📍 ${esc(p.region)}${p.district ? `, ${esc(p.district)}` : ""}` : "",
    p?.targetExam ? `🎯 ${EXAM_LABEL[p.targetExam as keyof typeof EXAM_LABEL] ?? esc(p.targetExam)}${p.examDate ? `, ${fmtDate(p.examDate.toISOString())}` : ""}` : "",
    "", `💳 Tarif: <b>${esc(ent?.planName ?? "FREE")}</b>${sub?.endsAt ? ` (${fmtDate(sub.endsAt.toISOString())} gacha)` : ""}`,
    ai ? `🤖 Bugun qolgan AI so'rovlari: <b>${ai.remaining}/${ai.limit}</b>` : "",
    `📚 Kurslarim: ${courses}${pending ? `   ⏳ Kutilayotgan buyurtma: ${pending}` : ""}`,
    `🔔 Kunlik eslatma: <b>${ctx.state.remind ? "yoqilgan" : "o'chirilgan"}</b>`,
  ].filter(Boolean);
  const kb: Btn[][] = [
    [b(ctx.state.remind ? "🔕 Eslatmani o'chirish" : "🔔 Eslatmani yoqish", "u.rm")],
    [b("🎯 Imtihon maqsadi", "p.goal"), b("✏️ Ism va hudud", "u.edit")],
    [b("💳 Tariflar", "m.pl"), b("❓ Yordam", "u.help")],
    [link("🌐 Saytni ochish", ctx.origin)], nav(),
  ];
  await ctx.show({ text: lines.join("\n"), kb });
}

export async function onCb(ctx: Ctx, a: string[]) {
  if (a[0] === "rm") {
    const on = !ctx.state.remind;
    await saveRemind(ctx.userId, on);
    ctx.state = { ...ctx.state, remind: on };
    await ctx.toast(on ? "Eslatma yoqildi 🔔" : "Eslatma o'chirildi");
    return entry(ctx);
  }
  if (a[0] === "help") return ctx.show({ text: HELP, kb: [nav("u")] });
  if (a[0] === "edit") return startOnboarding(ctx);
  return entry(ctx);
}

// ---------- Ro'yxatdan o'tishni yakunlash ----------
export async function startOnboarding(ctx: Ctx) {
  await ctx.mode("o.name");
  await ctx.say(`${heading("📝", "Ro'yxatdan o'tishni yakunlaymiz")}\n1/3. Ism va familiyangizni yozing.\nMasalan: <b>Aziza Karimova</b>`);
}

const regionRows = (): Btn[][] => {
  const rows: Btn[][] = [];
  REGIONS.forEach((r, i) => { if (i % 2 === 0) rows.push([]); rows[rows.length - 1].push(b(r, `o.r.${i}`)); });
  return rows;
};

/** Qaysi bosqichda to'xtagan bo'lsa, o'sha savolni qayta so'raydi (menyu tugmasi yoki /start bosilganda bosqich yo'qolmaydi). */
export async function resumeOnboarding(ctx: Ctx) {
  const d = ctx.state.data as { name?: string; region?: string };
  if (ctx.state.mode === "o.region" && d.name) return ctx.say({ text: `Ro'yxatdan o'tishni yakunlaymiz.\n\n2/3. Yashash viloyatingizni tanlang:`, kb: regionRows() });
  if (ctx.state.mode === "o.district" && d.name && d.region) return ctx.say(`Ro'yxatdan o'tishni yakunlaymiz. Viloyat: <b>${esc(d.region)}</b>\n\n3/3. Tuman yoki shahar nomini yozing.\nMasalan: <b>Chilonzor tumani</b>`);
  return startOnboarding(ctx);
}

export async function onboardCb(ctx: Ctx, a: string[]) {
  if (a[0] === "r") {
    const region = REGIONS[Number(a[1])];
    if (!region) return startOnboarding(ctx);
    await ctx.mode("o.district", { ...ctx.state.data, region });
    return ctx.show({ text: `Viloyat: <b>${esc(region)}</b>\n\n3/3. Tuman yoki shahar nomini yozing.\nMasalan: <b>Chilonzor tumani</b>` });
  }
  return startOnboarding(ctx);
}

/** Ro'yxatdan o'tish bosqichlari matni. true: xabar shu bosqichga tegishli edi. */
export async function onboardText(ctx: Ctx, mode: string, text: string): Promise<boolean> {
  if (mode === "o.name") {
    const name = personName(text);
    if (!name) { await ctx.say("Ism va familiyani to'liq, harflar bilan yozing. Masalan: <b>Aziza Karimova</b>"); return true; }
    await ctx.mode("o.region", { name });
    await ctx.say({ text: `Rahmat, <b>${esc(name)}</b>!\n\n2/3. Yashash viloyatingizni tanlang:`, kb: regionRows() });
    return true;
  }
  if (mode === "o.region") { await ctx.say({ text: "Viloyatni tugmalardan tanlang:", kb: regionRows() }); return true; }
  if (mode === "o.district") {
    const district = text.trim().slice(0, 80);
    if (!district) { await ctx.say("Tuman yoki shahar nomini yozing."); return true; }
    const d = ctx.state.data as { name?: string; region?: string };
    await saveProfile(ctx.userId, { name: d.name, region: d.region, district, complete: true });
    await ctx.idle();
    await sendScreen(ctx.chatId, { text: "🎉 <b>Tayyor!</b> Ro'yxatdan o'tish yakunlandi.\n\nPastdagi menyudan bo'lim tanlang. Adashib qolsangiz: /menyu" }, { reply_markup: MENU_MARKUP });
    return true;
  }
  return false;
}
