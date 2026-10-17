import Anthropic from "@anthropic-ai/sdk";
import { ApiError, requireVerified } from "../auth";
import { db } from "../db";
import { DEFAULT_AI_DAILY, DEFAULT_FREE_AI_DAILY, getEntitlements } from "../entitlements";
import { getSettings } from "../settings";
import { SETTING_DEFAULTS } from "../settingsdef";
import { costMicro, isRetryableStatus, retryDelayMs } from "./gatewaylogic";

/**
 * AI shlyuzi: barcha AI so'rovlari shu yerdan o'tadi (Claude yoki OpenAI-mos bepul xizmatlar).
 * Limitlar (kunlik, daqiqalik), tarif, timeout, qayta urinish, jurnal (kechikish, token, narx) shu yerda.
 * Kalitlar faqat muhit o'zgaruvchilarida; xato matnlariga kalit tushmaydi.
 */
export type AiFeature = "chat" | "explain" | "lesson" | "practice" | "taskset" | "visual" | "rubric" | "plan" | "health";

const FALLBACK_MODELS = ["claude-fable-5-1", "claude-opus-5-5", "claude-opus-5", "claude-sonnet-5-5"];
export const aiModel = () => process.env.AI_MODEL || "claude-opus-5-5";
export const aiConfigured = () => Boolean(process.env.ANTHROPIC_API_KEY);
export const dailyLimit = DEFAULT_AI_DAILY;
const globalDailyCap = () => Math.max(1, Number(process.env.AI_GLOBAL_DAILY_LIMIT) || 2000);

let client: Anthropic | undefined;
const sdk = () => (client ??= new Anthropic({ timeout: 90_000, maxRetries: 1 }));

const SYSTEM = [
  "Sen USTOZ 360 platformasidagi AI yordamchisan. Foydalanuvchi — O'zbekistonlik o'qituvchi.",
  "Doim o'zbek tilida (lotin yozuvida) aniq, qisqa va amaliy javob ber. Foydalanuvchi boshqa tilda so'ramasa shunday qil.",
  "Aniq bilmagan narsangni o'ylab topma; ishonching komil bo'lmasa shuni ayt. Me'yoriy hujjat raqamlari yoki havolalarni to'qima.",
  "Faqat ta'lim, dars berish va o'qituvchi faoliyatiga oid mavzularda yordam ber.",
].join(" ");

type Limits = { daily: number; freeDaily: number; perMinute: number; enabled: boolean; freeEnabled: boolean; priceIn: number; priceOut: number };
/** Foydalanuvchi limitlari: tarif * sozlama. Baza/sozlama xato bersa muhit o'zgaruvchisidagi standart qiymatlar. */
async function limitsFor(userId: string): Promise<Limits> {
  const d = SETTING_DEFAULTS.ai;
  try {
    const [s, e] = await Promise.all([getSettings(), getEntitlements(userId)]);
    return { daily: e.aiDaily, freeDaily: e.freeAiDaily, perMinute: s.ai.perMinute, enabled: s.ai.enabled, freeEnabled: s.ai.freeEnabled, priceIn: s.ai.priceInPerMTok, priceOut: s.ai.priceOutPerMTok };
  } catch (err) {
    console.error("ai limits", (err as Error).message);
    return { daily: DEFAULT_AI_DAILY(), freeDaily: DEFAULT_FREE_AI_DAILY(), perMinute: d.perMinute, enabled: d.enabled, freeEnabled: d.freeEnabled, priceIn: 0, priceOut: 0 };
  }
}

const startOfDay = () => { const d = new Date(); d.setUTCHours(0, 0, 0, 0); return d; };

export async function usageToday(userId: string) {
  const [used, l] = await Promise.all([
    db.aiRequest.count({ where: { userId, createdAt: { gte: startOfDay() }, feature: { notIn: ["free-chat", "health"] }, status: { not: "blocked" } } }),
    limitsFor(userId),
  ]);
  return { used, limit: l.daily, remaining: Math.max(0, l.daily - used) };
}

