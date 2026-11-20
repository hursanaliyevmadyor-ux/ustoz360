import type { Bg } from "./board";

/**
 * Fan sozlamalari: xona yaratishda fan tanlanadi, doska va asboblar shu fanga mos boshlanadi
 * (orqa fon, belgilar to'plami, birinchi ko'rsatiladigan shablonlar, qisqa maslahat). Faqat qulaylik: hech narsani cheklamaydi.
 */
export type SymbolGroup = "mat" | "fiz" | "kim" | "til" | "ipa";
export type Subject = { key: string; label: string; bg: Bg; sym: SymbolGroup; tpl: readonly string[]; tip: string };

export const SUBJECTS = [
  { key: "math", label: "Matematika", bg: "grid", sym: "mat", tpl: ["axes", "fraction", "columns", "numline", "table"], tip: "«Grafik» tugmasi formulani koordinata tekisligida chizadi. Shablonlar: kasr, ustun-hisob, sonlar o'qi." },
  { key: "physics", label: "Fizika", bg: "grid", sym: "fiz", tpl: ["circuit", "forces", "axes", "table"], tip: "Elektr zanjiri va kuchlar shablonlari, grafik (tezlik, yo'l) chizish, Ω μ λ belgilari." },
  { key: "chem", label: "Kimyo", bg: "plain", sym: "kim", tpl: ["reaction", "table", "concept"], tip: "H₂O, SO₄²⁻ kabi pastki va yuqori indekslar, → ⇌ ↑ ↓ belgilari, reaksiya shabloni." },
  { key: "bio", label: "Biologiya", bg: "plain", sym: "kim", tpl: ["cell", "concept", "venn", "table"], tip: "Hujayra shabloni, tushuncha xaritasi, Venn diagrammasi; rasm yoki sxemani «Rasm» tugmasi bilan qo'ying." },
  { key: "geo", label: "Geografiya", bg: "plain", sym: "mat", tpl: ["table", "concept", "timeline"], tip: "Xarita rasmini «Rasm» tugmasi bilan qo'ying, ustidan marker va strelka bilan ko'rsating." },
  { key: "hist", label: "Tarix", bg: "plain", sym: "mat", tpl: ["timeline", "concept", "kwl", "table"], tip: "Vaqt chizig'i shabloni: voqealarni sana bilan joylashtiring; xarita yoki rasmni «Rasm» bilan qo'ying." },
  { key: "uz", label: "Ona tili va adabiyot", bg: "lines", sym: "til", tpl: ["tchart", "concept", "table"], tip: "Marker bilan so'zni belgilang, rang bilan gap bo'laklarini ajrating; oʻ, gʻ belgilari tayyor." },
  { key: "en", label: "Ingliz tili", bg: "writing", sym: "ipa", tpl: ["tchart", "kwl", "table", "concept"], tip: "4 chiziqli yozuv foni, transkripsiya belgilari (ʃ θ ð ŋ), T-jadval va KWL shablonlari." },
  { key: "ru", label: "Rus tili", bg: "lines", sym: "til", tpl: ["tchart", "concept", "table"], tip: "Chiziqli fon, matnni marker bilan belgilash, rangli ajratish." },
  { key: "it", label: "Informatika", bg: "plain", sym: "mat", tpl: ["flow", "table", "concept"], tip: "Blok-sxema shabloni (algoritm); kod yoki dasturni ekran ulashish bilan ko'rsating." },
  { key: "primary", label: "Boshlang'ich sinf", bg: "lines", sym: "mat", tpl: ["numline", "columns", "table"], tip: "Stikerlar (⭐ ✅ 👏), sonlar o'qi, ustun-hisob; o'quvchilarga ⭐ rag'bat bering." },
  { key: "music", label: "Musiqa", bg: "staff", sym: "mat", tpl: ["table", "concept"], tip: "Nota yo'li foni: notalarni qalam bilan yozing, stikerlar bilan belgilang." },
  { key: "art", label: "Tasviriy san'at", bg: "plain", sym: "mat", tpl: ["concept"], tip: "Qalam, marker va 12 rang; namunani «Rasm» bilan qo'yib, ustidan chizing." },
  { key: "other", label: "Boshqa fan", bg: "plain", sym: "mat", tpl: ["table", "concept"], tip: "Barcha asboblar mavjud: shakllar, matn, stikerlar, shablonlar." },
] as const satisfies readonly Subject[];
export type SubjectKey = (typeof SUBJECTS)[number]["key"];

export const isSubject = (v: unknown): v is SubjectKey => typeof v === "string" && SUBJECTS.some((s) => s.key === v);
export const subjectOf = (v: unknown): Subject | null => (isSubject(v) ? SUBJECTS.find((s) => s.key === v) ?? null : null);

/** Belgilar to'plamlari (doskadagi matn maydonida tugmalar). */
export const SYMBOL_TABS: Record<SymbolGroup, { name: string; items: readonly string[] }> = {
  mat: { name: "Matematika", items: ["²", "³", "√", "∛", "π", "½", "⅓", "¼", "¾", "≠", "≈", "≤", "≥", "±", "×", "÷", "°", "∞", "∠", "⊥", "∥", "Δ", "∑", "∫", "∈", "∪", "∩", "⊂", "→", "⇒", "⇔", "∀", "∃", "α", "β", "γ", "φ", "θ", "λ"] },
  fiz: { name: "Fizika", items: ["Ω", "μ", "λ", "ρ", "τ", "φ", "ω", "Δ", "α", "β", "γ", "η", "ε", "σ", "θ", "π", "°C", "²", "³", "⁻¹", "⁻²", "×", "÷", "±", "≈", "→", "⃗", "∞", "√", "₀", "₁", "₂"] },
  kim: { name: "Kimyo", items: ["₀", "₁", "₂", "₃", "₄", "₅", "₆", "₇", "₈", "₉", "⁺", "⁻", "²⁺", "³⁺", "²⁻", "→", "⇌", "↑", "↓", "Δ", "°C", "·", "α", "β", "γ", "μ", "×", "±", "≈", "%"] },
  til: { name: "Til", items: ["oʻ", "gʻ", "ʼ", "ʻ", "–", "—", "«", "»", "…", "ё", "й", "ц", "ъ", "ь", "щ", "ç", "ş", "ğ", "ı", "ö", "ü", "é", "á", "§", "№", "°"] },
  ipa: { name: "Transkripsiya", items: ["ʃ", "ʒ", "θ", "ð", "ŋ", "tʃ", "dʒ", "ɪ", "iː", "e", "æ", "ʌ", "ɑː", "ɒ", "ɔː", "ʊ", "uː", "ə", "ɜː", "eɪ", "aɪ", "ɔɪ", "əʊ", "aʊ", "ˈ", "ˌ", "ː"] },
};
export const SYMBOL_ORDER: readonly SymbolGroup[] = ["mat", "fiz", "kim", "til", "ipa"];
