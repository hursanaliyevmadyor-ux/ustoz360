import Anthropic from "@anthropic-ai/sdk";
import type { Prisma } from "@prisma/client";
import { ApiError, requireVerified } from "../auth";
import { db } from "../db";
import { DEFAULT_AI_DAILY, DEFAULT_FREE_AI_DAILY, getEntitlements } from "../entitlements";
import { getSettings } from "../settings";
import { SETTING_DEFAULTS } from "../settingsdef";
import { withHubKnowledge } from "../hub/context";
import { Breaker, orderProviders, type Role } from "../hub/routing";
import { costMicro, isRetryableStatus, retryDelayMs } from "./gatewaylogic";

/**
 * AI shlyuzi: barcha AI so'rovlari shu yerdan o'tadi (Claude yoki OpenAI-mos bepul xizmatlar).
 * Limitlar (kunlik, daqiqalik), tarif, timeout, qayta urinish, jurnal (kechikish, token, narx) shu yerda.
 * Kalitlar faqat muhit o'zgaruvchilarida; xato matnlariga kalit tushmaydi.
 */
export type AiFeature = "chat" | "explain" | "lesson" | "practice" | "taskset" | "visual" | "rubric" | "plan" | "health" | "import" | "verify";

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

/** Claude kunlik limitiga hisoblanmaydigan jurnal turlari (bepul chat, sog'liq tekshiruvi, internet qidiruvi, bilim bazasidan javob). Daqiqalik chegara hammasini sanaydi. */
const NO_CLAUDE_QUOTA = ["free-chat", "health", "web-search", "hub-kb", "import"];

type Limits = { daily: number; freeDaily: number; perMinute: number; enabled: boolean; freeEnabled: boolean; priceIn: number; priceOut: number; roles: Record<string, Role> };
/** Foydalanuvchi limitlari: tarif * sozlama. Baza/sozlama xato bersa muhit o'zgaruvchisidagi standart qiymatlar. */
async function limitsFor(userId: string): Promise<Limits> {
  const d = SETTING_DEFAULTS.ai;
  try {
    const [s, e] = await Promise.all([getSettings(), getEntitlements(userId)]);
    return { daily: e.aiDaily, freeDaily: e.freeAiDaily, perMinute: s.ai.perMinute, enabled: s.ai.enabled, freeEnabled: s.ai.freeEnabled, priceIn: s.ai.priceInPerMTok, priceOut: s.ai.priceOutPerMTok, roles: s.ai.providerRoles ?? {} };
  } catch (err) {
    console.error("ai limits", (err as Error).message);
    return { daily: DEFAULT_AI_DAILY(), freeDaily: DEFAULT_FREE_AI_DAILY(), perMinute: d.perMinute, enabled: d.enabled, freeEnabled: d.freeEnabled, priceIn: 0, priceOut: 0, roles: {} };
  }
}

const startOfDay = () => { const d = new Date(); d.setUTCHours(0, 0, 0, 0); return d; };

let providerColumnWarned = false;
/**
 * Jurnal yozuvi. `provider` ustuni bazaga hali qo'shilmagan bo'lsa (prisma/supabase-update-knowledge-hub.sql qo'llanmagan) yozuv ustunsiz qayta uriniladi:
 * kunlik va daqiqalik limit hisobi yo'qolmasin. Xato asosiy javobga ta'sir qilmaydi.
 */
async function logRequest(data: Prisma.AiRequestUncheckedCreateInput) {
  try { await db.aiRequest.create({ data, select: { id: true } }); return; } catch (e) {
    if (!data.provider) return;
    if (!providerColumnWarned) { providerColumnWarned = true; console.error("AiRequest.provider yozilmadi (SQL qo'llanganmi?):", (e as Error).message); }
  }
  await db.aiRequest.create({ data: { ...data, provider: undefined }, select: { id: true } }).catch(() => {});
}

export async function usageToday(userId: string) {
  const [used, l] = await Promise.all([
    db.aiRequest.count({ where: { userId, createdAt: { gte: startOfDay() }, feature: { notIn: NO_CLAUDE_QUOTA }, status: { not: "blocked" } } }),
    limitsFor(userId),
  ]);
  return { used, limit: l.daily, remaining: Math.max(0, l.daily - used) };
}

