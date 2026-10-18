import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { runReminders } from "@/server/bot/remind";
import { botConfigured } from "@/server/telegram";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Kunlik eslatma. Vercel Cron har kuni chaqiradi va `Authorization: Bearer <CRON_SECRET>` yuboradi.
 * CRON_SECRET o'rnatilmagan bo'lsa yoki noto'g'ri bo'lsa, hech kim chaqira olmaydi.
 */
export const GET = async (req: Request) => {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: "CRON_SECRET sozlanmagan." }, { status: 503 });
  const got = Buffer.from(req.headers.get("authorization") ?? ""), want = Buffer.from(`Bearer ${secret}`);
  if (got.length !== want.length || !timingSafeEqual(got, want)) return NextResponse.json({ error: "Ruxsat yo'q." }, { status: 401 });
  if (!botConfigured()) return NextResponse.json({ skipped: "Telegram bot sozlanmagan." });
  return NextResponse.json(await runReminders());
};
