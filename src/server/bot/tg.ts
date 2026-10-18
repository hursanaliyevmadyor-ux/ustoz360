import { cbOk } from "./botlogic";

/** Telegram Bot API bilan ishlash qatlami: yuborish, tahrirlash, tugmalar, fayl olish. Biznes mantiq bu yerda yo'q. */
/** TELEGRAM_API_BASE faqat mahalliy sinov uchun (soxta Telegram serveriga yo'naltirish); ishlab chiqarishda o'rnatilmaydi. */
const API = process.env.TELEGRAM_API_BASE?.replace(/\/+$/, "") || "https://api.telegram.org";

export type TgResult<T = unknown> = { ok: boolean; result?: T; description?: string; error_code?: number };

/** Webhook orqali keladigan yangilanish turlari (faqat bot ishlatadigan maydonlar). */
export type TgUser = { id: number; is_bot?: boolean; first_name?: string; last_name?: string; username?: string };
export type TgContact = { phone_number: string; user_id?: number };
export type TgDocument = { file_id: string; file_name?: string; file_size?: number; mime_type?: string };
export type TgChat = { id: number; type: string };
export type TgMessage = { message_id?: number; chat: TgChat; from?: TgUser; text?: string; contact?: TgContact; document?: TgDocument };
export type TgCallback = { id: string; from: TgUser; message?: { message_id: number; chat: TgChat }; data?: string };
export type TgUpdate = { update_id: number; message?: TgMessage; callback_query?: TgCallback };
/** Tugma: callback (data), oddiy havola (url) yoki Telegram ichida ochiladigan Mini App (web). */
export type Btn = { text: string; data?: string; url?: string; web?: string };
/** Bitta ekran: HTML matn va ixtiyoriy tugmalar qatorlari. */
export type Screen = { text: string; kb?: Btn[][] };

export async function api<T = unknown>(method: string, body?: unknown, timeoutMs = 10_000): Promise<TgResult<T>> {
  const res = await fetch(`${API}/bot${process.env.TELEGRAM_BOT_TOKEN}/${method}`, {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body ?? {}), signal: AbortSignal.timeout(timeoutMs),
  });
  return (await res.json().catch(() => ({ ok: false }))) as TgResult<T>;
}

export const b = (text: string, data: string): Btn => ({ text, data });
export const link = (text: string, url: string): Btn => ({ text, url });
/** Mini App tugmasi: sayt Telegram ichida ochiladi (faqat https va faqat shaxsiy chatda ishlaydi). */
export const webApp = (text: string, url: string): Btn => ({ text, web: url });

/** Ichki tugmalar (xabar ostida). callback_data 64 baytdan oshsa xato: bu dasturlash xatosi, shuning uchun darhol aniqlanadi. */
export function inline(kb: Btn[][] | undefined) {
  if (!kb?.length) return undefined;
  return {
    inline_keyboard: kb.filter((row) => row.length).map((row) => row.map((x) => {
      if (x.url) return { text: x.text, url: x.url };
      if (x.web) return { text: x.text, web_app: { url: x.web } };
      if (!x.data || !cbOk(x.data)) throw new Error(`callback_data noto'g'ri: ${x.data}`);
      return { text: x.text, callback_data: x.data };
    })),
  };
}

const stripTags = (s: string) => s.replace(/<\/?[a-z][^>]*>/gi, "").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
const isParseError = (r: TgResult) => !r.ok && /parse entities|can't parse/i.test(r.description ?? "");

/** Yangi xabar. HTML tahlil xatosi bo'lsa, teglarsiz oddiy matn bilan qayta yuboriladi (xabar yo'qolmasin). Qaytaradi: message_id. */
export async function sendScreen(chatId: number | string, s: Screen, extra: Record<string, unknown> = {}): Promise<number | null> {
  const base = { chat_id: chatId, disable_web_page_preview: true, reply_markup: inline(s.kb), ...extra };
  let r = await api<{ message_id: number }>("sendMessage", { ...base, text: s.text.slice(0, 4096), parse_mode: "HTML" });
  if (isParseError(r)) r = await api<{ message_id: number }>("sendMessage", { ...base, text: stripTags(s.text).slice(0, 4096) });
  if (!r.ok) console.error("Telegram sendMessage xato:", r.description);
  return r.result?.message_id ?? null;
}

/** Oddiy matn (AI javobi va boshqalar): HTML tahlil qilinmaydi. Uzun matn bo'laklanadi, tugmalar oxirgisiga qo'shiladi. */
export async function sendPlain(chatId: number | string, text: string, kb?: Btn[][], reply?: unknown) {
  const chunks = text.match(/[\s\S]{1,4000}/g) ?? [""];
  for (let i = 0; i < chunks.length; i++) {
    const last = i === chunks.length - 1;
    await api("sendMessage", { chat_id: chatId, text: chunks[i], disable_web_page_preview: true, ...(last && kb ? { reply_markup: inline(kb) } : last && reply ? { reply_markup: reply } : {}) });
  }
}

/**
 * Mavjud xabarni yangilaydi (tugma bosilganda): chat toza qoladi, foydalanuvchi adashmaydi.
 * O'zgarmagan bo'lsa jim o'tadi; xabar eskirgan/o'chirilgan bo'lsa yangi xabar yuboriladi.
 */
export async function editScreen(chatId: number | string, messageId: number, s: Screen): Promise<void> {
  const base = { chat_id: chatId, message_id: messageId, disable_web_page_preview: true, reply_markup: inline(s.kb) ?? { inline_keyboard: [] } };
  let r = await api("editMessageText", { ...base, text: s.text.slice(0, 4096), parse_mode: "HTML" });
  if (isParseError(r)) r = await api("editMessageText", { ...base, text: stripTags(s.text).slice(0, 4096) });
  if (r.ok || /not modified/i.test(r.description ?? "")) return;
  await sendScreen(chatId, s);
}

export const answerCallback = (id: string, text?: string, alert = false) => api("answerCallbackQuery", { callback_query_id: id, ...(text ? { text: text.slice(0, 190), show_alert: alert } : {}) }).catch(() => undefined);
export const typing = (chatId: number | string) => api("sendChatAction", { chat_id: chatId, action: "typing" }).catch(() => undefined);

/** Pastdagi doimiy menyu (reply keyboard). */
export const replyKeyboard = (rows: string[][], placeholder?: string) => ({
  keyboard: rows.map((r) => r.map((text) => ({ text }))), resize_keyboard: true, is_persistent: true, ...(placeholder ? { input_field_placeholder: placeholder } : {}),
});

/** Telegram'dan foydalanuvchi yuborgan faylni oladi. Hajm chegarasidan oshsa yoki olib bo'lmasa null. */
export async function downloadFile(fileId: string, maxBytes: number): Promise<Uint8Array | null> {
  const r = await api<{ file_path?: string; file_size?: number }>("getFile", { file_id: fileId });
  const path = r.result?.file_path;
  if (!r.ok || !path || (r.result?.file_size ?? 0) > maxBytes) return null;
  const res = await fetch(`${API}/file/bot${process.env.TELEGRAM_BOT_TOKEN}/${path}`, { signal: AbortSignal.timeout(20_000) });
  if (!res.ok) return null;
  const buf = new Uint8Array(await res.arrayBuffer());
  return buf.length > maxBytes ? null : buf;
}
