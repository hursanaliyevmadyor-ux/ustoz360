/**
 * Gemini model nomini tanlash (toza funksiyalar, testlanadi). Model nomlari kodga qattiq bog'lanmaydi: sozlangan nom mavjud bo'lmasa (404),
 * kvotasi tugagan bo'lsa (429) yoki band bo'lsa (503), kalit ko'ra oladigan modellar ro'yxatidan keyingi mosi sinaladi: avval eng yangi barqaror
 * «flash», so'ng eskiroq «flash» va «flash-lite» (murakkab ish uchun «pro», so'ng «flash»).
 */
export type GeminiModelInfo = { name?: string; supportedGenerationMethods?: string[] };

const BAD = /(tts|image|embed|live|audio|robotics|computer|vision|learnlm|nano|8b|customtools|thinking-exp|-exp)/i;

function versionOf(name: string): number {
  const m = /^gemini-(\d+(?:\.\d+)?)/.exec(name);
  return m ? parseFloat(m[1]) : 0;
}

/** Ro'yxatdan mos modellar, eng yaxshisidan boshlab (tezkor ish: flash, so'ng lite; murakkab ish: pro, so'ng flash). */
export function rankGeminiModels(models: GeminiModelInfo[], heavy: boolean): string[] {
  const names = models
    .filter((m) => m.name && (m.supportedGenerationMethods ?? []).includes("generateContent"))
    .map((m) => (m.name as string).replace(/^models\//, ""))
    .filter((n) => /^gemini-\d/.test(n) && !BAD.test(n));
  const rank = (n: string) => {
    const kind = heavy ? (/pro/.test(n) ? 2 : /flash/.test(n) && !/lite/.test(n) ? 1 : 0) : /flash/.test(n) && !/lite/.test(n) ? 2 : /lite/.test(n) ? 1 : 0;
    return { kind, stable: /preview|latest/.test(n) ? 0 : 1, v: versionOf(n) };
  };
  const ok = [...new Set(names)].filter((n) => rank(n).kind > 0);
  ok.sort((a, b) => { const x = rank(a), y = rank(b); return y.kind - x.kind || y.stable - x.stable || y.v - x.v || a.length - b.length; });
  return ok;
}

/** Ro'yxatdan mos modelni tanlaydi. null: mos model topilmadi. */
export function pickGeminiModel(models: GeminiModelInfo[], heavy: boolean): string | null {
  return rankGeminiModels(models, heavy)[0] ?? null;
}

/**
 * Xatodan keyin model qancha vaqt chetga qo'yiladi (shu vaqt ichida boshqa model sinaladi). null: bu model uchun bunday xato emas
 * (masalan, noto'g'ri so'rov yoki kalit): modelni almashtirish yordam bermaydi.
 */
export type Cooldown = { ms: number; reason: "gone" | "quota" | "busy" };
export function geminiCooldown(status: number, message = ""): Cooldown | null {
  if (status === 404) return { ms: 6 * 3_600_000, reason: "gone" }; // model endi mavjud emas (yoki yangi foydalanuvchilarga yopilgan)
  if (status === 429) {
    // «check your plan and billing» / limit 0: model bepul rejada yo'q yoki kvota tugagan: uzoqroq; oddiy daqiqalik chegara: qisqa.
    const hard = /plan and billing|limit:\s*0|per\s*day|daily|PerDay/i.test(message);
    return { ms: hard ? 30 * 60_000 : 90_000, reason: "quota" };
  }
  if ([500, 502, 503, 504].includes(status)) return { ms: 45_000, reason: "busy" }; // «high demand»: vaqtinchalik
  return null;
}
