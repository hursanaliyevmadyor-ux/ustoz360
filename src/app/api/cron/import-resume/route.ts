import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { resumeStale } from "@/server/import/pipeline";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Sahifasi yopilib qolgan importlarni davom ettiradi. Vercel Cron `Authorization: Bearer <CRON_SECRET>` yuboradi;
 * CRON_SECRET bo'lmasa yoki noto'g'ri bo'lsa chaqirib bo'lmaydi. (Bepul rejada Cron kuniga bir marta ishlaydi: foydalanuvchi qaytganda jarayon baribir o'zi davom etadi.)
 */
export const GET = async (req: Request) => {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: "CRON_SECRET sozlanmagan." }, { status: 503 });
  const got = Buffer.from(req.headers.get("authorization") ?? ""), want = Buffer.from(`Bearer ${secret}`);
  if (got.length !== want.length || !timingSafeEqual(got, want)) return NextResponse.json({ error: "Ruxsat yo'q." }, { status: 401 });
  return NextResponse.json(await resumeStale());
};
