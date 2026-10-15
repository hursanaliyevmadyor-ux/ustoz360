import { randomBytes, timingSafeEqual } from "node:crypto";
import { ApiError, signValue, startSession, upsertTelegramUser } from "./auth";
import { saveExchange } from "./ai/chats";
import { freeUsageToday, runFreeAi } from "./ai/gateway";
import { db } from "./db";
import { landingPath } from "./onboarding";

const API = "https://api.telegram.org";
const LOGIN_TTL_MS = 10 * 60_000;
const CHAT_IDLE_MS = 30 * 60_000;

export const botConfigured = () => Boolean(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_BOT_USERNAME);
/** Webhook sirini alohida o'zgaruvchi kerak bo'lmasligi uchun AUTH_SECRET'dan hosil qilamiz (Telegram faqat A-Z a-z 0-9 _ - ruxsat beradi). */
export const webhookSecret = () => signValue("telegram-webhook").slice(0, 48);

async function api<T = { ok: boolean; result?: unknown; description?: string }>(method: string, body?: unknown): Promise<T> {
  const res = await fetch(`${API}/bot${process.env.TELEGRAM_BOT_TOKEN}/${method}`, {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body ?? {}), signal: AbortSignal.timeout(10_000),
  });
  return (await res.json().catch(() => ({ ok: false }))) as T;
}

export async function sendText(chatId: number | string, text: string, replyMarkup?: unknown) {
  const chunks = text.match(/[\s\S]{1,4000}/g) ?? [""];
  for (let i = 0; i < chunks.length; i++) {
    await api("sendMessage", { chat_id: chatId, text: chunks[i], disable_web_page_preview: true, ...(i === chunks.length - 1 && replyMarkup ? { reply_markup: replyMarkup } : {}) });
  }
}

const COMMANDS = [
  { command: "start", description: "Boshlash va ro'yxatdan o'tish" },
  { command: "yangi", description: "Yangi suhbat boshlash" },
  { command: "limit", description: "Bugungi AI limitim" },
  { command: "yordam", description: "Yordam" },
];
let hookReady = false;

/** Webhook'ni (va bot buyruqlarini) o'zi ro'yxatdan o'tkazadi: qo'lda sozlash shart emas. Har bir server nusxasida bir marta ishlaydi. */
export async function ensureWebhook(origin: string): Promise<boolean> {
  if (!botConfigured()) return false;
  if (hookReady) return true;
  const url = `${origin}/api/telegram/webhook`;
  try {
    const r = await api("setWebhook", { url, secret_token: webhookSecret(), allowed_updates: ["message"] });
    if (!r.ok) { console.error("Telegram setWebhook xato:", r.description); return false; }
    await api("setMyCommands", { commands: COMMANDS });
    hookReady = true; return true;
  } catch (e) { console.error("Telegram webhook ulanmadi", (e as Error).message); return false; }
}

// ---------- Saytdan kirish ----------

/** Sayt "Telegram" tugmasi bosilganda: bir martalik havola va brauzer uchun maxfiy kalit beradi. */
export async function createTelegramLogin(origin: string) {
  if (!botConfigured()) throw new ApiError(503, "Telegram orqali kirish hali sozlanmagan.", "telegram_not_configured");
  if (!(await ensureWebhook(origin))) throw new ApiError(502, "Telegram botga ulanib bo'lmadi. Birozdan so'ng qayta urinib ko'ring.", "telegram_unavailable");
  const recent = await db.telegramLogin.count({ where: { createdAt: { gt: new Date(Date.now() - LOGIN_TTL_MS) } } });
  if (recent > 300) throw new ApiError(429, "Hozir juda ko'p so'rov. Birozdan so'ng qayta urinib ko'ring.", "rate_limited");
  await db.telegramLogin.deleteMany({ where: { createdAt: { lt: new Date(Date.now() - 24 * 3_600_000) } } }).catch(() => {});
  const code = randomBytes(18).toString("base64url");
  const pollSecret = randomBytes(24).toString("base64url");
  const row = await db.telegramLogin.create({ data: { code, pollHash: signValue(`tgpoll:${pollSecret}`), expiresAt: new Date(Date.now() + LOGIN_TTL_MS) } });
  return { url: `https://t.me/${process.env.TELEGRAM_BOT_USERNAME}?start=l_${code}`, pollKey: `${row.id}.${pollSecret}` };
}

