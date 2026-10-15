import { ApiError } from "../auth";
import { db } from "../db";

const MAX_CHATS = 100;

/**
 * Foydalanuvchi savoli va AI javobini chatga yozadi (chat yo'q bo'lsa yangisini ochadi).
 * Saqlash xato bersa (masalan jadval hali yaratilmagan) javobning o'zi yo'qolmasligi uchun xato yutiladi va null qaytadi.
 */
export async function saveExchange(userId: string, chatId: string | undefined, model: string, userText: string, reply: string): Promise<string | null> {
  try {
    if (chatId) {
      const own = await db.aiChat.findFirst({ where: { id: chatId, userId }, select: { id: true } });
      if (!own) throw new ApiError(404, "Chat topilmadi.");
      await db.aiChat.update({ where: { id: chatId }, data: { updatedAt: new Date(), messages: { create: [{ role: "user", content: userText }, { role: "assistant", content: reply }] } } });
      return chatId;
    }
    const chat = await db.aiChat.create({
      data: { userId, model, title: userText.replace(/\s+/g, " ").trim().slice(0, 60) || "Yangi chat", messages: { create: [{ role: "user", content: userText }, { role: "assistant", content: reply }] } },
      select: { id: true },
    });
    const old = await db.aiChat.findMany({ where: { userId }, orderBy: { updatedAt: "desc" }, skip: MAX_CHATS, select: { id: true } });
    if (old.length) await db.aiChat.deleteMany({ where: { id: { in: old.map((c) => c.id) } } });
    return chat.id;
  } catch (e) {
    if (e instanceof ApiError) throw e;
    console.error("Chat saqlanmadi", (e as Error).message);
    return null;
  }
}

export async function listChats(userId: string) {
  try {
    const rows = await db.aiChat.findMany({ where: { userId }, orderBy: { updatedAt: "desc" }, take: MAX_CHATS, select: { id: true, title: true, model: true, updatedAt: true } });
    return { chats: rows, available: true };
  } catch (e) {
    console.error("Chatlar o'qilmadi", (e as Error).message);
    return { chats: [], available: false };
  }
}

export async function getChat(userId: string, id: string) {
  const chat = await db.aiChat.findFirst({ where: { id, userId }, select: { id: true, title: true, model: true, messages: { orderBy: { createdAt: "asc" }, select: { role: true, content: true } } } });
  if (!chat) throw new ApiError(404, "Chat topilmadi.");
  return chat;
}

export async function deleteChat(userId: string, id: string) {
  const r = await db.aiChat.deleteMany({ where: { id, userId } });
  if (r.count === 0) throw new ApiError(404, "Chat topilmadi.");
  return { ok: true };
}
