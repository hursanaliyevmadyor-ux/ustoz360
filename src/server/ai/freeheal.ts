import { rankGeminiModels } from "./geminimodels";

/**
 * Bepul xizmat modelini o'zi tuzatish (toza funksiyalar, testlanadi). Muhitdagi model nomi eskirsa (404) yoki kvotasi tugasa (429),
 * xizmatning o'z /models ro'yxatidan keyingi mosi tanlanadi. Faqat nomlari tez eskiradigan xostlar uchun: OpenRouter (`:free`) va Google (Gemini).
 */
export type ListedModel = { id?: string; context_length?: number };

export const healable = (host: string) => /(^|\.)openrouter\.ai$/.test(host) || /(^|\.)generativelanguage\.googleapis\.com$/.test(host);

/** Ro'yxatdan mos modellar, eng yaxshisidan boshlab: OpenRouter: `:free` va katta kontekst; Google: yangi barqaror flash, so'ng lite. */
export function rankFreeModels(host: string, items: ListedModel[]): string[] {
  const named = items.filter((m): m is ListedModel & { id: string } => typeof m.id === "string" && m.id.length > 0);
  if (/(^|\.)openrouter\.ai$/.test(host)) return named.filter((m) => /:free$/.test(m.id)).sort((a, b) => (b.context_length ?? 0) - (a.context_length ?? 0)).map((m) => m.id);
  if (/(^|\.)generativelanguage\.googleapis\.com$/.test(host)) return rankGeminiModels(named.map((m) => ({ name: m.id, supportedGenerationMethods: ["generateContent"] })), false);
  return named.map((m) => m.id);
}

/** Xatodan keyin model qancha vaqt chetga qo'yiladi. null: model almashtirish yordam bermaydi (kalit yoki so'rov xatosi). */
export function freeCooldown(status: number, message = ""): { ms: number; reason: "gone" | "quota" } | null {
  if (status === 404) return { ms: 6 * 3_600_000, reason: "gone" };
  if (status === 429) return { ms: /plan and billing|limit:\s*0|per\s*day|daily|PerDay/i.test(message) ? 30 * 60_000 : 90_000, reason: "quota" };
  return null;
}
