import { BarChart3, Bot, BookOpenCheck, Zap, CalendarCheck, ClipboardCheck, FolderHeart, GraduationCap, History, Lightbulb, ListChecks, Map as MapIcon, NotebookPen, RotateCcw, Shuffle, Sparkles, Tags, Timer } from "lucide-react";
import { TONES, type ChoiceDef } from "@/lib/choices";

export { TONES };
export type { ChoiceDef };

export type ModeKey = "practice" | "timed" | "topic" | "mixed" | "situational" | "errors" | "simulation";

export type ModeDef = ChoiceDef & { key: ModeKey };

export const MODES: ModeDef[] = [
  { key: "practice", title: "Oddiy mashq", desc: "Vaqtsiz mashq: har javobdan keyin izoh ochiladi.", benefit: "Tushunib o'rganish", icon: BookOpenCheck, tone: "blue", href: "/ustoz-ai/mashq", cta: "Boshlash" },
  { key: "timed", title: "Vaqtli test", desc: "Belgilangan vaqt ichida ishlang, javoblar yakunda tekshiriladi.", benefit: "Vaqtni boshqarish va aniqlik", icon: Timer, tone: "amber", href: "/ustoz-ai/testlar/sozlash?mode=timed", cta: "Boshlash" },
  { key: "topic", title: "Mavzuli test", desc: "Bitta mavzuni maqsadlari bilan chuqur o'rganing.", benefit: "Mavzuni puxta o'zlashtirish", icon: Tags, tone: "teal", href: "/ustoz-ai/testlar/sozlash?mode=topic", cta: "Boshlash" },
  { key: "mixed", title: "Aralash test", desc: "Bir nechta mavzudan muvozanatli tanlangan savollar.", benefit: "Mavzularni bog'lab fikrlash", icon: Shuffle, tone: "violet", href: "/ustoz-ai/testlar/sozlash?mode=mixed", cta: "Boshlash" },
  { key: "situational", title: "Murakkab vaziyatli test", desc: "Dars vaziyatlarida eng maqbul metodik qarorni tanlang.", benefit: "Pedagogik tafakkur", icon: Lightbulb, tone: "sky", href: "/ustoz-ai/testlar/sozlash?mode=situational", cta: "Boshlash" },
  { key: "errors", title: "Xatolar testi", desc: "Avval xato qilgan bilimlaringizni mustahkamlang.", benefit: "Xatoni bilimga aylantirish", icon: RotateCcw, tone: "rose", href: "/ustoz-ai/testlar/sozlash?mode=errors", cta: "Boshlash" },
  { key: "simulation", title: "Imtihon simulyatsiyasi", desc: "To'liq ekranda, taymer bilan, imtihon sharoitiga yaqin.", benefit: "Sinov sharoitiga tayyorlik", icon: GraduationCap, tone: "navy", href: "/imtihon", cta: "Boshlash" },
];

/** USTOZ AI umumiy sahifasidagi bo'limlar. Diagnostika shu yerda turadi (Testlar ichida takrorlanmaydi). */
export const HUB: ChoiceDef[] = [
  { key: "diagnostic", title: "Diagnostika", desc: "Yordamsiz test: mavzular bo'yicha hozirgi bilim darajangizni aniqlang.", benefit: "Bilimdagi bo'shliqlarni aniqlash", icon: ClipboardCheck, tone: "success", href: "/ustoz-ai/diagnostika", cta: "Boshlash" },
  { key: "tests", title: "Testlar va mashqlar", desc: "Oddiy mashq, vaqtli, mavzuli, aralash, vaziyatli va xatolar testi, imtihon simulyatsiyasi.", benefit: "Mashq qiling va mustahkamlang", icon: ListChecks, tone: "blue", href: "/ustoz-ai/testlar", cta: "Rejimni tanlash" },
  { key: "mine", title: "Mening testlarim", desc: "O'zingiz yuklagan fayllardan tayyorlangan shaxsiy testlar: mashq, test va diagnostika.", benefit: "Materialingizdan test", icon: FolderHeart, tone: "violet", href: "/ustoz-ai/testlarim", cta: "Ochish" },
  { key: "results", title: "Natijalarim", desc: "Bilim xaritasi, xatolar daftari va mashqlar tarixi bir joyda.", benefit: "Rivojlanishni kuzating", icon: BarChart3, tone: "teal", href: "/ustoz-ai/natijalar", cta: "Ko'rish" },
  { key: "plan", title: "Tayyorgarlik rejasi", desc: "Imtihon sanasi va kunlik vaqtingizga mos reja. TOIFA NAVIGATOR bo'limida, yo'l xaritasi va kalendar bilan birga.", benefit: "Rejali tayyorgarlik", icon: CalendarCheck, tone: "violet", href: "/toifa/reja", cta: "Ochish", tag: "Namunaviy" },
  { key: "chat", title: "AI bilan suhbat", desc: "Savolingizni erkin yozing: AI o'zbek tilida javob beradi.", benefit: "Tezkor yordam", icon: Sparkles, tone: "sky", href: "/ai", cta: "Suhbatni ochish" },
];

