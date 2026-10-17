/** AI shlyuzining toza qismi (bazaga tegmaydi, test qilinadi). */

/** Narx mikro-dollarda: tokenlar * (USD / 1 mln token) = mikro-dollar. Narx 0 bo'lsa hisoblanmaydi (null). */
export function costMicro(inputTokens: number, outputTokens: number, priceInPerMTok: number, priceOutPerMTok: number): number | null {
  if (!priceInPerMTok && !priceOutPerMTok) return null;
  return Math.round(inputTokens * priceInPerMTok + outputTokens * priceOutPerMTok);
}

/** Qayta uriniladigan holatlar: server xatosi (5xx), 408 va 409. 429 (limit tugagan) qayta urinilmaydi: keyingi xizmatga o'tiladi. */
export const isRetryableStatus = (s: number) => s >= 500 || s === 408;

/** Eksponensial kutish: 600ms, 1200ms, ... (AI_RETRY_MS bilan o'zgartiriladi; testlarda 0). */
export function retryDelayMs(attempt: number): number {
  const base = process.env.AI_RETRY_MS !== undefined ? Number(process.env.AI_RETRY_MS) : 600;
  return Math.max(0, base) * 2 ** attempt;
}
