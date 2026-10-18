import { httpsUrl } from "../../lib/websources";

/**
 * Manba ishonchliligi: domen bo'yicha daraja. Rasmiy manba (davlat va vazirlik saytlari) birinchi o'rinda, ijtimoiy tarmoq va
 * norasmiy saytlar oxirida. Bu yakuniy haqiqat emas, balki foydalanuvchiga ko'rsatiladigan ehtiyotkorlik belgisi.
 */
export type Trust = "official" | "education" | "media" | "general" | "social";

export const TRUST_LABEL: Record<Trust, string> = {
  official: "Rasmiy manba", education: "Ta'lim portali/muassasasi", media: "Ommaviy axborot vositasi", general: "Norasmiy manba", social: "Ijtimoiy tarmoq (ishonchsiz)",
};
export const TRUST_WEIGHT: Record<Trust, number> = { official: 4, education: 3, media: 2, general: 1, social: 0 };

/** Tavily'ni faqat rasmiy saytlar bilan cheklash uchun (qonun, qaror, qoidalar kabi so'rovlarda birinchi urinish). */
export const OFFICIAL_DOMAINS = ["lex.uz", "gov.uz", "edu.uz", "dtm.uz", "uzedu.uz", "president.uz"];

const OFFICIAL = ["gov.uz", "lex.uz", "dtm.uz", "uzedu.uz", "president.uz"];
const EDUCATION = ["ziyonet.uz", "eduportal.uz", "unesco.org", "unicef.org", "worldbank.org", "ac.uz"];
const MEDIA = ["kun.uz", "daryo.uz", "gazeta.uz", "uza.uz", "xabar.uz", "podrobno.uz", "review.uz", "bbc.com", "wikipedia.org"];
const SOCIAL = ["t.me", "telegram.me", "telegram.org", "facebook.com", "fb.com", "instagram.com", "tiktok.com", "vk.com", "ok.ru", "twitter.com", "x.com", "pinterest.com", "youtube.com", "youtu.be", "reddit.com", "quora.com", "scribd.com", "slideshare.net"];

export const hostOf = (url: string): string => { try { return new URL(url).hostname.toLowerCase().replace(/^www\./, ""); } catch { return ""; } };
const under = (host: string, list: string[]) => list.some((d) => host === d || host.endsWith(`.${d}`));

export function classifyUrl(url: string): Trust {
  const host = hostOf(url);
  if (!host) return "general";
  if (host === "edu.uz") return "official"; // Maktabgacha va maktab ta'limi vazirligi
  if (under(host, OFFICIAL)) return "official";
  if (host.endsWith(".edu.uz") || under(host, EDUCATION)) return "education";
  if (under(host, SOCIAL)) return "social";
  if (under(host, MEDIA)) return "media";
  return "general";
}

export type Hit = { title?: string; url?: string; content?: string; score?: number };
export type Ranked = { title: string; url: string; content: string; score: number; trust: Trust };

/** Natijalarni ishonchlilik va qidiruv bahosi bo'yicha tartiblaydi; ijtimoiy tarmoq faqat boshqa manba bo'lmasa qoladi. */
export function rankHits(hits: Hit[], limit = 6): Ranked[] {
  const all: Ranked[] = [];
  const seen = new Set<string>();
  for (const h of hits) {
    const url = httpsUrl(h.url);
    const content = (h.content ?? "").replace(/\s+/g, " ").trim();
    if (!url || !content || seen.has(url)) continue;
    seen.add(url);
    all.push({ title: (h.title || hostOf(url)).replace(/\s+/g, " ").trim().slice(0, 140), url, content, score: typeof h.score === "number" ? h.score : 0, trust: classifyUrl(url) });
  }
  const good = all.filter((r) => r.trust !== "social");
  const pool = good.length ? good : all;
  return pool.sort((a, b) => TRUST_WEIGHT[b.trust] - TRUST_WEIGHT[a.trust] || b.score - a.score).slice(0, limit);
}

export const hasOfficial = (r: { trust: Trust }[]) => r.some((x) => x.trust === "official");