/** Daqiqalik chegara: bir foydalanuvchi bir daqiqada ko'pi bilan `perMinute` ta so'rov yuboradi. */
async function checkRate(userId: string, perMinute: number) {
  const n = await db.aiRequest.count({ where: { userId, createdAt: { gte: new Date(Date.now() - 60_000) }, status: { not: "blocked" }, feature: { not: "health" } } });
  if (n >= perMinute) throw new ApiError(429, "Juda tez-tez so'rayapsiz. Bir daqiqadan so'ng qayta urinib ko'ring.", "rate_limited");
}

type Call = { userId: string; feature: AiFeature; messages: { role: "user" | "assistant"; content: string }[]; maxTokens: number; effort?: "low" | "medium" | "high"; schema?: Record<string, unknown>; system?: string; promptVersion?: string };
export type AiResult = { text: string; model: string };

export async function runAi(c: Call): Promise<AiResult> {
  if (!aiConfigured()) throw new ApiError(503, "AI xizmati hali sozlanmagan (ANTHROPIC_API_KEY yo'q).", "ai_unconfigured");
  await requireVerified(c.userId);
  const l = await limitsFor(c.userId);
  if (!l.enabled) throw new ApiError(503, "AI xizmati administrator tomonidan vaqtincha o'chirilgan.", "ai_disabled");
  await checkRate(c.userId, l.perMinute);
  const used0 = await db.aiRequest.count({ where: { userId: c.userId, createdAt: { gte: startOfDay() }, feature: { notIn: ["free-chat", "health"] }, status: { not: "blocked" } } });
  if (used0 >= l.daily || (await db.aiRequest.count({ where: { createdAt: { gte: startOfDay() }, feature: { notIn: ["free-chat", "health"] } } })) >= globalDailyCap()) {
    await db.aiRequest.create({ data: { userId: c.userId, feature: c.feature, model: aiModel(), status: "blocked" } });
    throw new ApiError(429, `Bugungi AI limiti tugadi (${l.daily} ta so'rov). Ertaga qayta urinib ko'ring.`, "daily_limit");
  }
  const model = aiModel();
  const params: Record<string, unknown> = {
    model, max_tokens: c.maxTokens, system: c.system ?? SYSTEM, messages: c.messages,
    output_config: { effort: c.effort ?? "medium", ...(c.schema ? { format: { type: "json_schema", schema: c.schema } } : {}) },
  };
  if (FALLBACK_MODELS.includes(model)) { params.fallbacks = "default"; params.betas = ["server-side-fallback-2026-07-01"]; }
  let status = "ok", input = 0, output = 0, used = model;
  const t0 = Date.now();
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const r: any = await sdk().beta.messages.create(params as any);
    input = r.usage?.input_tokens ?? 0; output = r.usage?.output_tokens ?? 0; used = r.model ?? model;
    if (r.stop_reason === "refusal") { status = "refused"; throw new ApiError(422, "AI bu so'rovga javob bera olmadi. Savolni boshqacha ifodalab ko'ring."); }
    const text = (r.content as { type: string; text?: string }[]).filter((b) => b.type === "text").map((b) => b.text).join("").trim();
    if (!text) { status = "empty"; throw new ApiError(502, "AI bo'sh javob qaytardi. Qayta urinib ko'ring."); }
    if (r.stop_reason === "max_tokens") status = "truncated";
    return { text, model: used };
  } catch (e) {
    if (e instanceof ApiError) throw e;
    status = "error";
    if (e instanceof Anthropic.RateLimitError || (e as { status?: number }).status === 529) throw new ApiError(503, "AI xizmati hozir band. Birozdan so'ng urinib ko'ring.");
    console.error("AI error", (e as Error).message);
    throw new ApiError(502, "AI xizmatidan javob olinmadi. Birozdan so'ng urinib ko'ring.");
  } finally {
    await db.aiRequest.create({ data: { userId: c.userId, feature: c.feature, model: used, inputTokens: input, outputTokens: output, status, latencyMs: Date.now() - t0, promptVersion: c.promptVersion ?? `${c.feature}@1`, costMicro: costMicro(input, output, l.priceIn, l.priceOut) } }).catch(() => {});
  }
}

