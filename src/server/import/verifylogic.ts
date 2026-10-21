import { createHash } from "node:crypto";
import type { KeyEntry } from "./keyparse";
import { keySectionEntries } from "./keyparse";
import type { Opt, QType } from "./qparse";

/**
 * Javobni tekshirish qoidalari (toza funksiyalar, bazaga va AI'ga bog'liq emas).
 * Asosiy tamoyil: fayldagi kalit «tekshirilgan haqiqat» emas, u faqat dalillardan biri. Mustaqil tekshiruv (hisob, AI, manba) bilan
 * mos kelsa «tasdiqlangan», farq qilsa «ziddiyat», dalil yetarli bo'lmasa «javob tasdiqlanmadi — qo'lda tekshirish kerak».
 */
export type AnswerOrigin = "FILE_KEY" | "SEPARATE_KEY" | "AI" | "HUB" | "WEB" | "LIBRARY" | "COMPUTED" | "USER" | "NONE";
export type VStatus = "CONFIRMED" | "PROPOSED" | "CONFLICT" | "UNVERIFIED" | "NOT_FOUND" | "USER_CONFIRMED";
export type ReviewStatus = "PENDING" | "READY" | "NEEDS_REVIEW" | "NO_ANSWER" | "CONFLICT" | "UNSUPPORTED" | "INCOMPLETE";
export type Confidence = "high" | "medium" | "low";

export type Evidence = {
  type: "FILE_KEY" | "SEPARATE_KEY" | "COMPUTED" | "AI" | "HUB" | "LIBRARY" | "WEB" | "SOURCE";
  title: string; url?: string; page?: string; quote?: string; note?: string; trust?: string;
};

export const NOT_VERIFIED_TEXT = "Javob tasdiqlanmadi — qo'lda tekshirish kerak.";
export const SUPPORTED_TYPES: QType[] = ["SINGLE", "SITUATIONAL"];

export const TYPE_NOTE: Record<QType, string> = {
  SINGLE: "", SITUATIONAL: "",
  MULTI: "Bir nechta to'g'ri javobli savol: mavjud test dvigateli hozircha faqat bitta to'g'ri javobni qo'llab-quvvatlaydi.",
  MATCHING: "Moslashtirish savoli: mavjud test dvigateli qo'llab-quvvatlamaydi.",
  ORDERING: "Ketma-ketlik savoli: mavjud test dvigateli qo'llab-quvvatlamaydi.",
  SHORT: "Qisqa javobli savol: mavjud test dvigateli qo'llab-quvvatlamaydi.",
  UNKNOWN: "Savol turini aniqlab bo'lmadi: variantlar topilmadi.",
};

export type DecideInput = {
  qtype: QType; incomplete: boolean; options: Opt[]; ocrUncertain: boolean;
  key: string[] | null; keySource: "INLINE" | "SEPARATE_FILE" | null;
  ai: { answer: string[]; confidence: Confidence } | null; aiTried: boolean;
  computed: string[] | null;
  /** AI javobini qo'llab-quvvatlovchi haqiqiy manba (bilim bazasi, BILIMXONA, veb) bormi va qaysi turdagisi. */
  support: "WEB" | "HUB" | "LIBRARY" | null;
};
export type Decision = { verificationStatus: VStatus; reviewStatus: ReviewStatus; origin: AnswerOrigin; proposed: string[] | null; confidence: Confidence | null; note: string | null };

const same = (a: string[], b: string[]) => a.length === b.length && a.every((x, i) => x === b[i]);
const keyOrigin = (s: DecideInput["keySource"]): AnswerOrigin => (s === "SEPARATE_FILE" ? "SEPARATE_KEY" : "FILE_KEY");