/** Daqiqalik chegara: bir foydalanuvchi bir daqiqada ko'pi bilan `perMinute` ta so'rov yuboradi. */
export async function checkRate(userId: string, perMinute: number) {
  const n = await db.aiRequest.count({ where: { userId, createdAt: { gte: new Date(Date.now() - 60_000) }, status: { not: "blocked" }, feature: { notIn: ["health", "import"] } } });
  if (n >= perMinute) throw new ApiError(429, "Juda tez-tez so'rayapsiz. Bir daqiqadan so'ng qayta urinib ko'ring.", "rate_limited");
}

/** `knowledge`: AI Bilim markazidan bilim qo'shish: berilmasa oxirgi foydalanuvchi xabari bo'yicha, matn berilsa shu matn bo'yicha, false bo'lsa qo'shilmaydi (src/server/hub/context.ts). */
type Call = { userId: string; feature: AiFeature; messages: { role: "user" | "assistant"; content: string }[]; maxTokens: number; effort?: "low" | "medium" | "high"; schema?: Record<string, unknown>; system?: string; promptVersion?: string; knowledge?: string | false };
/** `provider`: javobni bergan bepul xizmat ("free1"...): bilim markazi nomzodiga yoziladi. */
export type AiResult = { text: string; model: string; provider?: string };

export async function runAi(c: Call): Promise<AiResult> {
  if (!aiConfigured()) throw new ApiError(503, "AI xizmati hali sozlanmagan (ANTHROPIC_API_KEY yo'q).", "ai_unconfigured");
  await requireVerified(c.userId);
  const l = await limitsFor(c.userId);
  if (!l.enabled) throw new ApiError(503, "AI xizmati administrator tomonidan vaqtincha o'chirilgan.", "ai_disabled");
  await checkRate(c.userId, l.perMinute);
  const used0 = await db.aiRequest.count({ where: { userId: c.userId, createdAt: { gte: startOfDay() }, feature: { notIn: NO_CLAUDE_QUOTA }, status: { not: "blocked" } } });
  if (used0 >= l.daily || (await db.aiRequest.count({ where: { createdAt: { gte: startOfDay() }, feature: { notIn: NO_CLAUDE_QUOTA } } })) >= globalDailyCap()) {
    await db.aiRequest.create({ data: { userId: c.userId, feature: c.feature, model: aiModel(), status: "blocked" } });
    throw new ApiError(429, `Bugungi AI limiti tugadi (${l.daily} ta so'rov). Ertaga qayta urinib ko'ring.`, "daily_limit");
  }
  const model = aiModel();
  // Yagona bilim manbasi: tasdiqlangan bilim (hubMode=on bo'lsa) har qanday AI chaqiruviga «ma'lumot bloki» sifatida qo'shiladi.
  const sys = await withHubKnowledge(c.system ?? SYSTEM, c.messages, c.knowledge);
  const params: Record<string, unknown> = {
    model, max_tokens: c.maxTokens, system: sys.system, messages: c.messages,
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
    await logRequest({ userId: c.userId, feature: c.feature, model: used, inputTokens: input, outputTokens: output, status, latencyMs: Date.now() - t0, promptVersion: c.promptVersion ?? `${c.feature}@1`, costMicro: costMicro(input, output, l.priceIn, l.priceOut), provider: "claude" });
  }
}

export const LESSON_SECTIONS = ["Maqsad va kutiladigan natijalar", "Kerakli jihozlar", "Tashkiliy qism", "O'tgan mavzuni takrorlash", "Yangi mavzu", "Amaliy mashqlar", "Mustahkamlash", "Formativ baholash", "Uy vazifasi", "Refleksiya"];
export const lessonSchema = {
  type: "object",
  properties: { sections: { type: "array", items: { type: "object", properties: { title: { type: "string" }, content: { type: "string" } }, required: ["title", "content"], additionalProperties: false } } },
  required: ["sections"], additionalProperties: false,
};

