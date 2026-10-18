import { ApiError } from "../../auth";
import { db } from "../../db";
import { saveExchange } from "../../ai/chats";
import { freeConfigured, freeUsageToday, runFreeAi } from "../../ai/gateway";
import type { Ctx } from "../ctx";
import { b, typing } from "../tg";
import { heading, nav } from "../ui";

/** AI yordamchi: faqat «🤖 AI yordamchi» yoqilganda ishlaydi, shunda tasodifiy xabar AI limitini sarflamaydi. Suhbat saytdagi bilan bir xil (30 daqiqa jim turilsa, yangi suhbat). */
const CHAT_IDLE_MS = 30 * 60_000;
const AI_KB = [[b("🆕 Yangi suhbat", "a.new"), b("📊 Limit", "a.lim")], [b("🏠 Menyu", "h")]];

async function currentChat(userId: string) {
  return db.aiChat.findFirst({
    where: { userId, model: "telegram", updatedAt: { gt: new Date(Date.now() - CHAT_IDLE_MS) } },
    orderBy: { updatedAt: "desc" },
    select: { id: true, messages: { orderBy: { createdAt: "desc" }, take: 18, select: { role: true, content: true } } },
  });
}

export async function entry(ctx: Ctx) {
  if (!freeConfigured()) return ctx.show({ text: `${heading("🤖", "AI yordamchi")}\nAI hozircha ulanmagan. Administrator yoqqach ishlaydi.`, kb: [nav()] });
  await ctx.mode("ai");
  const u = await freeUsageToday(ctx.userId).catch(() => null);
  await ctx.show({
    text: `${heading("🤖", "AI yordamchi")}\nSavolingizni shu yerga yozing: dars rejasi, test savollari, mavzuni tushuntirish va boshqalar.${u ? `\n\nBugun qolgan so'rovlar: <b>${u.remaining}/${u.limit}</b>` : ""}\n\n<i>Chiqish uchun pastdagi menyudan bo'lim tanlang.</i>`,
    kb: AI_KB,
  });
}

export async function onCb(ctx: Ctx, a: string[]) {
  if (a[0] === "new") {
    const chat = await currentChat(ctx.userId);
    // Joriy suhbatni "eskirgan" qilamiz: keyingi savol yangi suhbat ochadi (tarix saytda saqlanib qoladi).
    if (chat) await db.aiChat.update({ where: { id: chat.id }, data: { updatedAt: new Date(Date.now() - CHAT_IDLE_MS - 60_000) } });
    await ctx.toast("Yangi suhbat boshlandi");
    return ctx.say("🆕 Yangi suhbat boshlandi. Savolingizni yozing.");
  }
  if (a[0] === "lim") return ctx.toast(await limitLine(ctx.userId), true);
  return entry(ctx);
}

export async function limitLine(userId: string) {
  const u = await freeUsageToday(userId);
  return `Bugun qolgan AI so'rovlari: ${u.remaining} / ${u.limit}`;
}

export async function onText(ctx: Ctx, mode: string, text: string): Promise<boolean> {
  if (mode !== "ai") return false;
  void typing(ctx.chatId);
  const chat = await currentChat(ctx.userId);
  const history = (chat?.messages ?? []).slice().reverse().map((m) => ({ role: m.role as "user" | "assistant", content: m.content.slice(0, 4000) }));
  const messages = [...history, { role: "user" as const, content: text.slice(0, 4000) }].slice(-20);
  try {
    const r = await runFreeAi(ctx.userId, messages);
    await saveExchange(ctx.userId, chat?.id, "telegram", text.slice(0, 4000), r.text);
    await ctx.plain(r.text, AI_KB);
  } catch (e) {
    if (e instanceof ApiError) await ctx.plain(e.message, AI_KB);
    else { console.error("Bot AI xato", (e as Error).message); await ctx.plain("Xatolik yuz berdi. Birozdan so'ng qayta urinib ko'ring.", AI_KB); }
  }
  return true;
}
