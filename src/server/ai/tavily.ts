import { createHash } from "node:crypto";
import { db } from "../db";
import { utcMonthStart } from "./websearchlogic";
import type { Hit } from "./trust";

/**
 * Tavily Search API mijozi. Kalit faqat serverda (TAVILY_API_KEY). Natijalar vaqtincha keshlanadi (bir xil savol kreditni qayta sarflamaydi),
 * har bir haqiqiy API so'rovi "web-credit" qatori bilan hisoblanadi (admin panelda sarflangan kreditlar).
 * TAVILY_API_BASE faqat mahalliy sinov uchun (soxta server); ishlab chiqarishda o'rnatilmaydi.
 */
const base = () => process.env.TAVILY_API_BASE?.replace(/\/+$/, "") || "https://api.tavily.com";
export const tavilyConfigured = () => Boolean(process.env.TAVILY_API_KEY);
/** Bepul reja oyiga 1000 kredit: biroz past chegara (zaxira) qo'yiladi. */
export const tavilyMonthlyCap = () => Math.max(1, Number(process.env.TAVILY_MONTHLY_CAP) || 900);

const TTL = { normal: 12 * 3_600_000, fresh: 3 * 3_600_000 };

export type SearchOpts = { includeDomains?: string[]; fresh?: boolean };
export type SearchResult = { hits: Hit[]; cached: boolean };

export function cacheKey(query: string, o: SearchOpts = {}): string {
  const q = query.toLowerCase().replace(/\s+/g, " ").trim();
  return createHash("sha256").update(`v1|${q}|${(o.includeDomains ?? []).slice().sort().join(",")}|${o.fresh ? "f" : "n"}`).digest("hex");
}

async function cacheGet(key: string, ttl: number): Promise<Hit[] | null> {
  try {
    const r = await db.webSearchCache.findUnique({ where: { key } });
    if (!r || Date.now() - r.createdAt.getTime() > ttl || !Array.isArray(r.results)) return null;
    return r.results as unknown as Hit[];
  } catch (e) { console.error("Qidiruv keshi o'qilmadi:", (e as Error).message); return null; }
}

async function cachePut(key: string, query: string, hits: Hit[]) {
  try {
    const results = hits as unknown as object;
    await db.webSearchCache.upsert({ where: { key }, create: { key, query: query.slice(0, 400), results }, update: { query: query.slice(0, 400), results, createdAt: new Date() } });
    if (Math.random() < 0.03) await db.webSearchCache.deleteMany({ where: { createdAt: { lt: new Date(Date.now() - 7 * 86_400_000) } } });
  } catch (e) { console.error("Qidiruv keshi yozilmadi:", (e as Error).message); }
}

/** Shu oyda sarflangan Tavily kreditlari (haqiqiy API so'rovlari; keshdan berilganlari hisoblanmaydi). */
export const creditsThisMonth = (now = new Date()) =>
  db.aiRequest.count({ where: { feature: "web-credit", model: "tavily", status: "ok", createdAt: { gte: utcMonthStart(now) } } });

/**
 * Qidiradi: avval kesh, keyin (oylik chegaradan oshmasa) Tavily. null: ulanmagan, chegaraga yetgan yoki xizmat xato bergan.
 * `userId` faqat kredit qatorini kimga bog'lashni bildiradi.
 */
export async function tavilySearch(userId: string, query: string, opts: SearchOpts = {}): Promise<SearchResult | null> {
  if (!tavilyConfigured()) return null;
  const key = cacheKey(query, opts);
  const cached = await cacheGet(key, opts.fresh ? TTL.fresh : TTL.normal);
  if (cached) return { hits: cached, cached: true };
  if ((await creditsThisMonth()) >= tavilyMonthlyCap()) return null;

  const t0 = Date.now();
  try {
    const res = await fetch(`${base()}/search`, {
      method: "POST", signal: AbortSignal.timeout(15_000),
      headers: { "content-type": "application/json", authorization: `Bearer ${process.env.TAVILY_API_KEY}` },
      body: JSON.stringify({
        query, search_depth: "basic", max_results: 8, topic: "general", include_answer: false,
        ...(opts.includeDomains?.length && { include_domains: opts.includeDomains }), ...(opts.fresh && { time_range: "year" }),
      }),
    });
    if (!res.ok) { console.error("Tavily xato:", res.status); return null; }
    const j = (await res.json()) as { results?: Hit[] };
    const hits = Array.isArray(j.results) ? j.results : [];
    await db.aiRequest.create({ data: { userId, feature: "web-credit", model: "tavily", status: "ok", latencyMs: Date.now() - t0, promptVersion: "tavily-basic" } }).catch(() => undefined);
    if (hits.length) await cachePut(key, query, hits);
    return { hits, cached: false };
  } catch (e) { console.error("Tavily:", (e as Error).name); return null; }
}

/** Tavily hisobidagi haqiqiy sarf (kredit sarflamaydigan /usage). Javob shakli o'zgargan yoki xato bo'lsa null: panel o'zining hisobini ko'rsatadi. */
export async function tavilyRemoteUsage(): Promise<{ used: number; limit: number | null; plan: string | null } | null> {
  if (!tavilyConfigured()) return null;
  try {
    const res = await fetch(`${base()}/usage`, { signal: AbortSignal.timeout(8_000), headers: { authorization: `Bearer ${process.env.TAVILY_API_KEY}` } });
    if (!res.ok) return null;
    const j = (await res.json()) as { account?: { current_plan?: string; plan_usage?: number; plan_limit?: number | null }; key?: { usage?: number; limit?: number | null } };
    const used = j.account?.plan_usage ?? j.key?.usage;
    if (typeof used !== "number") return null;
    const limit = j.account?.plan_limit ?? j.key?.limit;
    return { used, limit: typeof limit === "number" ? limit : null, plan: j.account?.current_plan ?? null };
  } catch { return null; }
}