export type PollResult = { status: "pending" } | { status: "expired" } | { status: "ok"; next: string };

/** Brauzer har 2 soniyada so'raydi: bot tasdiqlagan bo'lsa, sessiya ochiladi (bir marta). */
export async function pollTelegramLogin(pollKey: string): Promise<PollResult> {
  const [id, secret] = pollKey.split(".");
  if (!id || !secret) return { status: "expired" };
  const row = await db.telegramLogin.findUnique({ where: { id } });
  if (!row) return { status: "expired" };
  const given = Buffer.from(signValue(`tgpoll:${secret}`)), real = Buffer.from(row.pollHash);
  if (given.length !== real.length || !timingSafeEqual(given, real)) return { status: "expired" };
  if (row.consumedAt || row.expiresAt < new Date()) return { status: "expired" };
  if (!row.confirmedAt || !row.userId) return { status: "pending" };
  const claimed = await db.telegramLogin.updateMany({ where: { id, consumedAt: null }, data: { consumedAt: new Date() } });
  if (claimed.count === 0) return { status: "expired" };
  await startSession(row.userId);
  await db.auditLog.create({ data: { userId: row.userId, action: "auth.login_telegram_bot" } });
  return { status: "ok", next: await landingPath(row.userId) };
}

// ---------- Bot ----------

type TgUser = { id: number; is_bot?: boolean; first_name?: string; last_name?: string; username?: string };
type TgMessage = { chat: { id: number; type: string }; from?: TgUser; text?: string };
export type TgUpdate = { update_id: number; message?: TgMessage };

const HELP = [
  "Men USTOZ 360 yordamchisiman. Sayt bilan bir xil akkaunt va bir xil AI.",
  "",
  "Shunchaki savolingizni yozing: dars rejasi, test savollari, mavzuni tushuntirish va boshqalar.",
  "",
  "/yangi: yangi suhbat boshlash",
  "/limit: bugungi AI limitim",
  "/yordam: shu xabar",
].join("\n");

const siteButton = (origin: string, text = "Saytga qaytish") => ({ inline_keyboard: [[{ text, url: origin }]] });

async function currentChat(userId: string) {
  return db.aiChat.findFirst({
    where: { userId, model: "telegram", updatedAt: { gt: new Date(Date.now() - CHAT_IDLE_MS) } },
    orderBy: { updatedAt: "desc" },
    select: { id: true, messages: { orderBy: { createdAt: "desc" }, take: 18, select: { role: true, content: true } } },
  });
}

async function handleStart(msg: TgMessage, from: TgUser, param: string, origin: string) {
  const { user, isNew } = await upsertTelegramUser({ id: String(from.id), first_name: from.first_name, last_name: from.last_name, username: from.username });
  const name = user.name ?? from.first_name ?? "";
  if (param.startsWith("l_")) {
    const row = await db.telegramLogin.findUnique({ where: { code: param.slice(2) } });
    if (!row || row.consumedAt || row.expiresAt < new Date()) {
      await sendText(msg.chat.id, "Bu kirish havolasi eskirgan. Saytda «Telegram» tugmasini qayta bosing.", siteButton(origin, "Saytni ochish"));
      return;
    }
    if (!row.confirmedAt) await db.telegramLogin.update({ where: { id: row.id }, data: { userId: user.id, confirmedAt: new Date() } });
    await sendText(msg.chat.id, isNew
      ? "🎉 Tabriklaymiz, ro'yxatdan o'tdingiz!\n\nEndi saytga qaytishingiz mumkin. Saytda ism-familiya va yashash joyingizni kiritib, ro'yxatdan o'tishni yakunlaysiz.\n\nBu botda ham xuddi sayt kabi AI yordamchidan foydalanishingiz mumkin: savolingizni yozing."
      : `✅ Xush kelibsiz${name ? `, ${name}` : ""}! Saytga kirish tasdiqlandi, saytga qaytishingiz mumkin.\n\nBu botda ham AI yordamchidan foydalanishingiz mumkin: savolingizni yozing.`, siteButton(origin));
    return;
  }
  await sendText(msg.chat.id, `${isNew ? "🎉 Tabriklaymiz, ro'yxatdan o'tdingiz!\n\n" : `Salom${name ? `, ${name}` : ""}!\n\n`}${HELP}`, siteButton(origin, "Saytni ochish"));
}

