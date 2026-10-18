import { db } from "../db";
import { Prisma } from "@prisma/client";
import { answerCallback, editScreen, sendPlain, sendScreen, type Screen } from "./tg";

/** Suhbat holati: bot foydalanuvchidan keyingi matnni kutayotgan bo'lsa, shu yerda saqlanadi (masalan reja bandi nomi). */
export type State = { mode: string; data: Record<string, unknown>; remind: boolean };
export const IDLE: State = { mode: "idle", data: {}, remind: true };
/** Kutilayotgan amal shu muddatdan keyin bekor bo'ladi: unutilgan so'rov keyingi xabarni yutib yubormasin. */
const MODE_TTL_MS = 45 * 60_000;

/** Holatni o'qiydi. Jadval bo'lmasa yoki xato bo'lsa bot ishdan chiqmaydi: oddiy holat qaytadi. */
export async function loadState(userId: string): Promise<State> {
  try {
    const r = await db.botState.findUnique({ where: { userId } });
    if (!r) return { ...IDLE, data: {} };
    const fresh = Date.now() - r.updatedAt.getTime() < MODE_TTL_MS;
    return { mode: fresh ? r.mode : "idle", data: fresh && r.data && typeof r.data === "object" && !Array.isArray(r.data) ? (r.data as Record<string, unknown>) : {}, remind: r.remind };
  } catch (e) { console.error("BotState o'qilmadi", (e as Error).message); return { ...IDLE, data: {} }; }
}

export async function saveMode(userId: string, mode: string, data: Record<string, unknown> = {}) {
  const json = data as Prisma.InputJsonValue;
  try { await db.botState.upsert({ where: { userId }, create: { userId, mode, data: json }, update: { mode, data: json } }); }
  catch (e) { console.error("BotState yozilmadi", (e as Error).message); }
}

export async function saveRemind(userId: string, remind: boolean) {
  try { await db.botState.upsert({ where: { userId }, create: { userId, remind }, update: { remind } }); }
  catch (e) { console.error("BotState yozilmadi", (e as Error).message); }
}

/** Har bir tugma/xabar ishlovchisiga beriladigan muhit. Ishlovchilar Telegram tafsilotini bilmaydi. */
export type Ctx = {
  userId: string; chatId: number; origin: string; name: string;
  /** Tugma bosilgan bo'lsa: shu xabarni tahrirlaymiz. */
  cb?: { id: string; msgId: number };
  state: State;
  /** Tugma bosilganda xabarni yangilaydi, oddiy xabarga javob sifatida yangi xabar yuboradi. */
  show(s: Screen): Promise<void>;
  /** Doim yangi xabar. Matn berilsa HTML deb olinadi. */
  say(s: Screen | string): Promise<void>;
  /** Oddiy matn (AI javobi kabi): HTML tahlil qilinmaydi. */
  plain(text: string, kb?: Screen["kb"]): Promise<void>;
  /** Tugma bosilganda yuqorida qisqa xabar (toast yoki ogohlantirish). */
  toast(text?: string, alert?: boolean): Promise<void>;
  /** Keyingi matn xabarini shu amal deb qabul qilish. */
  mode(mode: string, data?: Record<string, unknown>): Promise<void>;
  idle(): Promise<void>;
};

export function createCtx(base: { userId: string; chatId: number; origin: string; name: string; state: State; cb?: { id: string; msgId: number } }): Ctx & { answered: () => boolean } {
  let answered = false;
  const ctx: Ctx & { answered: () => boolean } = {
    ...base,
    answered: () => answered,
    async show(s) { if (base.cb) await editScreen(base.chatId, base.cb.msgId, s); else await sendScreen(base.chatId, s); },
    async say(s) { await sendScreen(base.chatId, typeof s === "string" ? { text: s } : s); },
    async plain(text, kb) { await sendPlain(base.chatId, text, kb); },
    async toast(text, alert = false) { if (base.cb && !answered) { answered = true; await answerCallback(base.cb.id, text, alert); } },
    async mode(mode, data = {}) { ctx.state = { ...ctx.state, mode, data }; await saveMode(base.userId, mode, data); },
    async idle() { if (ctx.state.mode !== "idle") { ctx.state = { ...ctx.state, mode: "idle", data: {} }; await saveMode(base.userId, "idle", {}); } },
  };
  return ctx;
}
