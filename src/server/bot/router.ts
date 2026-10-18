import { ZodError } from "zod";
import "../zodconfig";
import { ApiError } from "../auth";
import { db } from "../db";
import { createCtx, loadState, type Ctx } from "./ctx";
import { esc } from "./botlogic";
import * as ai from "./sections/ai";
import * as darsyor from "./sections/darsyor";
import * as home from "./sections/home";
import * as library from "./sections/library";
import * as market from "./sections/market";
import * as profile from "./sections/profile";
import * as seminars from "./sections/seminars";
import * as sinf from "./sections/sinf";
import * as tests from "./sections/tests";
import * as toifa from "./sections/toifa";
import { answerCallback, sendScreen, type TgCallback, type TgMessage, type TgUser } from "./tg";
import { HELP, MENU_MARKUP, SECTION_BY_COMMAND, SECTION_BY_TEXT, nav, type Sec } from "./ui";

/** Botdagi barcha xabar va tugmalarni bo'limlarga yo'naltiradi. Bo'limlar Telegram tafsilotini bilmaydi: faqat Ctx bilan ishlaydi. */
export type BotUser = { id: string; name: string | null; onboarded: boolean };

const ENTRY: Record<Sec, (ctx: Ctx) => Promise<void>> = {
  h: home.entry, t: tests.entry, p: toifa.entry, s: sinf.entry, d: darsyor.entry, l: library.entry, m: market.entry, n: seminars.entry, a: ai.entry, u: profile.entry,
};
const CB: Record<string, (ctx: Ctx, a: string[]) => Promise<unknown>> = {
  h: home.onCb, t: tests.onCb, p: toifa.onCb, s: sinf.onCb, d: darsyor.onCb, l: library.onCb, m: market.onCb, n: seminars.onCb, a: ai.onCb, u: profile.onCb, o: profile.onboardCb,
};
/** Matn kutayotgan holatlar: mode prefiksi -> ishlovchi. */
const TEXT: [string, (ctx: Ctx, mode: string, text: string) => Promise<boolean>][] = [
  ["o.", profile.onboardText], ["p.", toifa.onText], ["s.", sinf.onText], ["d.", darsyor.onText], ["l.", library.onText], ["ai", ai.onText],
];

/** Xatoni foydalanuvchiga tushunarli matnga aylantiradi. Kutilmagan xato tafsiloti ko'rsatilmaydi. */
export function errorText(e: unknown): string {
  if (e instanceof ApiError) return e.message;
  if (e instanceof ZodError) return e.issues[0]?.message || "Kiritilgan ma'lumot noto'g'ri.";
  console.error("Bot xatosi", (e as Error)?.message ?? e);
  return "Xatolik yuz berdi. Birozdan so'ng qayta urinib ko'ring yoki /menyu ni bosing.";
}

async function makeCtx(user: BotUser, chatId: number, origin: string, cb?: { id: string; msgId: number }) {
  return createCtx({ userId: user.id, chatId, origin, name: (user.name ?? "").split(" ")[0], state: await loadState(user.id), cb });
}

/** Foydalanuvchini Telegram identifikatori bo'yicha topadi (faqat telefon tasdiqlangan, bloklanmagan). null: ro'yxatdan o'tmagan. */
export async function botUser(from: TgUser): Promise<(BotUser & { phone: string | null }) | null> {
  const u = await db.user.findUnique({ where: { telegramId: String(from.id) }, select: { id: true, name: true, phone: true, deletedAt: true, profile: { select: { onboardedAt: true } } } });
  if (!u || u.deletedAt) return null;
  return { id: u.id, name: u.name, phone: u.phone, onboarded: !!u.profile?.onboardedAt };
}

/** Menyu tugmasi yoki buyruq: bo'limni ochadi. Matn kutayotgan holat bekor bo'ladi. */
async function openSection(ctx: Ctx, sec: Sec) {
  if (sec !== "a") await ctx.idle();
  await ENTRY[sec](ctx);
}

