/**
 * Nik qoidalari (toza funksiyalar): uzunlik, belgilar, band so'zlar va yagonalik uchun me'yorlashtirish.
 * Me'yorlash: kichik harf, `_ . -` belgilari olib tashlanadi, o'xshash harflar bir xil yoziladi, shuning uchun «ZiyoUstoz», «ziyo_ustoz»
 * va «Z1yoUstoz» bir-biriga o'xshash niklar sifatida bitta nik hisoblanadi.
 */
export const NICK_MIN = 3, NICK_MAX = 20;
const FORMAT = /^[A-Za-z0-9][A-Za-z0-9_.-]{2,19}$/;

/** Ommaviy reytingda ko'rinmasligi kerak so'zlar (rasmiy nomlar, haqorat). Ro'yxat qisqa: admin moderatsiyasi qolganini hal qiladi. */
const BLOCKED = [
  "admin", "administrator", "moderator", "support", "yordam", "ustoz360", "edutechall", "official", "system", "tizim", "root", "null", "undefined",
  "fuck", "shit", "bitch", "sex", "porn", "nigga", "nigger", "xuy", "blyad", "pidor", "skot", "yeban", "kot", "ahmoq", "tentak", "jalab",
];

const LOOK = new Map<string, string>([["0", "o"], ["1", "i"], ["3", "e"], ["4", "a"], ["5", "s"], ["7", "t"], ["@", "a"], ["$", "s"]]);

/** Yagonalik kaliti. */
export function normalizeNickname(nick: string): string {
  return nick.normalize("NFKC").toLowerCase().replace(/[._-]/g, "").split("").map((c) => LOOK.get(c) ?? c).join("");
}

export type NickCheck = { ok: true; nickname: string; normalized: string } | { ok: false; error: string; code: "format" | "blocked" };

export function checkNickname(raw: string): NickCheck {
  const nick = raw.normalize("NFKC").trim();
  if (nick.length < NICK_MIN || nick.length > NICK_MAX) return { ok: false, code: "format", error: `Nik ${NICK_MIN}–${NICK_MAX} belgidan iborat bo'lsin.` };
  if (!FORMAT.test(nick)) return { ok: false, code: "format", error: "Nikda faqat lotin harflari, raqamlar va _ . - belgilari bo'lsin; u harf yoki raqam bilan boshlansin." };
  if (/^\d+$/.test(nick)) return { ok: false, code: "format", error: "Nik faqat raqamlardan iborat bo'lmasin." };
  const n = normalizeNickname(nick);
  if (BLOCKED.some((w) => n.includes(normalizeNickname(w)))) return { ok: false, code: "blocked", error: "Bu nikdan foydalanib bo'lmaydi. Boshqa nik tanlang." };
  return { ok: true, nickname: nick, normalized: n };
}
