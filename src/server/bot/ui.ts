import { esc } from "./botlogic";
import { b, type Btn } from "./tg";

/** Bot interfeysi: pastdagi doimiy menyu, har ekrandagi "Orqaga / Menyu" tugmalari va umumiy matnlar. */

export const MENU_ITEMS = [
  { text: "🏠 Bosh sahifa", sec: "h", cmd: "bosh" },
  { text: "📚 Testlar", sec: "t", cmd: "testlar" },
  { text: "🧭 TOIFA reja", sec: "p", cmd: "reja" },
  { text: "👩‍🏫 Sinflarim", sec: "s", cmd: "sinflar" },
  { text: "📝 DARSYOR", sec: "d", cmd: "darsyor" },
  { text: "📖 Kutubxona", sec: "l", cmd: "kutubxona" },
  { text: "🛒 Kurslar", sec: "m", cmd: "kurslar" },
  { text: "📅 Seminarlar", sec: "n", cmd: "seminarlar" },
  { text: "🤖 AI yordamchi", sec: "a", cmd: "ai" },
  { text: "👤 Profil", sec: "u", cmd: "profil" },
] as const;

export type Sec = (typeof MENU_ITEMS)[number]["sec"];

export const SECTION_BY_TEXT = new Map<string, Sec>(MENU_ITEMS.map((m) => [m.text, m.sec]));
/** /testlar, /reja ... buyruqlari; /menyu ham bosh sahifani ochadi. */
export const SECTION_BY_COMMAND = new Map<string, Sec>([...MENU_ITEMS.map((m) => [m.cmd, m.sec] as [string, Sec]), ["menyu", "h"]]);

export const APP_BUTTON = "📱 Ilovani ochish";

/** Pastdagi doimiy menyu: birinchi qatorda Mini App (sayt Telegram ichida), keyin bo'limlar. Mini App faqat https manzilda ishlaydi. */
export function menuMarkup(origin: string) {
  const rows = Array.from({ length: MENU_ITEMS.length / 2 }, (_, i) => [{ text: MENU_ITEMS[i * 2].text }, { text: MENU_ITEMS[i * 2 + 1].text }]);
  const app = origin.startsWith("https://") ? [[{ text: APP_BUTTON, web_app: { url: origin } }]] : [];
  return { keyboard: [...app, ...rows], resize_keyboard: true, is_persistent: true, input_field_placeholder: "Bo'limni tanlang yoki /menyu" };
}

/** Har ekran ostidagi tugmalar: orqaga (bo'lsa) va bosh sahifa. Foydalanuvchi hech qachon "tuynuk"da qolmaydi. */
export const nav = (back?: string): Btn[] => [...(back ? [b("⬅️ Orqaga", back)] : []), b("🏠 Menyu", "h")];

export const heading = (icon: string, title: string) => `${icon} <b>${esc(title)}</b>`;

export const HELP = [
  heading("❓", "Yordam"),
  "",
  "📱 «Ilovani ochish» tugmasi saytning to'liq ko'rinishini Telegram ichida ochadi (yozish maydoni yonidagi «Ilova» tugmasi ham shu).",
  "Yoki pastdagi tugmalardan bo'lim tanlang, har bir bo'limda yo'l-yo'riq tugmalar bilan beriladi.",
  "",
  "🏠 Bosh sahifa: bugungi reja, seminar va yangiliklar",
  "📚 Testlar: tezkor mashq, mavzu bo'yicha test, xatolar ustida ishlash",
  "🧭 TOIFA reja: tayyorgarlik rejasi, hujjatlar cheklisti, rasmiy ma'lumotlar",
  "👩‍🏫 Sinflarim: sinf, taxallusli o'quvchilar, ball kiritish va tahlil",
  "📝 DARSYOR: AI bilan dars ishlanmasi va topshiriqlar, saqlangan hujjatlar",
  "📖 Kutubxona: hujjat qidirish, yuklash, hujjatdan so'rash",
  "🛒 Kurslar: katalog, sotib olish, obuna",
  "📅 Seminarlar: yaqin tadbirlar",
  "🤖 AI yordamchi: erkin savol-javob",
  "👤 Profil: tarif, limit, eslatma sozlamasi",
  "",
  "Tugma ishlamay qolsa yoki adashsangiz: /menyu",
].join("\n");

/** Ochilmagan/yoqilmagan funksiya uchun halol xabar. */
export const soon = (what: string) => `${what} hozircha ulanmagan. Administrator yoqqach ishlaydi.`;
