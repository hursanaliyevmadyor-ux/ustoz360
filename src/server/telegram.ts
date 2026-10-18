import { randomBytes, timingSafeEqual } from "node:crypto";
import { ApiError, signValue, startSession, upsertTelegramUser } from "./auth";
import { botUser, routeCallback, routeMessage, showMenuAndHome, type BotUser } from "./bot/router";
import { api, link, sendPlain, sendScreen, type Btn, type TgContact, type TgMessage, type TgUpdate, type TgUser } from "./bot/tg";
import { createCtx, loadState } from "./bot/ctx";
import { resumeOnboarding } from "./bot/sections/profile";
import { db } from "./db";
import { landingPath } from "./onboarding";

export type { TgUpdate };
const LOGIN_TTL_MS = 10 * 60_000;

export const botConfigured = () => Boolean(process.env.TELEGRAM_BOT_TOKEN && botUsername());
/** Bot nomi "@" bilan yozilgan bo'lsa ham to'g'ri havola chiqishi uchun "@" va bo'shliqlar olib tashlanadi. */
export const botUsername = () => (process.env.TELEGRAM_BOT_USERNAME ?? "").trim().replace(/^@+/, "");
/** Webhook sirini alohida o'zgaruvchi kerak bo'lmasligi uchun AUTH_SECRET'dan hosil qilamiz (Telegram faqat A-Z a-z 0-9 _ - ruxsat beradi). */
export const webhookSecret = () => signValue("telegram-webhook").slice(0, 48);

/** Oddiy matn yuborish (tashqi modullar va eski chaqiruvlar uchun). */
export const sendText = (chatId: number | string, text: string, replyMarkup?: unknown) => sendPlain(chatId, text, undefined, replyMarkup);

/** Telegram "Menu" ro'yxati (yozish maydoni yonidagi tugma). */
const COMMANDS = [
  { command: "menyu", description: "Asosiy menyu" },
  { command: "bosh", description: "Bosh sahifa" },
  { command: "testlar", description: "Testlar" },
  { command: "reja", description: "TOIFA reja" },
  { command: "sinflar", description: "Sinflarim" },
  { command: "darsyor", description: "DARSYOR: dars ishlanmasi" },
  { command: "kutubxona", description: "Kutubxona" },
  { command: "kurslar", description: "Kurslar va obuna" },
  { command: "seminarlar", description: "Seminarlar" },
  { command: "ai", description: "AI yordamchi" },
  { command: "profil", description: "Profil va sozlamalar" },
  { command: "yordam", description: "Yordam" },
];
let hookReady = false;

