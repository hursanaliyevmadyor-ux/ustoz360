import { timingSafeEqual } from "node:crypto";
import { appOrigin } from "@/server/oauth";
import { ensureWebhook, handleUpdate, webhookSecret, type TgUpdate } from "@/server/telegram";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Telegram shu manzilga bot yangilanishlarini yuboradi. Maxfiy sarlavha bilan tekshiriladi; xato bo'lsa ham 200 qaytaramiz (Telegram qayta-qayta yubormasligi uchun). */
export const POST = async (req: Request) => {
  const got = req.headers.get("x-telegram-bot-api-secret-token") ?? "";
  const want = webhookSecret();
  if (got.length !== want.length || !timingSafeEqual(Buffer.from(got), Buffer.from(want))) return new Response("forbidden", { status: 401 });
  try {
    // Yangi server nusxasida webhook sozlamasi (qabul qilinadigan yangilanish turlari) bir marta yangilanadi: yangi versiya chiqqach tugmalar ham ishlaydi.
    await ensureWebhook(appOrigin(req));
    await handleUpdate((await req.json()) as TgUpdate, appOrigin(req));
  } catch (e) { console.error("Telegram webhook xato", (e as Error).message); }
  return Response.json({ ok: true });
};
