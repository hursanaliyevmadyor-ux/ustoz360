import { aiModel, aiConfigured, freeConfigured } from "./ai/gateway";
import { paymentStatus } from "./payments";
import { storageConfigured } from "./storage";

/**
 * Admin panel uchun tashqi xizmatlar holati. Faqat "ulangan / ulanmagan" va kerakli o'zgaruvchi NOMLARI ko'rsatiladi:
 * kalitlarning qiymati hech qachon qaytarilmaydi va bazada saqlanmaydi.
 */
const has = (...names: string[]) => names.every((n) => Boolean(process.env[n]));

export type Integration = { id: string; name: string; configured: boolean; needs: string[]; hint: string };

export function integrations(): Integration[] {
  const pay = paymentStatus();
  return [
    { id: "database", name: "Ma'lumotlar bazasi (Supabase)", configured: has("DATABASE_URL"), needs: ["DATABASE_URL"], hint: "Supabase → Project Settings → Database → Connection string (pooler)." },
    { id: "auth", name: "Sessiya sirri", configured: (process.env.AUTH_SECRET?.length ?? 0) >= 32, needs: ["AUTH_SECRET"], hint: "Kamida 32 belgi, tasodifiy." },
    { id: "google", name: "Google orqali kirish", configured: has("GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"), needs: ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "APP_URL"], hint: "Google Cloud Console → OAuth; redirect manzilini saytga moslang." },
    { id: "telegram", name: "Telegram bot orqali kirish", configured: has("TELEGRAM_BOT_TOKEN", "TELEGRAM_BOT_USERNAME"), needs: ["TELEGRAM_BOT_TOKEN", "TELEGRAM_BOT_USERNAME"], hint: "@BotFather orqali bot yarating; webhook'ni sayt o'zi o'rnatadi." },
    { id: "bot-reminders", name: "Botda kunlik eslatma (cron)", configured: has("CRON_SECRET"), needs: ["CRON_SECRET"], hint: "Tasodifiy uzun qator. Vercel Cron kuniga bir marta (08:00 Toshkent) eslatma yuboradi." },
    { id: "yandex", name: "Yandex orqali kirish", configured: has("YANDEX_CLIENT_ID", "YANDEX_CLIENT_SECRET"), needs: ["YANDEX_CLIENT_ID", "YANDEX_CLIENT_SECRET"], hint: "oauth.yandex.com." },
    { id: "smtp", name: "Email yuborish (SMTP)", configured: has("SMTP_HOST", "SMTP_USER", "SMTP_PASS"), needs: ["SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASS"], hint: "Parolni tiklash va email tasdiqlash kodlari uchun." },
    { id: "ai-claude", name: `AI: Claude${aiConfigured() ? ` (${aiModel()})` : ""}`, configured: aiConfigured(), needs: ["ANTHROPIC_API_KEY", "AI_MODEL"], hint: "Pullik; kalitni faqat serverda saqlang." },
    { id: "ai-free", name: "AI: bepul OpenAI-mos xizmat", configured: freeConfigured(), needs: ["FREE_LLM_BASE_URL", "FREE_LLM_API_KEY", "FREE_LLM_MODEL"], hint: "Masalan OpenRouter (:free model) yoki Google AI Studio. Zaxira uchun FREE_LLM2_* ... FREE_LLM10_* (10 tagacha)." },
    { id: "ai-tavily-web", name: "AI: Tavily internet qidiruvi (asosiy)", configured: has("TAVILY_API_KEY"), needs: ["TAVILY_API_KEY", "TAVILY_MONTHLY_CAP (ixtiyoriy)"], hint: "app.tavily.com'dan bepul kalit: oyiga 1000 kredit. Natijalar keshlanadi, rasmiy manbalar birinchi." },
    { id: "ai-gemini-web", name: `AI: Gemini + Google qidiruvi (zaxira)${has("GEMINI_API_KEY") ? ` (${process.env.GEMINI_MODEL || "gemini-2.5-flash"})` : ""}`, configured: has("GEMINI_API_KEY"), needs: ["GEMINI_API_KEY", "GEMINI_MODEL (ixtiyoriy)"], hint: "Ixtiyoriy zaxira: Tavily ishlamasa yoki chegaraga yetsa. aistudio.google.com'dan bepul kalit; bepul rejada qidiruv faqat 2.5 Flash/Flash-Lite, kuniga ~500." },
    { id: "storage", name: "Fayl saqlash (Supabase Storage)", configured: storageConfigured(), needs: ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_STORAGE_BUCKET (ixtiyoriy)"], hint: "Supabase → Project Settings → API → service_role kaliti. Faqat serverda!" },
    { id: "payments", name: "To'lov provayderi (webhook)", configured: pay.providerReady, needs: ["PAYMENT_WEBHOOK_SECRET", "PAYMENT_CHECKOUT_URL"], hint: "Click/Payme shartnomasi va kalitlari kerak. Hozircha bank o'tkazmasi (qo'lda tasdiqlash) ishlaydi." },
  ];
}