// ---- Bepul AI: OpenAI-mos endpoint (masalan, o'zingiz joylagan FreeLLMAPI yoki boshqa shlyuz) ----
/** Bir nechta bepul xizmat: FREE_LLM_*, FREE_LLM2_* ... FREE_LLM10_* (10 tagacha). Birinchisi xato bersa yoki limitga yetsa, keyingisi sinaladi. */
type FreeProvider = { id: string; base: string; key: string; model: string };
const FREE_SLOTS = ["", "2", "3", "4", "5", "6", "7", "8", "9", "10"];
/** `id` jurnal uchun: "free1" (FREE_LLM_*), "free2" (FREE_LLM2_*) ... Kalit emas, faqat slot raqami. */
const freeProviders = (): FreeProvider[] => FREE_SLOTS.flatMap((n) => {
  const base = process.env[`FREE_LLM${n}_BASE_URL`], key = process.env[`FREE_LLM${n}_API_KEY`];
  return base && key ? [{ id: `free${n || "1"}`, base: base.replace(/\/+$/, ""), key, model: process.env[`FREE_LLM${n}_MODEL`] || "auto" }] : [];
});
export const freeConfigured = () => freeProviders().length > 0;
export const freeLimit = DEFAULT_FREE_AI_DAILY;

/** Ketma-ket xato bergan xizmat vaqtincha oxiriga suriladi (docs/KNOWLEDGE-HUB.md, provayder siyosati). */
const breaker = new Breaker();
/** Admin ko'rinishi uchun: ulangan bepul xizmatlar (kalitsiz) va uzilish holati. */
export const freeProviderInfo = () => freeProviders().map((p) => ({ id: p.id, host: new URL(p.base).host, model: p.model, breakerSeconds: breaker.retryIn(p.id) }));

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

