import { NextResponse } from "next/server";
import { botConfigured, botUsername } from "@/server/telegram";
export const dynamic = "force-dynamic";

/** Qaysi kirish usullari sozlangan (kalitlar qo'yilgan). Sirlar qaytarilmaydi. */
export const GET = () => NextResponse.json({
  google: !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
  yandex: !!(process.env.YANDEX_CLIENT_ID && process.env.YANDEX_CLIENT_SECRET),
  telegram: botConfigured() ? botUsername() : null,
});