export const LESSON_SECTIONS = ["Maqsad va kutiladigan natijalar", "Kerakli jihozlar", "Tashkiliy qism", "O'tgan mavzuni takrorlash", "Yangi mavzu", "Amaliy mashqlar", "Mustahkamlash", "Formativ baholash", "Uy vazifasi", "Refleksiya"];
export const lessonSchema = {
  type: "object",
  properties: { sections: { type: "array", items: { type: "object", properties: { title: { type: "string" }, content: { type: "string" } }, required: ["title", "content"], additionalProperties: false } } },
  required: ["sections"], additionalProperties: false,
};

// ---- Bepul AI: OpenAI-mos endpoint (masalan, o'zingiz joylagan FreeLLMAPI yoki boshqa shlyuz) ----
/** Bir nechta bepul xizmat: FREE_LLM_*, FREE_LLM2_*, FREE_LLM3_*. Birinchisi xato bersa yoki limitga yetsa, keyingisi sinaladi. */
type FreeProvider = { base: string; key: string; model: string };
const freeProviders = (): FreeProvider[] => ["", "2", "3"].flatMap((n) => {
  const base = process.env[`FREE_LLM${n}_BASE_URL`], key = process.env[`FREE_LLM${n}_API_KEY`];
  return base && key ? [{ base: base.replace(/\/+$/, ""), key, model: process.env[`FREE_LLM${n}_MODEL`] || "auto" }] : [];
});
export const freeConfigured = () => freeProviders().length > 0;
export const freeLimit = DEFAULT_FREE_AI_DAILY;

export async function freeUsageToday(userId: string) {
  const [used, l] = await Promise.all([
    db.aiRequest.count({ where: { userId, feature: "free-chat", createdAt: { gte: startOfDay() }, status: { not: "blocked" } } }),
    limitsFor(userId),
  ]);
  return { used, limit: l.freeDaily, remaining: Math.max(0, l.freeDaily - used) };
}

const sleep = (ms: number) => (ms > 0 ? new Promise((r) => setTimeout(r, ms)) : Promise.resolve());

/** Bitta provayderga so'rov: 5xx/tarmoq xatosida eksponensial kutish bilan bir marta qayta urinadi; 429 (limit) da darhol keyingisiga o'tiladi. */
async function callFree(p: FreeProvider, body: unknown, timeoutMs: number): Promise<{ text: string; model: string; input: number; output: number } | null> {
  const host = new URL(p.base).host;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(`${p.base}/chat/completions`, { method: "POST", signal: AbortSignal.timeout(timeoutMs), headers: { "content-type": "application/json", authorization: `Bearer ${p.key}` }, body: JSON.stringify(body) });
      if (!res.ok) {
        console.error("Free AI provider failed", host, res.status);
        if (isRetryableStatus(res.status) && attempt === 0) { await sleep(retryDelayMs(attempt)); continue; }
        return null;
      }
      const d = await res.json();
      const text = String(d.choices?.[0]?.message?.content ?? "").trim();
      if (!text) { console.error("Free AI provider empty", host); return null; }
      return { text, model: d.model ?? p.model, input: d.usage?.prompt_tokens ?? 0, output: d.usage?.completion_tokens ?? 0 };
    } catch (e) {
      console.error("Free AI provider error", host, (e as Error).name);
      if (attempt === 0) { await sleep(retryDelayMs(attempt)); continue; }
      return null;
    }
  }
  return null;
}