async function handleAi(msg: TgMessage, from: TgUser, text: string) {
  const user = await db.user.findUnique({ where: { telegramId: String(from.id) } });
  if (!user || user.deletedAt) { await sendText(msg.chat.id, "Boshlash uchun /start ni bosing."); return; }
  void api("sendChatAction", { chat_id: msg.chat.id, action: "typing" }).catch(() => {});
  const chat = await currentChat(user.id);
  const history = (chat?.messages ?? []).slice().reverse().map((m) => ({ role: m.role as "user" | "assistant", content: m.content.slice(0, 4000) }));
  const messages = [...history, { role: "user" as const, content: text.slice(0, 4000) }].slice(-20);
  try {
    const r = await runFreeAi(user.id, messages);
    await saveExchange(user.id, chat?.id, "telegram", text.slice(0, 4000), r.text);
    await sendText(msg.chat.id, r.text);
  } catch (e) {
    if (e instanceof ApiError) await sendText(msg.chat.id, e.message);
    else { console.error("Bot AI xato", (e as Error).message); await sendText(msg.chat.id, "Xatolik yuz berdi. Birozdan so'ng qayta urinib ko'ring."); }
  }
}

/** Telegram'dan kelgan bitta yangilanishni qayta ishlaydi. Bir xil update_id ikkinchi marta kelsa e'tiborga olinmaydi. */
export async function handleUpdate(update: TgUpdate, origin: string) {
  try { await db.telegramUpdate.create({ data: { id: String(update.update_id) } }); }
  catch (e) { if ((e as { code?: string }).code === "P2002") return; throw e; }
  if (Math.random() < 0.02) await db.telegramUpdate.deleteMany({ where: { createdAt: { lt: new Date(Date.now() - 2 * 86_400_000) } } }).catch(() => {});

  const msg = update.message, from = msg?.from;
  if (!msg || !from || from.is_bot || msg.chat.type !== "private") return;
  const text = (msg.text ?? "").trim();
  if (!text) { await sendText(msg.chat.id, "Hozircha faqat matnli savollarga javob bera olaman."); return; }

  const [cmdRaw, ...rest] = text.split(/\s+/);
  const cmd = cmdRaw.startsWith("/") ? cmdRaw.slice(1).split("@")[0].toLowerCase() : "";
  if (cmd === "start") return handleStart(msg, from, rest[0] ?? "", origin);
  if (cmd === "yordam" || cmd === "help") { await sendText(msg.chat.id, HELP, siteButton(origin, "Saytni ochish")); return; }
  if (cmd === "yangi") {
    const user = await db.user.findUnique({ where: { telegramId: String(from.id) } });
    const chat = user ? await currentChat(user.id) : null;
    // Joriy suhbatni "eskirgan" qilamiz: keyingi savol yangi suhbat ochadi (tarix saytda saqlanib qoladi).
    if (chat) await db.aiChat.update({ where: { id: chat.id }, data: { updatedAt: new Date(Date.now() - CHAT_IDLE_MS - 60_000) } });
    await sendText(msg.chat.id, "Yangi suhbat boshlandi. Savolingizni yozing.");
    return;
  }
  if (cmd === "limit") {
    const user = await db.user.findUnique({ where: { telegramId: String(from.id) } });
    if (!user) { await sendText(msg.chat.id, "Boshlash uchun /start ni bosing."); return; }
    const u = await freeUsageToday(user.id);
    await sendText(msg.chat.id, `Bugun qolgan AI so'rovlari: ${u.remaining} / ${u.limit}`);
    return;
  }
  if (cmd) { await sendText(msg.chat.id, "Bunday buyruq yo'q. /yordam ni bosing."); return; }
  await handleAi(msg, from, text);
}