/** "Oddiy mashq" ichidagi keyingi rejimlar. */
export const PRACTICE: ChoiceDef[] = [
  { key: "quick", title: "Tezkor mashq", desc: "5 ta savol bilan bilimingizni sinang: fan tanlash shart emas.", benefit: "Tez boshlash", icon: Zap, tone: "amber", href: "/ustoz-ai/mashq", cta: "Hoziroq boshlash" },
  { key: "select", title: "Tanlab mashq qilish", desc: "Fan va mavzuni, savollar soni va murakkablikni o'zingiz belgilang.", benefit: "O'zingizga moslab", icon: BookOpenCheck, tone: "blue", href: "/ustoz-ai/mashq/sozlash?kind=topic", cta: "Sozlash" },
  { key: "ai", title: "AI bilan o'rganish", desc: "Tushunmagan joylaringizni AI murabbiy bilan sodda tilda o'rganing.", benefit: "Har savolda AI yordam", icon: Bot, tone: "teal", href: "/ustoz-ai/mashq/sozlash?kind=ai", cta: "Sozlash" },
];

/** "Natijalarim" ichidagi ko'rinishlar. */
export const RESULTS: ChoiceDef[] = [
  { key: "map", title: "Bilim xaritasi", desc: "Mavzular bo'yicha holat: nima o'rganilmoqda, nima mustahkamlanmoqda.", benefit: "Kuchli va zaif tomonlar", icon: MapIcon, tone: "teal", href: "/ustoz-ai/bilim-xaritasi", cta: "Ochish" },
  { key: "errors", title: "Xatolar daftari", desc: "Xato qilingan savollar, takrorlash vaqti va AI tushuntirishi.", benefit: "Xatolar ustida ishlash", icon: NotebookPen, tone: "rose", href: "/ustoz-ai/xatolar", cta: "Ochish" },
  { key: "history", title: "Mashqlar tarixi", desc: "Barcha rejimlardagi mashqlaringiz: rejim, fan va sana bo'yicha filtr.", benefit: "Oldingi natijalar", icon: History, tone: "blue", href: "/ustoz-ai/testlar/tarix", cta: "Ochish" },
];

/** Sozlash sahifasidagi rejimlar: qaysi maydonlar ko'rsatilishi shu yerda belgilanadi. */
export type SetupMode = "practice" | "ai" | "timed" | "topic" | "mixed" | "situational" | "errors";
export const SETUP: Record<SetupMode, {
  kind: "topic" | "ai" | "timed" | "topictest" | "mixed" | "situational" | "errors";
  title: string; lead: string;
  topic: "none" | "single" | "single-or-all" | "multi";
  counts: number[]; difficulty: boolean; time: "none" | "required" | "optional"; extra?: "distribution" | "variant";
}> = {
  practice: { kind: "topic", title: "Oddiy mashq", lead: "Fan va mavzuni tanlang. Har javobdan keyin izoh ochiladi.", topic: "single-or-all", counts: [5, 10, 15, 20, 30, 50], difficulty: true, time: "none" },
  ai: { kind: "ai", title: "AI bilan o'rganish", lead: "Mavzuni tanlang: AI murabbiy har savoldan keyin tushuntirib beradi.", topic: "single-or-all", counts: [5, 10, 15, 20, 30, 50], difficulty: true, time: "none" },
  timed: { kind: "timed", title: "Vaqtli test", lead: "Savollar soni va vaqtni tanlang. Javoblar test tugagandan keyin tekshiriladi.", topic: "single-or-all", counts: [5, 10, 15, 20, 30, 50], difficulty: true, time: "required" },
  topic: { kind: "topictest", title: "Mavzuli test", lead: "Bitta mavzuni tanlang va nimalarni bilib olishingizni ko'ring.", topic: "single", counts: [5, 10, 15, 20], difficulty: true, time: "optional" },
  mixed: { kind: "mixed", title: "Aralash test", lead: "Kamida ikkita mavzuni tanlang. Savollar mavzular o'rtasida muvozanatli taqsimlanadi.", topic: "multi", counts: [10, 15, 20, 30, 50], difficulty: true, time: "optional", extra: "distribution" },
  situational: { kind: "situational", title: "Murakkab vaziyatli test", lead: "Dars vaziyatlari: to'rtta variantdan eng maqbulini tanlang va qaroringizni asoslang.", topic: "single-or-all", counts: [5, 10, 15, 20], difficulty: false, time: "optional" },
  errors: { kind: "errors", title: "Xatolar testi", lead: "Avvalgi xatolaringiz asosida mustahkamlovchi test.", topic: "none", counts: [5, 10, 15, 20], difficulty: false, time: "none", extra: "variant" },
};
