import { ApiError, requireVerified } from "../auth";
import { db } from "../db";
import { getSettings } from "../settings";
import { SETTING_DEFAULTS } from "../settingsdef";
import type { Source } from "../../lib/websources";
import { checkRate } from "./gateway";
import { analyzeQuery, refineQuery } from "./intent";
import { kbStrong, questionTokenCount, searchKnowledge } from "./kb";
import { runAnyAi } from "./structured";
import { creditsThisMonth, tavilyConfigured, tavilyMonthlyCap, tavilyRemoteUsage, tavilySearch } from "./tavily";
import { OFFICIAL_DOMAINS, hasOfficial, rankHits } from "./trust";
import { GEMINI_NOTE, buildContext, geminiBody, hasCitations, materialAnswer, matchMaterial, parseGemini, snippetsAnswer, strictPrompt, trustNote, utcDayStart, utcMonthStart } from "./websearchlogic";

export { tavilyConfigured };

/**
 * Yagona AI oqimiga internet qidiruvi. Tartib:
 *  1) tekshirilgan bilim bazasi (admin kiritgan rasmiy ma'lumot, tasdiqlangan kutubxona): topilsa va yangilik muhim bo'lmasa, internetga chiqilmaydi;
 *  2) Tavily (asosiy; avval keshdan; rasmiy so'rovlarda avval rasmiy domenlar): natijalar ishonchlilik bo'yicha tartiblanadi;
 *  3) mavjud AI faqat manbalarga tayanib javob yozadi; tayyor material so'ralsa, hech narsa yaratilmaydi: topilgan havolalar va moslik ko'rsatiladi;
 *  4) Tavily ishlamasa yoki chegaraga yetsa, Gemini + Google Search (ulangan bo'lsa).
 * Kalitlar faqat muhit o'zgaruvchilarida.
 */
const GEMINI = "https://generativelanguage.googleapis.com/v1beta";
/** Bepul rejada Google Search faqat 2.5 Flash/Flash-Lite uchun (kuniga 500 ta); 3.x modellarda pullik reja kerak. */
export const geminiModel = () => process.env.GEMINI_MODEL || "gemini-2.5-flash";
export const geminiConfigured = () => Boolean(process.env.GEMINI_API_KEY);
export const webSearchConfigured = () => geminiConfigured() || tavilyConfigured();
const geminiDailyCap = () => Math.max(1, Number(process.env.GEMINI_SEARCH_DAILY_CAP) || 400);

export type WebEngine = "kb" | "tavily" | "cache" | "gemini";
export type WebResult = { text: string; sources: Source[]; queries: string[]; engine: WebEngine; model: string; official: boolean; material: boolean; found: boolean };
type Msg = { role: "user" | "assistant"; content: string };
export type WebOpts = { /** Foydalanuvchi "Internetdan qidirish"ni aniq yoqqan: bilim bazasi bilan cheklanmaydi. */ force?: boolean; origin?: string };

async function webSettings() {
  try { const s = await getSettings(); return { enabled: s.ai.enabled, limit: s.ai.webDailyLimit, perMinute: s.ai.perMinute, auto: s.ai.webAuto }; }
  catch (e) { console.error("web limits", (e as Error).message); const d = SETTING_DEFAULTS.ai; return { enabled: d.enabled, limit: d.webDailyLimit, perMinute: d.perMinute, auto: d.webAuto }; }
}

/** Bugun foydalanuvchi qancha qidiruvli savol bergan (internetdan javob olgan): limit sarfi. Bilim bazasidan berilgan javoblar hisoblanmaydi. */
export async function webUsageToday(userId: string) {
  const [used, w] = await Promise.all([
    db.aiRequest.count({ where: { userId, feature: "web-search", status: "ok", createdAt: { gte: utcDayStart() } } }),
    webSettings(),
  ]);
  return { used, limit: w.limit, remaining: Math.max(0, w.limit - used), auto: w.auto };
}

const record = (userId: string, model: string, status: string, latencyMs: number, input = 0, output = 0) =>
  db.aiRequest.create({ data: { userId, feature: "web-search", model, status, latencyMs, inputTokens: input, outputTokens: output, promptVersion: "websearch@2" } }).catch(() => undefined);

