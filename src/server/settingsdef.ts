import { z } from "zod";

/**
 * Admin boshqaradigan sozlamalar. MAXFIY KALITLAR (API kalit, parol, webhook siri) bu yerda yo'q va bo'lmaydi:
 * ular faqat muhit o'zgaruvchilarida turadi, admin panel ularni faqat "ulangan / ulanmagan" holatida ko'rsatadi.
 */
const money = z.number().int().min(0).max(1_000_000_000);

export const settingSchemas = {
  general: z.object({
    siteName: z.string().trim().min(1).max(60),
    supportContact: z.string().trim().max(200),
  }),
  modules: z.object({
    ai: z.boolean(), darsyor: z.boolean(), toifa: z.boolean(), market: z.boolean(), sinf: z.boolean(), bilimxona: z.boolean(), bepul: z.boolean(),
  }),
  ai: z.object({
    enabled: z.boolean(),
    freeEnabled: z.boolean(),
    /** null: muhit o'zgaruvchisidagi (yoki standart) qiymat ishlatiladi. */
    dailyLimit: z.number().int().min(1).max(10_000).nullable(),
    freeDailyLimit: z.number().int().min(1).max(10_000).nullable(),
    /** Internetdan qidirib javob berish: har foydalanuvchiga kunlik limit (bepul qidiruv kvotalari tugab qolmasligi uchun). */
    webDailyLimit: z.number().int().min(1).max(200),
    /** Yangi/rasmiy ma'lumot yoki tayyor material so'ralganda AI o'zi internetdan qidiradi (aks holda faqat "Internetdan qidirish" tugmasi bilan). */
    webAuto: z.boolean(),
    perMinute: z.number().int().min(1).max(120),
    /** Narx (USD / 1 mln token), xarajatni taxmin qilish uchun. 0: hisoblanmaydi. */
    priceInPerMTok: z.number().min(0).max(1000),
    priceOutPerMTok: z.number().min(0).max(1000),
  }),
  payments: z.object({
    /** off: to'lov yo'q | manual: bank o'tkazmasi, admin tasdiqlaydi | provider: Click/Payme (kalitlar ulangach) */
    mode: z.enum(["off", "manual", "provider"]),
    manualInstructions: z.string().trim().max(1000),
    minPriceUzs: money,
  }),
  content: z.object({
    aiDisclaimer: z.string().trim().max(300),
    policy: z.string().trim().max(4000),
  }),
  notifications: z.object({
    enabled: z.boolean(),
    seminarAnnouncements: z.boolean(),
  }),
  /** Bosh sahifadagi yangiliklar va e'lonlar (admin boshqaradi). Havola: sayt ichidagi yo'l yoki https. */
  announcements: z.object({
    items: z.array(z.object({
      id: z.string().trim().min(1).max(40),
      title: z.string().trim().min(1, "Sarlavha bo'sh bo'lmasin").max(120),
      text: z.string().trim().max(500),
      href: z.string().trim().max(300).refine((v) => !v || /^\/(?!\/)/.test(v) || /^https:\/\/\S+$/i.test(v), "Havola «/» (sayt ichida) yoki https:// bilan boshlansin"),
      active: z.boolean(),
      /** Tugash sanasi (YYYY-MM-DD) yoki bo'sh. */
      until: z.string().refine((v) => v === "" || /^\d{4}-\d{2}-\d{2}$/.test(v), "Sana noto'g'ri"),
    })).max(10, "Ko'pi bilan 10 ta e'lon"),
  }),
} as const;

export type SettingKey = keyof typeof settingSchemas;
export type SettingsMap = { [K in SettingKey]: z.infer<(typeof settingSchemas)[K]> };
export const SETTING_KEYS = Object.keys(settingSchemas) as SettingKey[];

export const SETTING_DEFAULTS: SettingsMap = {
  general: { siteName: "USTOZ 360", supportContact: "" },
  modules: { ai: true, darsyor: true, toifa: true, market: true, sinf: true, bilimxona: true, bepul: true },
  ai: { enabled: true, freeEnabled: true, dailyLimit: null, freeDailyLimit: null, webDailyLimit: 5, webAuto: true, perMinute: 6, priceInPerMTok: 0, priceOutPerMTok: 0 },
  payments: { mode: "off", manualInstructions: "", minPriceUzs: 0 },
  content: { aiDisclaimer: "AI matni noto'g'ri bo'lishi mumkin: ishlatishdan oldin tekshiring.", policy: "" },
  notifications: { enabled: true, seminarAnnouncements: true },
  announcements: { items: [] },
};

export type Announcement = SettingsMap["announcements"]["items"][number];
/** Foydalanuvchiga ko'rinadigan e'lonlar: faol va muddati o'tmagan (sana "YYYY-MM-DD", O'zbekiston vaqti bilan). */
export const visibleAnnouncements = (items: Announcement[], today: string) => items.filter((a) => a.active && (!a.until || a.until >= today));

/** Saqlangan qiymatni standart bilan birlashtiradi: noto'g'ri yoki eskirgan qiymat standartga qaytadi (sahifa buzilmaydi). */
export function mergeSetting<K extends SettingKey>(key: K, stored: unknown): SettingsMap[K] {
  const base = SETTING_DEFAULTS[key];
  if (stored == null || typeof stored !== "object") return base;
  const parsed = settingSchemas[key].safeParse({ ...base, ...(stored as object) });
  return (parsed.success ? parsed.data : base) as SettingsMap[K];
}