export function decide(i: DecideInput): Decision {
  const labels = i.options.map((o) => o.label);
  const dec = (verificationStatus: VStatus, reviewStatus: ReviewStatus, origin: AnswerOrigin, proposed: string[] | null, confidence: Confidence | null, note: string | null): Decision => {
    // OCR noaniq o'qigan savol hech qachon «tayyor» bo'lmaydi.
    if (reviewStatus === "READY" && i.ocrUncertain) return { verificationStatus, reviewStatus: "NEEDS_REVIEW", origin, proposed, confidence, note: [note, "Matn noaniq o'qilgan: asl hujjat bilan solishtiring."].filter(Boolean).join(" ") };
    return { verificationStatus, reviewStatus, origin, proposed, confidence, note };
  };
  if (i.incomplete) return dec("UNVERIFIED", "INCOMPLETE", "NONE", null, null, "Savol yoki variantlar to'liq ajratilmadi: matnni tahrirlang.");
  if (!SUPPORTED_TYPES.includes(i.qtype)) return dec("UNVERIFIED", "UNSUPPORTED", i.key ? keyOrigin(i.keySource) : "NONE", i.key, null, TYPE_NOTE[i.qtype]);

  // Kalit holati
  const keyLabel = i.key && i.key.length === 1 ? i.key[0] : null;
  if (i.key && (i.key.length !== 1 || !labels.includes(i.key[0]))) {
    return dec("CONFLICT", "CONFLICT", keyOrigin(i.keySource), i.key, null, i.key.length !== 1 ? "Kalitda bir nechta javob ko'rsatilgan, savol esa bitta javobli." : `Kalitdagi «${i.key[0]}» varianti savolda yo'q (variantlar: ${labels.join(", ")}).`);
  }

  // Deterministik hisob (arifmetika): eng ishonchli dalil
  if (i.computed && i.computed.length === 1) {
    if (keyLabel && keyLabel !== i.computed[0]) return dec("CONFLICT", "CONFLICT", "COMPUTED", i.computed, "high", `Fayl kaliti (${keyLabel}) hisob natijasiga (${i.computed[0]}) mos kelmaydi.`);
    return dec("CONFIRMED", "READY", "COMPUTED", i.computed, "high", keyLabel ? "Fayldagi kalit hisob bilan tasdiqlandi." : "Natija hisoblab tasdiqlandi.");
  }

  const ai = i.ai && i.ai.answer.length === 1 ? i.ai : null;
  if (i.ai && i.ai.answer.length > 1) {
    return keyLabel
      ? dec("PROPOSED", "NEEDS_REVIEW", keyOrigin(i.keySource), [keyLabel], null, "AI bir nechta javob ehtimolini ko'rsatdi: savol noaniq bo'lishi mumkin. Kalit mustaqil tasdiqlanmadi.")
      : dec("NOT_FOUND", "NO_ANSWER", "NONE", null, null, `AI bir nechta javob ehtimolini ko'rsatdi: savol noaniq bo'lishi mumkin. ${NOT_VERIFIED_TEXT}`);
  }

  if (ai && !labels.includes(ai.answer[0])) return dec("UNVERIFIED", keyLabel ? "NEEDS_REVIEW" : "NO_ANSWER", keyLabel ? keyOrigin(i.keySource) : "NONE", keyLabel ? [keyLabel] : null, null, NOT_VERIFIED_TEXT);

  if (ai && keyLabel) {
    if (ai.answer[0] === keyLabel) {
      if (ai.confidence === "low") return dec("PROPOSED", "NEEDS_REVIEW", keyOrigin(i.keySource), [keyLabel], "low", "Kalit AI taklifi bilan mos, lekin AI ishonchi past.");
      return dec("CONFIRMED", "READY", keyOrigin(i.keySource), [keyLabel], ai.confidence, "Fayldagi kalit mustaqil AI tekshiruvi bilan mos keldi.");
    }
    if (ai.confidence === "low") return dec("PROPOSED", "NEEDS_REVIEW", keyOrigin(i.keySource), [keyLabel], "low", `AI boshqa javob (${ai.answer[0]}) taklif qildi, lekin ishonchi past. Fayldagi kalit: ${keyLabel}.`);
    return dec("CONFLICT", "CONFLICT", keyOrigin(i.keySource), [keyLabel], ai.confidence, `Fayldagi kalit (${keyLabel}) va AI tekshiruvi (${ai.answer[0]}) farq qiladi.`);
  }
  if (ai) {
    const origin: AnswerOrigin = i.support ?? "AI";
    if (ai.confidence === "high" && i.support) return dec("PROPOSED", "READY", origin, ai.answer, "high", "Javob AI taklifi, haqiqiy manba bilan qo'llab-quvvatlandi: o'zingiz tekshirib tasdiqlang.");
    if (ai.confidence === "low") return dec("NOT_FOUND", "NO_ANSWER", "NONE", null, "low", NOT_VERIFIED_TEXT);
    return dec("PROPOSED", "NEEDS_REVIEW", origin, ai.answer, ai.confidence, "Javob faqat AI taklifi: manba bilan tasdiqlanmagan.");
  }
  if (keyLabel) return dec("PROPOSED", "NEEDS_REVIEW", keyOrigin(i.keySource), [keyLabel], null, i.aiTried ? "Fayldagi kalit; AI mustaqil javob bera olmadi." : "Fayldagi kalit; mustaqil tekshirilmadi (AI ulanmagan yoki hali tekshirilmagan).");
  return dec("NOT_FOUND", "NO_ANSWER", "NONE", null, null, NOT_VERIFIED_TEXT);
}

// ---------- kalitni savollarga bog'lash ----------
/** explanation: kalit yozuvida javob yonida berilgan izoh (bo'lsa). */
export type KeyMatch = { key: string[] | null; keySource: "INLINE" | "SEPARATE_FILE" | null; conflict?: string; explanation?: string };

/**
 * Savollar (raqami va bo'limi bilan) va kalit yozuvlarini moslashtiradi. Savol yonidagi javob (INLINE) va alohida kalit farq qilsa, ziddiyat qaydi qo'shiladi.
 * Bo'limlar soni mos kelmasa va raqamlar takrorlansa, noto'g'ri bog'lamaslik uchun faqat birinchi bo'lim kalit oladi.
 */
