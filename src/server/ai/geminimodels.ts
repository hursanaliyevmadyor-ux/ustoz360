/**
 * Gemini model nomini tanlash (toza funksiya, testlanadi). Model nomlari kodga qattiq bog'lanmaydi: sozlangan nom mavjud bo'lmasa (404),
 * kalit ko'ra oladigan modellar ro'yxatidan eng yangi barqaror «flash» (murakkab ish uchun «pro») tanlanadi.
 */
export type GeminiModelInfo = { name?: string; supportedGenerationMethods?: string[] };

const BAD = /(tts|image|embed|live|audio|robotics|computer|vision|learnlm|nano|8b|customtools|thinking-exp|-exp)/i;

function versionOf(name: string): number {
  const m = /^gemini-(\d+(?:\.\d+)?)/.exec(name);
  return m ? parseFloat(m[1]) : 0;
}

/** Ro'yxatdan mos modelni tanlaydi. null: mos model topilmadi. */
export function pickGeminiModel(models: GeminiModelInfo[], heavy: boolean): string | null {
  const names = models
    .filter((m) => m.name && (m.supportedGenerationMethods ?? []).includes("generateContent"))
    .map((m) => (m.name as string).replace(/^models\//, ""))
    .filter((n) => /^gemini-\d/.test(n) && !BAD.test(n));
  const rank = (n: string) => {
    const kind = heavy ? (/pro/.test(n) ? 2 : /flash/.test(n) && !/lite/.test(n) ? 1 : 0) : /flash/.test(n) && !/lite/.test(n) ? 2 : /lite/.test(n) ? 1 : 0;
    return { kind, stable: /preview|latest/.test(n) ? 0 : 1, v: versionOf(n) };
  };
  const ok = names.filter((n) => rank(n).kind > 0);
  ok.sort((a, b) => { const x = rank(a), y = rank(b); return y.kind - x.kind || y.stable - x.stable || y.v - x.v || a.length - b.length; });
  return ok[0] ?? null;
}
