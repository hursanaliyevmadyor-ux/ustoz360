/**
 * Internetdan qidirilgan javobning manbalari javob matniga qo'shib saqlanadi (chat tarixida ham qoladi) va ko'rsatishda ajratib olinadi.
 * Server ham, brauzer ham ishlatadi: hech narsaga bog'liq emas.
 */
/** trust: official | education | media | general | social | kb (admin tekshirgan bilim bazasi). */
export type Source = { title: string; url: string; trust?: string };
export const SOURCES_MARK = "\n\n---manbalar---\n";

export const TRUST_NAMES: Record<string, string> = {
  kb: "Tekshirilgan baza", official: "Rasmiy manba", education: "Ta'lim portali", media: "Ommaviy axborot", general: "Norasmiy manba", social: "Ijtimoiy tarmoq",
};

const clean = (s: string) => s.replace(/[\r\n|]+/g, " ").replace(/\s+/g, " ").trim();
/** Faqat https havola (javascript:, data: va boshqalar o'tmaydi). */
export const httpsUrl = (u: unknown): string | null => (typeof u === "string" && /^https:\/\/[^\s|]+$/i.test(u.trim()) ? u.trim() : null);

export function encodeSources(text: string, sources: Source[], queries: string[] = []): string {
  const lines = [
    ...sources.slice(0, 8).flatMap((s) => {
      const url = httpsUrl(s.url);
      return url ? [`S|${clean(s.title).slice(0, 120) || url}|${url}${s.trust && TRUST_NAMES[s.trust] ? `|${s.trust}` : ""}`] : [];
    }),
    ...queries.slice(0, 5).map((q) => `Q|${clean(q).slice(0, 120)}`).filter((l) => l.length > 2),
  ];
  return lines.length ? `${text}${SOURCES_MARK}${lines.join("\n")}` : text;
}

/** Oddiy matnli ko'rinish (Telegram bot kabi joylar uchun): "Manbalar:" ro'yxati. */
export function sourcesPlain(sources: Source[]): string {
  const list = sources.flatMap((s) => { const url = httpsUrl(s.url); return url ? [`${clean(s.title).slice(0, 100)}${s.trust && TRUST_NAMES[s.trust] ? ` (${TRUST_NAMES[s.trust]})` : ""}\n   ${url}`] : []; });
  return list.length ? `Manbalar:\n${list.slice(0, 6).map((l, i) => `${i + 1}. ${l}`).join("\n")}` : "";
}

export function splitSources(content: string): { text: string; sources: Source[]; queries: string[] } {
  const i = content.indexOf(SOURCES_MARK);
  if (i < 0) return { text: content, sources: [], queries: [] };
  const sources: Source[] = [], queries: string[] = [];
  for (const line of content.slice(i + SOURCES_MARK.length).split("\n")) {
    const [kind, a, b, c] = line.split("|");
    if (kind === "S") { const url = httpsUrl(b); if (url) sources.push({ title: a || url, url, ...(c && TRUST_NAMES[c] ? { trust: c } : {}) }); }
    else if (kind === "Q" && a?.trim()) queries.push(a.trim());
  }
  return { text: content.slice(0, i), sources, queries };
}
