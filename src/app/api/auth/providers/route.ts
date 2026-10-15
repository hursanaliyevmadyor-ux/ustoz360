import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";

/** Qaysi kirish usullari sozlangan (kalitlar qo'yilgan). Sirlar qaytarilmaydi. */
export const GET = () => NextResponse.json({
  google: !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
  yandex: !!(process.env.YANDEX_CLIENT_ID && process.env.YANDEX_CLIENT_SECRET),
  telegram: process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_BOT_USERNAME ? process.env.TELEGRAM_BOT_USERNAME : null,
});