/** Bosh menyuni (pastdagi tugmalar bilan) ko'rsatadi va bosh sahifani ochadi. /start dan keyin ishlatiladi. */
export async function showMenuAndHome(user: BotUser, chatId: number, origin: string) {
  await sendScreen(chatId, { text: "Pastdagi menyudan bo'lim tanlang. Adashib qolsangiz: /menyu" }, { reply_markup: MENU_MARKUP });
  await openSection(await makeCtx(user, chatId, origin), "h");
}

export async function routeMessage(msg: TgMessage, user: BotUser, origin: string) {
  const ctx = await makeCtx(user, msg.chat.id, origin);
  try {
    // Ro'yxatdan o'tish tugamaguncha boshqa bo'limlar yopiq: faqat ism, viloyat va tuman so'raladi.
    if (!user.onboarded) {
      // Menyu tugmasi yoki buyruq ism/tuman deb qabul qilinmaydi: joriy bosqich qayta so'raladi.
      const plain = !!msg.text && !msg.text.startsWith("/") && !SECTION_BY_TEXT.has(msg.text.trim());
      const handled = plain && ctx.state.mode.startsWith("o.") ? await profile.onboardText(ctx, ctx.state.mode, msg.text!) : false;
      if (!handled) await profile.resumeOnboarding(ctx);
      return;
    }
    if (msg.document) return await library.onFile(ctx, msg.document);
    const text = (msg.text ?? "").trim();
    if (!text) { await ctx.say("Hozircha faqat matn va hujjat fayllarini qabul qilaman. /menyu"); return; }

    const sec = SECTION_BY_TEXT.get(text);
    if (sec) return await openSection(ctx, sec);

    if (text.startsWith("/")) {
      const cmd = text.slice(1).split(/\s+/)[0].split("@")[0].toLowerCase();
      const s = SECTION_BY_COMMAND.get(cmd);
      if (s) return await openSection(ctx, s);
      if (cmd === "yordam" || cmd === "help") { await ctx.idle(); await ctx.say({ text: HELP, kb: [nav()] }); return; }
      if (cmd === "yangi") { await ai.onCb(ctx, ["new"]); return; }
      if (cmd === "limit") { await ctx.say(await ai.limitLine(ctx.userId)); return; }
      await ctx.say("Bunday buyruq yo'q. /menyu ni bosing.");
      return;
    }

    const mode = ctx.state.mode;
    if (mode !== "idle") {
      for (const [prefix, fn] of TEXT) if (mode === prefix || mode.startsWith(prefix)) { if (await fn(ctx, mode, text)) return; }
    }
    // Hech qaysi bo'lim kutmayotgan matn: AI'ga ketmaydi, yo'l ko'rsatiladi.
    await sendScreen(msg.chat.id, { text: `Tushunmadim 🙂 Pastdagi menyudan bo'lim tanlang.\nSavol bermoqchi bo'lsangiz: «🤖 AI yordamchi».` }, { reply_markup: MENU_MARKUP });
  } catch (e) {
    await ctx.say(`⚠️ ${esc(errorText(e))}`);
  }
}

export async function routeCallback(cb: TgCallback, user: BotUser, origin: string) {
  const chatId = cb.message?.chat.id;
  if (!chatId || !cb.message) { await answerCallback(cb.id); return; }
  const ctx = await makeCtx(user, chatId, origin, { id: cb.id, msgId: cb.message.message_id });
  try {
    const parts = (cb.data ?? "").split(".");
    const sec = parts[0];
    if (sec === "x") return;
    if (!user.onboarded && sec !== "o") { await profile.resumeOnboarding(ctx); return; }
    if (sec === "h" && parts.length === 1) { await home.entry(ctx); return; }
    const fn = CB[sec];
    if (!fn) { await home.entry(ctx); return; }
    await fn(ctx, parts.slice(1));
  } catch (e) {
    const t = errorText(e);
    // Tugmaga allaqachon javob berilgan bo'lsa (masalan "Tayyorlanmoqda…"), xato yangi xabar bo'lib chiqadi: yo'qolib qolmasin.
    if (!ctx.answered() && t.length <= 190) await ctx.toast(t, true); else await ctx.say(`⚠️ ${esc(t)}`);
  } finally {
    if (!ctx.answered()) await answerCallback(cb.id);
  }
}

export type { Sec };