export async function runFreeAi(userId: string, messages: { role: "user" | "assistant"; content: string }[], opts: { system?: string; maxTokens?: number; feature?: AiFeature; promptVersion?: string; knowledge?: string | false } = {}): Promise<AiResult> {
  if (!freeConfigured()) throw new ApiError(503, "Bepul AI hali sozlanmagan (FREE_LLM_BASE_URL va FREE_LLM_API_KEY yo'q).", "ai_unconfigured");
  await requireVerified(userId);
  const l = await limitsFor(userId);
  if (!l.enabled || !l.freeEnabled) throw new ApiError(503, "AI xizmati administrator tomonidan vaqtincha o'chirilgan.", "ai_disabled");
  await checkRate(userId, l.perMinute);
  // Rol (asosiy/zaxira/tekshiruvchi/o'chirilgan) va uzilish holati bo'yicha tartib. Rol berilmagan bo'lsa: hozirgi tabiiy tartib.
  const providers = orderProviders(freeProviders(), l.roles, (id) => breaker.isOpen(id));
  if (!providers.length) throw new ApiError(503, "Bepul AI xizmatlari administrator tomonidan o'chirilgan.", "ai_disabled");
  const model = providers[0].model;
  const used0 = await db.aiRequest.count({ where: { userId, feature: "free-chat", createdAt: { gte: startOfDay() }, status: { not: "blocked" } } });
  if (used0 >= l.freeDaily) {
    await db.aiRequest.create({ data: { userId, feature: "free-chat", model, status: "blocked" } });
    throw new ApiError(429, `Bugungi bepul AI limiti tugadi (${l.freeDaily} ta). Ertaga qayta urinib ko'ring.`, "daily_limit");
  }
  let status = "ok", input = 0, output = 0, used = model, provider: string | undefined;
  const t0 = Date.now();
  try {
    // Yagona bilim manbasi (Claude yo'li bilan bir xil): tasdiqlangan bilim «ma'lumot bloki» sifatida qo'shiladi.
    const sys = await withHubKnowledge(opts.system ?? SYSTEM, messages, opts.knowledge);
    for (const p of providers) {
      const r = await callFree(p, { model: p.model, max_tokens: opts.maxTokens ?? 1200, messages: [{ role: "system", content: sys.system }, ...messages] }, 45_000);
      if (r) { breaker.ok(p.id); input = r.input; output = r.output; used = r.model; provider = p.id; return { text: r.text, model: r.model, provider: p.id }; }
      breaker.fail(p.id);
    }
    status = "error";
    throw new ApiError(503, "Bepul AI hozir band yoki limitga yetgan. Birozdan so'ng urinib ko'ring.");
  } catch (e) {
    if (e instanceof ApiError) throw e;
    status = "error"; console.error("Free AI error", (e as Error).message);
    throw new ApiError(502, "Bepul AI bilan aloqa yo'q. Birozdan so'ng urinib ko'ring.");
  } finally {
    // Funksiyalar (feature) farqi uchun promptVersion'da saqlanadi; kunlik limit hisobi "free-chat" bo'yicha qoladi.
    await logRequest({ userId, feature: "free-chat", model: used, inputTokens: input, outputTokens: output, status, latencyMs: Date.now() - t0, promptVersion: opts.promptVersion ?? `${opts.feature ?? "chat"}@1`, costMicro: costMicro(input, output, l.priceIn, l.priceOut), provider });
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

// ---- Aqlli import uchun multimodal (PDF, rasm, matn) so'rovlari: Gemini (docs/SMART-IMPORT.md) ----
/** Gemini so'rov qismi: matn yoki ichiga joylangan fayl (PDF/rasm; base64). */
export type GeminiPart = { text: string } | { inlineData: { mimeType: string; data: string } };
const GEMINI_BASE = () => (process.env.GEMINI_API_BASE || "https://generativelanguage.googleapis.com/v1beta").replace(/\/+$/, "");
/** Model nomlari kodga qattiq bog'lanmagan: tezkor import uchun IMPORT_FAST_MODEL, murakkab tahlil uchun IMPORT_COMPLEX_MODEL (admin muhitda sozlaydi). */
export const importModel = (heavy = false) => (heavy ? process.env.IMPORT_COMPLEX_MODEL : process.env.IMPORT_FAST_MODEL) || process.env.GEMINI_MODEL || "gemini-2.5-flash";
export const visionConfigured = () => Boolean(process.env.GEMINI_API_KEY);
const importDailyLimit = () => Math.max(1, Number(process.env.IMPORT_AI_DAILY_LIMIT) || 80);
const importPerMinute = () => Math.max(1, Number(process.env.IMPORT_PER_MINUTE) || 14);

/** Import AI chaqiruvlarining bugungi soni (foydalanuvchi bo'yicha): admin va UI limit holati uchun. */
export async function importUsageToday(userId: string) {
  const used = await db.aiRequest.count({ where: { userId, feature: "import", createdAt: { gte: startOfDay() }, status: { not: "blocked" } } });
  return { used, limit: importDailyLimit(), remaining: Math.max(0, importDailyLimit() - used) };
}

/**
 * Gemini orqali JSON javob oladi (matn va/yoki PDF/rasm qismlari bilan). Kalit faqat serverda, jurnalga faqat metadata yoziladi.
 * Limitlar: import uchun alohida kunlik va daqiqalik chegara (Claude kunlik limitiga hisoblanmaydi).
 */
export async function runGeminiJson(c: { userId: string; parts: GeminiPart[]; system?: string; maxTokens: number; heavy?: boolean; promptVersion: string; timeoutMs?: number }): Promise<{ text: string; model: string }> {
  if (!visionConfigured()) throw new ApiError(503, "Fayl tahlili uchun AI ulanmagan (GEMINI_API_KEY yo'q).", "vision_unconfigured");
  await requireVerified(c.userId);
  const l = await limitsFor(c.userId);
  if (!l.enabled) throw new ApiError(503, "AI xizmati administrator tomonidan vaqtincha o'chirilgan.", "ai_disabled");
  const model = importModel(c.heavy);
  const recent = await db.aiRequest.count({ where: { userId: c.userId, feature: "import", createdAt: { gte: new Date(Date.now() - 60_000) }, status: { not: "blocked" } } });
  if (recent >= importPerMinute()) throw new ApiError(429, "Fayl tahlili juda tez-tez so'raldi. Bir daqiqadan so'ng avtomatik davom etadi.", "rate_limited");
  const day = await importUsageToday(c.userId);
  if (day.remaining <= 0) {
    await db.aiRequest.create({ data: { userId: c.userId, feature: "import", model, status: "blocked", provider: "gemini" } }).catch(() => undefined);
    throw new ApiError(429, `Bugungi fayl tahlili limiti tugadi (${day.limit} ta so'rov). Ertaga davom ettirishingiz mumkin.`, "daily_limit");
  }
  const body = {
    ...(c.system ? { systemInstruction: { parts: [{ text: c.system }] } } : {}),
    contents: [{ role: "user", parts: c.parts }],
    generationConfig: {
      responseMimeType: "application/json", maxOutputTokens: c.maxTokens, temperature: 0,
      ...(/2\.5-flash/.test(model) && !/pro/.test(model) ? { thinkingConfig: { thinkingBudget: 0 } } : {}),
    },
  };
  let status = "ok", input = 0, output = 0;
  const t0 = Date.now();
  try {
    for (let attempt = 0; attempt < 2; attempt++) {
      const res = await fetch(`${GEMINI_BASE()}/models/${encodeURIComponent(model)}:generateContent`, {
        method: "POST", signal: AbortSignal.timeout(c.timeoutMs ?? 50_000),
        headers: { "content-type": "application/json", "x-goog-api-key": process.env.GEMINI_API_KEY ?? "" }, body: JSON.stringify(body),
      });
      if (!res.ok) {
        // Sabab serverning jurnaliga yoziladi (kalit hech qachon emas); foydalanuvchiga esa amaliy ishora ko'rsatiladi.
        const reason = ((await res.json().catch(() => null)) as { error?: { message?: string } } | null)?.error?.message?.replace(/AIza[0-9A-Za-z_-]{20,}/g, "***").slice(0, 200) ?? "";
        console.error("Gemini import xato:", res.status, model, reason);
        if (isRetryableStatus(res.status) && attempt === 0) { await sleep(retryDelayMs(attempt)); continue; }
        status = "error";
        const hint = res.status === 404 ? `model topilmadi (${model}): IMPORT_FAST_MODEL yoki GEMINI_MODEL nomini tekshiring`
          : [400, 401, 403].includes(res.status) ? "kalit noto'g'ri yoki ruxsat yo'q: GEMINI_API_KEY ni tekshiring" : "";
        throw new ApiError(res.status === 429 ? 429 : 502, res.status === 429 ? "AI xizmati hozir band (limit). Birozdan so'ng avtomatik davom etadi." : `Fayl tahlili xizmati xato berdi (${res.status}${hint ? `: ${hint}` : ""}).`, res.status === 429 ? "provider_busy" : undefined);
      }
      const d = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[]; usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number } };
      input = d.usageMetadata?.promptTokenCount ?? 0; output = d.usageMetadata?.candidatesTokenCount ?? 0;
      const cand = d.candidates?.[0];
      const text = (cand?.content?.parts ?? []).map((p) => p.text ?? "").join("").trim();
      if (!text) { status = "empty"; throw new ApiError(502, cand?.finishReason === "SAFETY" || cand?.finishReason === "PROHIBITED_CONTENT" ? "AI bu faylni tahlil qila olmadi (xavfsizlik filtri)." : "AI bo'sh javob qaytardi."); }
      if (cand?.finishReason === "MAX_TOKENS") status = "truncated";
      return { text, model };
    }
    status = "error";
    throw new ApiError(502, "Fayl tahlili xizmatidan javob olinmadi.");
  } catch (e) {
    if (e instanceof ApiError) throw e;
    status = "error"; console.error("Gemini import:", (e as Error).name);
    throw new ApiError(502, "Fayl tahlili xizmati bilan aloqa yo'q. Birozdan so'ng qayta urinib ko'ring.");
  } finally {
    await logRequest({ userId: c.userId, feature: "import", model, inputTokens: input, outputTokens: output, status, latencyMs: Date.now() - t0, promptVersion: c.promptVersion, costMicro: costMicro(input, output, l.priceIn, l.priceOut), provider: "gemini" });
  }
}
