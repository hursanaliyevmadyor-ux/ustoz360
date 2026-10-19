/**
 * Maxfiylik: matndagi shaxsiy ma'lumot (telefon, email, PINFL, karta, pasport, Telegram @nom, kalit) topiladi va tozalanadi.
 * AI Bilim markaziga faqat tozalangan, umumlashtirilgan matn tushadi. Toza funksiyalar: bazaga tegmaydi.
 */
export type PiiKind = "phone" | "email" | "pinfl" | "card" | "passport" | "handle" | "secret";

const RULES: { kind: PiiKind; re: RegExp; mask: string }[] = [
  // Kalit va tokenlar eng birinchi: ichida raqam/harf bo'lgani uchun boshqa qoidalar buzib yubormasin.
  { kind: "secret", re: /\b(?:AIza[0-9A-Za-z_-]{20,}|AQ\.[0-9A-Za-z_.-]{20,}|sk-[A-Za-z0-9_-]{20,}|tvly-[A-Za-z0-9_-]{12,}|gsk_[A-Za-z0-9]{20,}|ghp_[A-Za-z0-9]{20,}|eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,})/g, mask: "[kalit]" },
  { kind: "secret", re: /\b(?:bearer|token|api[_-]?key|parol|password)\s*[:=]?\s*[A-Za-z0-9._-]{16,}/gi, mask: "[kalit]" },
  { kind: "secret", re: /([?&](?:key|token|api_key|apikey|access_token|secret)=)[^\s&]+/gi, mask: "$1[kalit]" },
  { kind: "email", re: /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+/g, mask: "[email]" },
  { kind: "card", re: /\b(?:\d{4}[ -]?){3}\d{4}\b/g, mask: "[karta]" },
  { kind: "pinfl", re: /\b\d{14}\b/g, mask: "[pinfl]" },
  { kind: "passport", re: /\b[A-Z]{2}\s?\d{7}\b/g, mask: "[pasport]" },
  // Telefon: xalqaro (+998...), 998 bilan yoki 2-3-2-2 guruhlangan mahalliy raqam. Oddiy 9 xonali son (masalan matematik misol) telefon hisoblanmaydi.
  { kind: "phone", re: /(?<![\d])\+?998[\s-]?\(?\d{2}\)?[\s-]?\d{3}[\s-]?\d{2}[\s-]?\d{2}(?![\d])/g, mask: "[telefon]" },
  { kind: "phone", re: /(?<![\d])\+\d{10,14}(?![\d])/g, mask: "[telefon]" },
  { kind: "phone", re: /(?<![\d])\(?\d{2}\)?[ -]\d{3}[ -]\d{2}[ -]\d{2}(?![\d])/g, mask: "[telefon]" },
  { kind: "handle", re: /(?<![\w@])@[A-Za-z][A-Za-z0-9_]{4,31}\b/g, mask: "[@nom]" },
];

export function findPii(text: string): PiiKind[] {
  const out = new Set<PiiKind>();
  let rest = text;
  for (const r of RULES) {
    r.re.lastIndex = 0;
    if (r.re.test(rest)) { out.add(r.kind); r.re.lastIndex = 0; rest = rest.replace(r.re, r.mask); }
  }
  return Array.from(out);
}

export const hasPii = (text: string) => findPii(text).length > 0;

/** Shaxsiy ma'lumotlarni niqoblaydi (masalan "[telefon]"). Topilganlar turi ham qaytadi. */
export function scrubPii(text: string): { text: string; found: PiiKind[] } {
  const found = new Set<PiiKind>();
  let out = text;
  for (const r of RULES) {
    r.re.lastIndex = 0;
    if (r.re.test(out)) { found.add(r.kind); r.re.lastIndex = 0; out = out.replace(r.re, r.mask); }
  }
  return { text: out, found: Array.from(found) };
}
