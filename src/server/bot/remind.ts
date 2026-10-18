import { db } from "../db";
import { uzToday } from "../planlogic";
import { clip, esc, fmtWhen } from "./botlogic";
import { digest, type Digest } from "./digest";
import { saveRemind } from "./ctx";
import { api, b, inline, type Btn } from "./tg";

/** Kunlik eslatma: bugungi reja, yaqin seminar, takrorlash. Hech narsa bo'lmasa xabar yuborilmaydi (spam yo'q). */
const SEMINAR_WINDOW_MS = 36 * 3_600_000;
const COUNTDOWN = new Set([60, 30, 14, 7, 3, 1]);

/** Eslatma matni. null: bugun aytadigan gap yo'q. Toza funksiya: sinovdan o'tkaziladi. */
export function reminderText(d: Digest, now = new Date()): string | null {
  const lines: string[] = [];
  const open = d.plan.filter((p) => !p.done);
  if (open.length) lines.push(`📌 <b>Bugungi reja</b> (${open.length} ta qoldi)`, ...open.slice(0, 5).map((p) => `⬜ ${esc(clip(p.title, 70))}`));
  const soon = d.seminars.filter((s) => { const t = new Date(s.startsAt).getTime() - now.getTime(); return t > 0 && t <= SEMINAR_WINDOW_MS; });
  for (const s of soon) lines.push(`📅 <b>Seminar:</b> ${esc(clip(s.title, 60))}, ${fmtWhen(s.startsAt)}`);
  if (d.dueErrors) lines.push(`🔁 Takrorlash vaqti kelgan xatolar: <b>${d.dueErrors}</b> ta`);
  if (d.resume) lines.push(`▶️ Tugallanmagan mashq: ${d.resume.answered}/${d.resume.total}`);
  if (d.daysLeft !== null && COUNTDOWN.has(d.daysLeft)) lines.push(`🎯 Imtihongacha <b>${d.daysLeft}</b> kun qoldi`);
  if (!lines.length) return null;
  return ["☀️ <b>Xayrli tong!</b>", "", ...lines].join("\n");
}

const KB: Btn[][] = [[b("🏠 Bosh sahifa", "h")], [b("🔕 Eslatmani o'chirish", "u.rm")]];

export type RemindResult = { sent: number; skipped: number; failed: number; blocked: number };

/** Hammaga (yoqib qo'ygan va bugun hali olmaganlarga) eslatma yuboradi. Cron kuniga bir marta chaqiradi; takror chaqirilsa ham bir kunda bittadan ortiq yuborilmaydi. */
export async function runReminders(now = new Date()): Promise<RemindResult> {
  const today = uzToday(now);
  const users = await db.user.findMany({
    where: { telegramId: { not: null }, deletedAt: null, phone: { not: null }, profile: { onboardedAt: { not: null } } },
    select: { id: true, telegramId: true, botState: { select: { remind: true, remindedOn: true } } },
    take: 5000,
  });
  const todo = users.filter((u) => (u.botState?.remind ?? true) && u.botState?.remindedOn !== today);
  const res: RemindResult = { sent: 0, skipped: users.length - todo.length, failed: 0, blocked: 0 };

  const one = async (u: (typeof todo)[number]) => {
    try {
      const text = reminderText(await digest(u.id, now), now);
      if (!text) { res.skipped++; return; }
      const r = await api("sendMessage", { chat_id: u.telegramId, text, parse_mode: "HTML", disable_web_page_preview: true, reply_markup: inline(KB) });
      if (r.ok) {
        res.sent++;
        await db.botState.upsert({ where: { userId: u.id }, create: { userId: u.id, remindedOn: today }, update: { remindedOn: today } });
      } else if (r.error_code === 403) { res.blocked++; await saveRemind(u.id, false); }
      else { res.failed++; console.error("Eslatma yuborilmadi:", r.description); }
    } catch (e) { res.failed++; console.error("Eslatma xatosi", (e as Error).message); }
  };
  // Telegram chegarasi (soniyasiga ~30 xabar) va bazaga yuk uchun kichik guruhlarda.
  for (let i = 0; i < todo.length; i += 8) await Promise.all(todo.slice(i, i + 8).map(one));
  return res;
}
