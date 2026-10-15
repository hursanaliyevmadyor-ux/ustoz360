/** O'zbekiston viloyatlari (yashash joyi ro'yxati). Ham serverda tekshirish, ham formada tanlash uchun. */
export const REGIONS = [
  "Toshkent shahri", "Toshkent viloyati", "Andijon viloyati", "Buxoro viloyati", "Farg'ona viloyati", "Jizzax viloyati",
  "Xorazm viloyati", "Namangan viloyati", "Navoiy viloyati", "Qashqadaryo viloyati", "Qoraqalpog'iston Respublikasi",
  "Samarqand viloyati", "Sirdaryo viloyati", "Surxondaryo viloyati",
] as const;
export type Region = (typeof REGIONS)[number];