export async function runFreeAi(userId: string, messages: { role: "user" | "assistant"; content: string }[], opts: { system?: string; maxTokens?: number; feature?: AiFeature; promptVersion?: string } = {}): Promise<AiResult> {
  if (!freeConfigured()) throw new ApiError(503, "Bepul AI hali sozlanmagan (FREE_LLM_BASE_URL va FREE_LLM_API_KEY yo'q).", "ai_unconfigured");
  await requireVerified(userId);
  const l = await limitsFor(userId);
  if (!l.enabled || !l.freeEnabled) throw new ApiError(503, "AI xizmati administrator tomonidan vaqtincha o'chirilgan.", "ai_disabled");
  await checkRate(userId, l.perMinute);
  const providers = freeProviders();
  const model = providers[0].model;
  const used0 = await db.aiRequest.count({ where: { userId, feature: "free-chat", createdAt: { gte: startOfDay() }, status: { not: "blocked" } } });
  if (used0 >= l.freeDaily) {
    await db.aiRequest.create({ data: { userId, feature: "free-chat", model, status: "blocked" } });
    throw new ApiError(429, `Bugungi bepul AI limiti tugadi (${l.freeDaily} ta). Ertaga qayta urinib ko'ring.`, "daily_limit");
  }
  let status = "ok", input = 0, output = 0, used = model;
  const t0 = Date.now();
  try {
    for (const p of providers) {
      const r = await callFree(p, { model: p.model, max_tokens: opts.maxTokens ?? 1200, messages: [{ role: "system", content: opts.system ?? SYSTEM }, ...messages] }, 45_000);
      if (r) { input = r.input; output = r.output; used = r.model; return { text: r.text, model: r.model }; }
    }
    status = "error";
    throw new ApiError(503, "Bepul AI hozir band yoki limitga yetgan. Birozdan so'ng urinib ko'ring.");
  } catch (e) {
    if (e instanceof ApiError) throw e;
    status = "error"; console.error("Free AI error", (e as Error).message);
    throw new ApiError(502, "Bepul AI bilan aloqa yo'q. Birozdan so'ng urinib ko'ring.");
  } finally {
    // Funksiyalar (feature) farqi uchun promptVersion'da saqlanadi; kunlik limit hisobi "free-chat" bo'yicha qoladi.
    await db.aiRequest.create({ data: { userId, feature: "free-chat", model: used, inputTokens: input, outputTokens: output, status, latencyMs: Date.now() - t0, promptVersion: opts.promptVersion ?? `${opts.feature ?? "chat"}@1`, costMicro: costMicro(input, output, l.priceIn, l.priceOut) } }).catch(() => {});
  }
}

/** Qaysi AI xizmati ulangan (admin panel va UI uchun). */
export const aiAvailable = () => ({ claude: aiConfigured(), free: freeConfigured(), any: aiConfigured() || freeConfigured() });

/**
 * Sog'liq tekshiruvi (admin "ulanishni sinash"): har bir ulangan xizmatga juda qisqa so'rov. Foydalanuvchi limiti sarflanmaydi.
 * Natijada kalit ham, to'liq manzil ham yo'q: faqat xost, holat va vaqt.
 */
export async function aiHealth() {
  const claude: { configured: boolean; model: string | null; ok?: boolean; ms?: number; error?: string } = { configured: aiConfigured(), model: aiConfigured() ? aiModel() : null };
  if (claude.configured) {
    const t0 = Date.now();
    try {
      await sdk().beta.messages.create({ model: aiModel(), max_tokens: 8, messages: [{ role: "user", content: "ping" }] } as never);
      claude.ok = true;
    } catch (e) { claude.ok = false; claude.error = `${(e as { status?: number }).status ?? (e as Error).name}`; }
    claude.ms = Date.now() - t0;
  }
  const free: { host: string; model: string; ok: boolean; ms: number; error?: string }[] = [];
  for (const p of freeProviders()) {
    const t0 = Date.now();
    let ok = false, error: string | undefined;
    try {
      const res = await fetch(`${p.base}/chat/completions`, { method: "POST", signal: AbortSignal.timeout(20_000), headers: { "content-type": "application/json", authorization: `Bearer ${p.key}` }, body: JSON.stringify({ model: p.model, max_tokens: 5, messages: [{ role: "user", content: "ping" }] }) });
      ok = res.ok; if (!res.ok) error = String(res.status);
    } catch (e) { error = (e as Error).name; }
    free.push({ host: new URL(p.base).host, model: p.model, ok, ms: Date.now() - t0, ...(error && { error }) });
  }
  return { claude, free, checkedAt: new Date().toISOString() };
}
