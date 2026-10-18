import { api } from "./bot/tg";
import { db } from "./db";
import { getSetting } from "./settings";

/** Bildirishnoma xizmati: boshqa modullar shu yerdan chaqiradi. Yuborilmasa asosiy amal buzilmaydi. */
export type NotifyInput = { kind: string; title: string; text: string; href?: string };

/** Muhim shaxsiy xabarlar (to'lov tasdig'i kabi) botga ham yuboriladi: foydalanuvchi saytga kirmasa ham ko'radi. */
const PUSH_KINDS = new Set(["payment", "market"]);

async function pushTelegram(userId: string, n: NotifyInput) {
  if (!PUSH_KINDS.has(n.kind) || !process.env.TELEGRAM_BOT_TOKEN) return;
  const u = await db.user.findUnique({ where: { id: userId }, select: { telegramId: true, deletedAt: true } });
  if (!u?.telegramId || u.deletedAt) return;
  await api("sendMessage", { chat_id: u.telegramId, text: `🔔 ${n.title}\n${n.text}`.slice(0, 1000), disable_web_page_preview: true }, 4000);
}

export async function notify(userId: string, n: NotifyInput) {
  try {
    if (!(await getSetting("notifications")).enabled) return;
    await db.notification.create({ data: { userId, kind: n.kind, title: n.title.slice(0, 120), text: n.text.slice(0, 400), href: n.href ?? null } });
  } catch (e) { console.error("notify", (e as Error).message); return; }
  await pushTelegram(userId, n).catch((e) => console.error("notify telegram", (e as Error).message));
}

/** Hamma faol foydalanuvchiga (masalan, yangi seminar e'loni). */
export async function notifyAll(n: NotifyInput, max = 5000) {
  try {
    if (!(await getSetting("notifications")).enabled) return 0;
    const users = await db.user.findMany({ where: { deletedAt: null }, select: { id: true }, take: max });
    if (!users.length) return 0;
    const r = await db.notification.createMany({ data: users.map((u) => ({ userId: u.id, kind: n.kind, title: n.title.slice(0, 120), text: n.text.slice(0, 400), href: n.href ?? null })) });
    return r.count;
  } catch (e) { console.error("notifyAll", (e as Error).message); return 0; }
}

export async function listNotifications(userId: string) {
  const [rows, unread] = await Promise.all([
    db.notification.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: 30 }),
    db.notification.count({ where: { userId, readAt: null } }),
  ]);
  return { unread, items: rows.map((r) => ({ id: r.id, kind: r.kind, title: r.title, text: r.text, href: r.href, unread: !r.readAt, createdAt: r.createdAt.toISOString() })) };
}

export async function markRead(userId: string, ids?: string[]) {
  const r = await db.notification.updateMany({ where: { userId, readAt: null, ...(ids?.length ? { id: { in: ids.slice(0, 100) } } : {}) }, data: { readAt: new Date() } });
  return { updated: r.count };
}