/** Test sarlavhasini solishtirish uchun me'yorlash: harf va raqamlar, kichik harf («Diagnostika testi Kuzgi No: 1» == «diagnostika testi kuzgi no 1»). */
export const normGroup = (g: string | null | undefined) => (g ?? "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
const lastNumber = (s: string) => /(\d+)\D*$/.exec(s)?.[1] ?? null;

export function matchKeys(qs: { number: number | null; section: number; inlineAnswer: string[] | null; group?: string | null }[], entries: KeyEntry[]): KeyMatch[] {
  // Sarlavhali kalit jadvallari (ko'p testli to'plamlar): kalit savolning o'z testi bo'yicha topiladi, taxminiy bo'limlar bo'yicha emas.
  const grouped = new Map<string, Map<number, KeyEntry>>();
  for (const e of entries) if (e.group) { const g = normGroup(e.group); if (g) (grouped.get(g) ?? grouped.set(g, new Map()).get(g)!).set(e.number, e); }
  const byGroup = (group: string | null | undefined, number: number): KeyEntry | null => {
    const g = normGroup(group);
    if (!g || !grouped.size) return null;
    const direct = grouped.get(g);
    if (direct) return direct.get(number) ?? null;
    // Sarlavha biroz boshqacha yozilgan bo'lsa: oxirgi raqami bir xil yagona kalit jadvali
    const n = lastNumber(g);
    const same = n ? [...grouped.entries()].filter(([k]) => lastNumber(k) === n) : [];
    return same.length === 1 ? same[0][1].get(number) ?? null : null;
  };
  const secs = keySectionEntries(entries.filter((e) => !e.group));
  const qSections = [...new Set(qs.map((q) => q.section))].sort((a, b) => a - b);
  const mapSection = (qSec: number): number | null => {
    if (!secs.length) return null;
    if (secs.length === qSections.length) return qSections.indexOf(qSec);
    if (secs.length === 1) return qSections.length === 1 || qSections.indexOf(qSec) === 0 ? 0 : null;
    const k = qSections.indexOf(qSec);
    return k >= 0 && k < secs.length ? k : null;
  };
  return qs.map((q) => {
    const found = q.number === null ? null : q.group && grouped.size ? byGroup(q.group, q.number) : (() => { const si = mapSection(q.section); return si === null ? null : secs[si]?.get(q.number as number) ?? null; })();
    const fromFile = found?.answers ?? null;
    const explanation = found?.explanation ? { explanation: found.explanation } : {};
    if (q.inlineAnswer && fromFile) {
      const eq = same([...q.inlineAnswer].sort(), [...fromFile].sort());
      // Izoh javobga tegishli: kalit bilan javob farq qilsa, izoh boshqa javobni tushuntirgani uchun olinmaydi.
      return { key: q.inlineAnswer, keySource: "INLINE" as const, ...(eq ? explanation : { conflict: `Savol yonidagi javob (${q.inlineAnswer.join(",")}) va javoblar kaliti (${fromFile.join(",")}) farq qiladi.` }) };
    }
    if (q.inlineAnswer) return { key: q.inlineAnswer, keySource: "INLINE" as const };
    if (fromFile) return { key: fromFile, keySource: "SEPARATE_FILE" as const, ...explanation };
    return { key: null, keySource: null };
  });
}

// ---------- umumiy yordamchilar ----------
const normText = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
/** Savol va variantlar mazmuni bo'yicha xesh (dublikatlarni aniqlash). */
export const contentHash = (text: string, options: Opt[]) => createHash("sha1").update(normText(text) + "|" + options.map((o) => normText(o.text)).join("|")).digest("hex").slice(0, 24);

/** Ikki matnning so'z o'xshashligi (Dice, 0..1): mavjud global savollar bilan taqqoslash uchun. */
export function similarity(a: string, b: string): number {
  const ta = new Set(normText(a).split(" ").filter((w) => w.length > 2)), tb = new Set(normText(b).split(" ").filter((w) => w.length > 2));
  if (!ta.size || !tb.size) return 0;
  let inter = 0; for (const w of ta) if (tb.has(w)) inter++;
  return (2 * inter) / (ta.size + tb.size);
}

/** Fan/mavzu taxminini bazadagi nomlarga moslaydi: ishonchli moslik bo'lmasa null (foydalanuvchi o'zi tanlaydi). */
export function matchTopic<T extends { id: string; name: string; subject: string }>(guess: { subject?: string | null; topic?: string | null }, topics: T[]): T | null {
  const wantT = guess.topic ? normText(guess.topic) : "", wantS = guess.subject ? normText(guess.subject) : "";
  if (!wantT && !wantS) return null;
  let best: { t: T; score: number } | null = null;
  for (const t of topics) {
    const st = similarity(t.name, wantT), ss = wantS ? similarity(t.subject, wantS) : 0;
    const exact = wantT && normText(t.name) === wantT ? 1 : 0;
    const score = Math.max(exact, st) * (wantS ? 0.7 + 0.3 * ss : 1);
    if (score > (best?.score ?? 0)) best = { t, score };
  }
  return best && best.score >= 0.5 ? best.t : null;
}

export const FALLBACK_SUBJECT = { slug: "shaxsiy-testlar", name: "Shaxsiy testlar" };
export const FALLBACK_TOPIC = { slug: "shaxsiy-tasniflanmagan", name: "Tasniflanmagan (yuklangan testlar)" };