/** Manbalar asosida javob: AI ulangan bo'lsa shu yozadi, aks holda topilgan parchalar ko'rsatiladi (to'qima javob yo'q). */
async function strictAnswer(userId: string, question: string, built: ReturnType<typeof buildContext>) {
  try {
    const p = strictPrompt(question, built.context);
    const r = await runAnyAi({ userId, feature: "chat", messages: [{ role: "user", content: p.user }], system: p.system, maxTokens: 1200, promptVersion: "websearch-strict@1" });
    return { text: hasCitations(r.text) ? r.text : `${r.text}\n\n(Manbalar quyida keltirilgan.)`, model: r.model };
  } catch (e) {
    console.error("Manbali javob:", (e as Error).message);
    return { text: snippetsAnswer(built.items), model: "-" };
  }
}

async function askGemini(messages: Msg[]) {
  const model = geminiModel();
  try {
    const res = await fetch(`${GEMINI}/models/${encodeURIComponent(model)}:generateContent`, {
      method: "POST", signal: AbortSignal.timeout(28_000),
      headers: { "content-type": "application/json", "x-goog-api-key": process.env.GEMINI_API_KEY ?? "" }, body: JSON.stringify(geminiBody(messages)),
    });
    if (!res.ok) { console.error("Gemini qidiruvi xato:", res.status); return { ok: false as const, status: res.status }; }
    const json = (await res.json()) as { usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number } };
    const parsed = parseGemini(json);
    if (!parsed) return { ok: false as const, status: 0 };
    return { ok: true as const, ...parsed, model, input: json.usageMetadata?.promptTokenCount ?? 0, output: json.usageMetadata?.candidatesTokenCount ?? 0 };
  } catch (e) { console.error("Gemini qidiruvi:", (e as Error).name); return { ok: false as const, status: 0 }; }
}

export async function runWebSearch(userId: string, messages: Msg[], opts: WebOpts = {}): Promise<WebResult> {
  if (!webSearchConfigured()) throw new ApiError(503, "Internetdan qidirish hali ulanmagan (TAVILY_API_KEY yoki GEMINI_API_KEY yo'q).", "web_unconfigured");
  await requireVerified(userId);
  const w = await webSettings();
  if (!w.enabled) throw new ApiError(503, "AI xizmati administrator tomonidan vaqtincha o'chirilgan.", "ai_disabled");
  await checkRate(userId, w.perMinute);
  const question = ([...messages].reverse().find((m) => m.role === "user")?.content ?? "").trim();
  if (!question) throw new ApiError(400, "Savol bo'sh bo'lmasin.");
  const intent = analyzeQuery(question);
  const origin = opts.origin ?? "";
  const t0 = Date.now();

  // 1) Tekshirilgan bilim bazasi
  const kb = await searchKnowledge(question, origin);
  // Baza yetarli bo'lsa va (yangilik muhim bo'lmasa yoki yozuv yaqinda tekshirilgan bo'lsa), internetga chiqilmaydi: kredit tejaladi.
  const strong = kb.some((h) => kbStrong(h, questionTokenCount(question)) && (!intent.needsFresh || h.fresh));
  if (strong && !opts.force && !intent.wantsMaterial && !intent.explicit) {
    const built = buildContext(kb, [], origin);
    if (built.items.length) {
      const a = await strictAnswer(userId, question, built);
      await record(userId, "kb", "kb", Date.now() - t0);
      return { text: a.text, sources: built.sources, queries: [], engine: "kb", model: a.model, official: true, material: false, found: true };
    }
  }

  // Internetga chiqish: foydalanuvchi limiti
  const used = await db.aiRequest.count({ where: { userId, feature: "web-search", status: "ok", createdAt: { gte: utcDayStart() } } });
  if (used >= w.limit) throw new ApiError(429, `Bugungi internetdan qidirish limiti tugadi (${w.limit} ta). Oddiy AI bilan savol berishingiz yoki ertaga urinib ko'rishingiz mumkin.`, "web_daily_limit");

  // 2) Tavily (asosiy)
  if (tavilyConfigured()) {
    const query = refineQuery(question, intent);
    const fresh = intent.needsFresh;
    let res = intent.officialLike && !intent.wantsMaterial ? await tavilySearch(userId, query, { includeDomains: OFFICIAL_DOMAINS, fresh }) : null;
    if (!res || res.hits.length === 0) res = await tavilySearch(userId, query, { fresh });
    if (res) {
      const ranked = rankHits(res.hits, 8);
      const engine: WebEngine = res.cached ? "cache" : "tavily";
      // Tayyor material: hech narsa yaratilmaydi, mavjud manbalar va moslik ko'rsatiladi.
      if (intent.wantsMaterial) {
        const m = materialAnswer(intent.spec, ranked.map((r) => matchMaterial(r, intent.spec)));
        await record(userId, engine, "ok", Date.now() - t0);
        return { text: m.text, sources: m.sources, queries: [], engine, model: engine, official: hasOfficial(ranked), material: true, found: m.found };
      }
      const built = buildContext(kb, ranked, origin);
      if (!built.items.length) { await record(userId, engine, "ok", Date.now() - t0); throw new ApiError(404, "Internetdan mos ma'lumot topilmadi. Savolni boshqacha yozib ko'ring.", "web_no_results"); }
      const a = await strictAnswer(userId, question, built);
      await record(userId, engine, "ok", Date.now() - t0);
      return { text: `${a.text}${trustNote(built.sources)}`, sources: built.sources, queries: [], engine, model: a.model, official: hasOfficial(ranked) || kb.length > 0, material: false, found: true };
    }
  }

  // 3) Gemini + Google Search (zaxira)
  if (geminiConfigured() && (await db.aiRequest.count({ where: { feature: "web-search", status: "ok", model: { startsWith: "gemini" }, createdAt: { gte: utcDayStart() } } })) < geminiDailyCap()) {
    const g = await askGemini(messages);
    if (g.ok) {
      await record(userId, g.model, "ok", Date.now() - t0, g.input, g.output);
      return { text: g.text + GEMINI_NOTE, sources: g.sources, queries: g.queries, engine: "gemini", model: g.model, official: false, material: false, found: true };
    }
    await record(userId, geminiModel(), g.status === 429 ? "quota" : "error", Date.now() - t0);
  }
  throw new ApiError(503, "Internetdan qidirish hozir mavjud emas. Birozdan so'ng urinib ko'ring yoki oddiy AI bilan savol bering.", "web_unavailable");
}