/** Webhook'ni (va bot buyruqlarini) o'zi ro'yxatdan o'tkazadi: qo'lda sozlash shart emas. Har bir server nusxasida bir marta ishlaydi. */
export async function ensureWebhook(origin: string): Promise<boolean> {
  if (!botConfigured()) return false;
  if (hookReady) return true;
  const url = `${origin}/api/telegram/webhook`;
  try {
    const r = await api("setWebhook", { url, secret_token: webhookSecret(), allowed_updates: ["message", "callback_query"] });
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
  return { url: `https://t.me/${botUsername()}?start=l_${code}`, pollKey: `${row.id}.${pollSecret}` };
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

// ---------- Boshlash va ro'yxatdan o'tish (telefon) ----------

const siteButton = (origin: string, text = "Saytga qaytish"): Btn[][] => [[link(text, origin)]];

/** Pastdagi menyudagi "raqamni yuborish" tugmasi: bosilganda Telegram o'zi tasdiqlashni so'raydi va faqat foydalanuvchining O'Z raqamini yuboradi. */
const phoneKeyboard = { keyboard: [[{ text: "📱 Telefon raqamni yuborish", request_contact: true }]], resize_keyboard: true, one_time_keyboard: true, input_field_placeholder: "Pastdagi tugmani bosing" };
const removeKeyboard = { remove_keyboard: true };
const ASK_PHONE = "Ro'yxatdan o'tish uchun pastdagi «📱 Telefon raqamni yuborish» tugmasini bosing. Telegram sizdan tasdiqlashni so'raydi; tasdiqlasangiz, shu raqam bilan ro'yxatdan o'tasiz.";

/** "+998 90 123-45-67" kabi yozuvni "+998901234567" ga keltiradi; noto'g'ri bo'lsa null. */
export const normalizePhone = (raw: string) => { const d = raw.replace(/\D/g, ""); return d.length >= 9 && d.length <= 15 ? `+${d}` : null; };

const identity = (from: TgUser) => ({ id: String(from.id), first_name: from.first_name, last_name: from.last_name, username: from.username });

/** Telefon tasdiqlangan foydalanuvchi uchun: ro'yxatdan o'tish tugamagan bo'lsa ism-viloyat-tuman so'raladi, aks holda menyu va bosh sahifa. */
async function afterRegistration(user: BotUser, chatId: number, origin: string) {
  if (!user.onboarded) {
    const ctx = createCtx({ userId: user.id, chatId, origin, name: (user.name ?? "").split(" ")[0], state: await loadState(user.id) });
    await resumeOnboarding(ctx);
    return;
  }
  await showMenuAndHome(user, chatId, origin);
}

async function handleStart(msg: TgMessage, from: TgUser, param: string, origin: string) {
  const existing = await db.user.findUnique({ where: { telegramId: String(from.id) } });
  const registered = !!existing && !existing.deletedAt && !!existing.phone;

  let row = null;
  if (param.startsWith("l_")) {
    row = await db.telegramLogin.findUnique({ where: { code: param.slice(2) } });
    if (!row || row.consumedAt || row.expiresAt < new Date()) {
      await sendScreen(msg.chat.id, { text: "Bu kirish havolasi eskirgan. Saytda «Telegram» tugmasini qayta bosing.", kb: siteButton(origin, "Saytni ochish") });
      return;
    }
  }

  // Raqami hali tasdiqlanmagan: ro'yxatdan o'tish uchun telefon raqam so'raymiz. Sayt kirishi raqam kelgandan keyin tasdiqlanadi.
  if (!registered) {
    if (row) await db.telegramLogin.update({ where: { id: row.id }, data: { telegramId: String(from.id) } });
    await sendPlain(msg.chat.id, `👋 Salom${from.first_name ? `, ${from.first_name}` : ""}!\n\n${ASK_PHONE}`, undefined, phoneKeyboard);
    return;
  }

  const { user } = await upsertTelegramUser(identity(from));
  const bu = await botUser(from);
  const name = user.name ?? from.first_name ?? "";
  if (row) {
    if (!row.confirmedAt) await db.telegramLogin.update({ where: { id: row.id }, data: { userId: user.id, confirmedAt: new Date() } });
    await sendScreen(msg.chat.id, { text: `✅ Xush kelibsiz${name ? `, ${name}` : ""}! Saytga kirish tasdiqlandi, saytga qaytishingiz mumkin.\n\nBotning o'zida ham hamma bo'lim ishlaydi: pastdagi menyudan tanlang.`, kb: siteButton(origin) });
  }
  if (bu) await afterRegistration(bu, msg.chat.id, origin);
}

/** Foydalanuvchi "raqamni yuborish" tugmasini bosib, Telegram'da tasdiqlagandan keyin keladi: shu raqam bilan ro'yxatdan o'tkazamiz. */
async function handleContact(msg: TgMessage, from: TgUser, contact: TgContact, origin: string) {
  // Boshqa odamning kontaktini yuborib qo'ygan bo'lsa (tugmasiz) qabul qilmaymiz.
  if (contact.user_id !== from.id) { await sendPlain(msg.chat.id, "Iltimos, o'zingizning raqamingizni pastdagi tugma orqali yuboring.", undefined, phoneKeyboard); return; }
  const phone = normalizePhone(contact.phone_number);
  if (!phone) { await sendPlain(msg.chat.id, "Raqam noto'g'ri ko'rinyapti. Pastdagi tugma orqali qayta yuboring.", undefined, phoneKeyboard); return; }

  const { user } = await upsertTelegramUser(identity(from));
  if (user.phone !== phone) {
    try { await db.user.update({ where: { id: user.id }, data: { phone } }); }
    catch (e) {
      if ((e as { code?: string }).code === "P2002") { await sendPlain(msg.chat.id, "Bu telefon raqami boshqa akkauntga bog'langan. Yordam kerak bo'lsa, sayt administratoriga murojaat qiling.", undefined, removeKeyboard); return; }
      throw e;
    }
  }
  await db.auditLog.create({ data: { userId: user.id, action: "auth.telegram_phone" } });

  const row = await db.telegramLogin.findFirst({ where: { telegramId: String(from.id), confirmedAt: null, consumedAt: null, expiresAt: { gt: new Date() } }, orderBy: { createdAt: "desc" } });
  if (row) await db.telegramLogin.update({ where: { id: row.id }, data: { userId: user.id, confirmedAt: new Date() } });

  await sendPlain(msg.chat.id, "✅ Raqamingiz qabul qilindi.", undefined, removeKeyboard);
  await sendScreen(msg.chat.id, { text: row ? "🎉 Tabriklaymiz, ro'yxatdan o'tdingiz! Saytga kirish tasdiqlandi, saytga qaytishingiz mumkin." : "🎉 Tabriklaymiz, ro'yxatdan o'tdingiz!", kb: row ? siteButton(origin) : undefined });
  const bu = await botUser(from);
  if (bu) await afterRegistration(bu, msg.chat.id, origin);
}

/** Telegram'dan kelgan bitta yangilanishni qayta ishlaydi. Bir xil update_id ikkinchi marta kelsa e'tiborga olinmaydi. */
export async function handleUpdate(update: TgUpdate, origin: string) {
  try { await db.telegramUpdate.create({ data: { id: String(update.update_id) } }); }
  catch (e) { if ((e as { code?: string }).code === "P2002") return; throw e; }
  if (Math.random() < 0.02) await db.telegramUpdate.deleteMany({ where: { createdAt: { lt: new Date(Date.now() - 2 * 86_400_000) } } }).catch(() => {});

  const cb = update.callback_query;
  if (cb) {
    if (cb.from.is_bot || cb.message?.chat.type !== "private") return;
    const user = await botUser(cb.from);
    if (!user) { await api("answerCallbackQuery", { callback_query_id: cb.id, text: "Boshlash uchun /start ni bosing.", show_alert: true }); return; }
    await routeCallback(cb, user, origin);
    return;
  }

  const msg = update.message, from = msg?.from;
  if (!msg || !from || from.is_bot || msg.chat.type !== "private") return;
  try {
    if (msg.contact) return await handleContact(msg, from, msg.contact, origin);
    const text = (msg.text ?? "").trim();
    const [cmdRaw, ...rest] = text.split(/\s+/);
    if (cmdRaw.startsWith("/") && cmdRaw.slice(1).split("@")[0].toLowerCase() === "start") return await handleStart(msg, from, rest[0] ?? "", origin);

    const user = await botUser(from);
    if (!user) { await sendPlain(msg.chat.id, "Boshlash uchun /start ni bosing."); return; }
    if (!user.phone) { await sendPlain(msg.chat.id, ASK_PHONE, undefined, phoneKeyboard); return; }
    await routeMessage(msg, user, origin);
  } catch (e) {
    if (e instanceof ApiError) await sendPlain(msg.chat.id, e.message);
    else {
      // Foydalanuvchi jim qolmasin: xato yozib qo'yiladi, unga esa umumiy xabar boradi.
      console.error("Telegram xabarini qayta ishlashda xato", (e as Error).message);
      await sendPlain(msg.chat.id, "Xatolik yuz berdi. Birozdan so'ng qayta urinib ko'ring yoki /menyu ni bosing.").catch(() => undefined);
    }
  }
}
