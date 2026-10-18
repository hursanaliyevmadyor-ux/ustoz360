import { z } from "zod";
import { ApiError, currentUser, startSession } from "@/server/auth";
import { verifyInitData } from "@/server/bot/webapp";
import { db } from "@/server/db";
import { handle } from "@/server/http";
import { landingPath } from "@/server/onboarding";
import { botConfigured } from "@/server/telegram";
export const dynamic = "force-dynamic";

const body = z.object({ initData: z.string().min(10).max(4096) });

/**
 * Telegram Mini App ichidan kirish: Telegram imzolagan initData tekshiriladi, shu Telegram akkaunti botda telefon bilan
 * ro'yxatdan o'tgan bo'lsa, sessiya ochiladi. Qurilmada boshqa odamning sessiyasi qolgan bo'lsa, u Telegram egasiga almashtiriladi.
 */
export const POST = (req: Request) => handle(async () => {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!botConfigured() || !token) throw new ApiError(503, "Telegram orqali kirish hali sozlanmagan.", "telegram_not_configured");
  const { initData } = body.parse(await req.json());
  const v = verifyInitData(initData, token);
  if (!v.ok) throw new ApiError(401, "Telegram ma'lumoti tasdiqlanmadi. Ilovani botdan qayta oching.", "invalid_init_data");

  const u = await db.user.findUnique({ where: { telegramId: String(v.user.id) }, select: { id: true, phone: true, deletedAt: true } });
  if (!u || u.deletedAt || !u.phone) throw new ApiError(404, "Avval botda /start bosib, telefon raqamingizni yuboring.", "telegram_not_registered");

  // Shu Telegram egasining sessiyasi allaqachon ochiq bo'lsa, qayta yaratilmaydi.
  const cur = await currentUser().catch(() => null);
  if (cur?.id === u.id) return { ok: true, already: true, next: null };
  await startSession(u.id);
  await db.auditLog.create({ data: { userId: u.id, action: "auth.login_telegram_webapp" } });
  return { ok: true, already: false, next: await landingPath(u.id) };
});