/**
 * Admin "ulanishni sinash": Gemini kalitini qidiruvsiz (kvota sarflamaydigan) qisqa so'rov bilan tekshiradi.
 * Tavily'ga qidiruv so'rovi yuborilmaydi (kredit sarflaydi): faqat ulanganligi va /usage (kreditsiz) ko'rsatiladi.
 */
export async function webHealth() {
  const gemini: { configured: boolean; model: string | null; ok?: boolean; ms?: number; error?: string } = { configured: geminiConfigured(), model: geminiConfigured() ? geminiModel() : null };
  if (gemini.configured) {
    const t0 = Date.now();
    try {
      const res = await fetch(`${GEMINI}/models/${encodeURIComponent(geminiModel())}:generateContent`, {
        method: "POST", signal: AbortSignal.timeout(15_000), headers: { "content-type": "application/json", "x-goog-api-key": process.env.GEMINI_API_KEY ?? "" },
        body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: "ping" }] }], generationConfig: { maxOutputTokens: 5 } }),
      });
      gemini.ok = res.ok; if (!res.ok) gemini.error = String(res.status);
    } catch (e) { gemini.ok = false; gemini.error = (e as Error).name; }
    gemini.ms = Date.now() - t0;
  }
  return { gemini, tavily: { configured: tavilyConfigured() } };
}

/** Admin panel uchun: Tavily ulanishi, kreditlar, kesh va limitlar. Kalit qaytarilmaydi. */
export async function webStats() {
  const now = new Date();
  const safe = <T>(p: Promise<T>, d: T) => p.catch(() => d);
  const [credits, today, cacheHits, kbAnswers, geminiToday, entries, remote, w] = await Promise.all([
    safe(creditsThisMonth(now), 0),
    safe(db.aiRequest.count({ where: { feature: "web-search", status: "ok", createdAt: { gte: utcDayStart(now) } } }), 0),
    safe(db.aiRequest.count({ where: { feature: "web-search", model: "cache", status: "ok", createdAt: { gte: utcMonthStart(now) } } }), 0),
    safe(db.aiRequest.count({ where: { feature: "web-search", status: "kb", createdAt: { gte: utcMonthStart(now) } } }), 0),
    safe(db.aiRequest.count({ where: { feature: "web-search", status: "ok", model: { startsWith: "gemini" }, createdAt: { gte: utcDayStart(now) } } }), 0),
    safe(db.webSearchCache.count(), 0),
    tavilyRemoteUsage(),
    webSettings(),
  ]);
  const cap = tavilyMonthlyCap();
  return {
    tavily: { configured: tavilyConfigured(), creditsMonth: credits, monthlyCap: cap, remaining: Math.max(0, cap - credits), remote },
    gemini: { configured: geminiConfigured(), model: geminiConfigured() ? geminiModel() : null, today: geminiToday, dailyCap: geminiDailyCap() },
    searchesToday: today, cacheHitsMonth: cacheHits, kbAnswersMonth: kbAnswers, cacheEntries: entries,
    perUserLimit: w.limit, auto: w.auto,
  };
}
