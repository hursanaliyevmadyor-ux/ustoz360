import type { LucideIcon } from "lucide-react";

/** Tanlash kartalari ikonka aksentlari (Tailwind dinamik nomlarni ko'rmaydi, shuning uchun to'liq yozilgan). */
export const TONES = {
  blue: "bg-primary/10 text-primary",
  amber: "bg-amber/15 text-warning",
  teal: "bg-teal/10 text-teal",
  violet: "bg-[#7C3AED]/10 text-[#7C3AED]",
  rose: "bg-danger/10 text-danger",
  success: "bg-success/10 text-success",
  sky: "bg-[#0284C7]/10 text-[#0284C7]",
  navy: "bg-[#102A4C]/10 text-[#102A4C] dark:bg-white/10 dark:text-white",
} as const;

/**
 * Tanlash kartasi: barcha bo'limlarda (USTOZ AI, DARSYOR, TOIFA va h.k.) "keyingi qadamni tanlang" ekranlari shu bitta shakldan foydalanadi.
 * tag: bo'lim hali to'liq ishlamasa (masalan "Namunaviy"), tayyor deb ko'rsatilmasligi uchun belgi.
 */
export type ChoiceDef = {
  key: string; title: string; desc: string; benefit: string; icon: LucideIcon; tone: keyof typeof TONES; href: string; cta: string; tag?: string;
};
