import Anthropic from "@anthropic-ai/sdk";
import { ApiError, requireVerified } from "../auth";
import { db } from "../db";

export type AiFeature = "chat" | "explain" | "lesson" | "practice";

const FALLBACK_MODELS = ["claude-fable-5-1", "claude-opus-5-5", "claude-opus-5", "claude-sonnet-5-5"];
export const aiModel = () => process.env.AI_MODEL || "claude-opus-5-5";
export const aiConfigured = () => Boolean(process.env.ANTHROPIC_API_KEY);
export const dailyLimit = () => Math.max(1, Number(process.env.AI_DAILY_LIMIT) || 30);
const globalDailyCap = () => Math.max(1, Number(process.env.AI_GLOBAL_DAILY_LIMIT) || 2000);

let client: Anthropic | undefined;
const sdk = () => (client ??= new Anthropic({ timeout: 90_000, maxRetries: 1 }));

const SYSTEM = [
  "Sen USTOZ 360 platformasidagi AI yordamchisan. Foydalanuvchi — O'zbekistonlik o'qituvchi.",
  "Doim o'zbek tilida (lotin yozuvida) aniq, qisqa va amaliy javob ber. Foydalanuvchi boshqa tilda so'ramasa shunday qil.",
  "Aniq bilmagan narsangni o'ylab topma; ishonching komil bo'lmasa shuni ayt. Me'yoriy hujjat raqamlari yoki havolalarni to'qima.",
  "Faqat ta'lim, dars berish va o'qituvchi faoliyatiga oid mavzularda yordam ber.",
].join(" ");

export async function usageToday(userId: string) {
  const since = new Date(); since.setUTCHours(0, 0, 0, 0);
  const used = await db.aiRequest.count({ where: { userId, createdAt: { gte: since }, feature: { not: "free-chat" }, status: { not: "blocked" } } });
  return { used, limit: dailyLimit(), remaining: Math.max(0, dailyLimit() - used) };
}

type Call = { userId: string; feature: AiFeature; messages: { role: "user" | "assistant"; content: string }[]; maxTokens: number; effort?: "low" | "medium" | "high"; schema?: Record<string, unknown>; system?: string };
export type AiResult = { text: string; model: string };

export async function runAi(c: Call): Promise<AiResult> {
  if (!aiConfigured()) throw new ApiError(503, "AI xizmati hali sozlanmagan (ANTHROPIC_API_KEY yo'q).");
  await requireVerified(c.userId);
  const u = await usageToday(c.userId);
  const since = new Date(); since.setUTCHours(0, 0, 0, 0);
  if (u.remaining <= 0 || (await db.aiRequest.count({ where: { createdAt: { gte: since }, feature: { not: "free-chat" } } })) >= globalDailyCap()) {
    await db.aiRequest.create({ data: { userId: c.userId, feature: c.feature, model: aiModel(), status: "blocked" } });
    throw new ApiError(429, `Bugungi AI limiti tugadi (${u.limit} ta so'rov). Ertaga qayta urinib ko'ring.`);
  }
  const model = aiModel();
  const params: Record<string, unknown> = {
    model, max_tokens: c.maxTokens, system: c.system ?? SYSTEM, messages: c.messages,
    output_config: { effort: c.effort ?? "medium", ...(c.schema ? { format: { type: "json_schema", schema: c.schema } } : {}) },
  };
  if (FALLBACK_MODELS.includes(model)) { params.fallbacks = "default"; params.betas = ["server-side-fallback-2026-07-01"]; }
  let status = "ok", input = 0, output = 0, used = model;
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
    await db.aiRequest.create({ data: { userId: c.userId, feature: c.feature, model: used, inputTokens: input, outputTokens: output, status } }).catch(() => {});
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
export const freeLimit = () => Math.max(1, Number(process.env.AI_FREE_DAILY_LIMIT) || 50);

export async function freeUsageToday(userId: string) {
  const since = new Date(); since.setUTCHours(0, 0, 0, 0);
  const used = await db.aiRequest.count({ where: { userId, feature: "free-chat", createdAt: { gte: since }, status: { not: "blocked" } } });
  return { used, limit: freeLimit(), remaining: Math.max(0, freeLimit() - used) };
}

export async function runFreeAi(userId: string, messages: { role: "user" | "assistant"; content: string }[], opts: { system?: string; maxTokens?: number } = {}): Promise<AiResult> {
  if (!freeConfigured()) throw new ApiError(503, "Bepul AI hali sozlanmagan (FREE_LLM_BASE_URL va FREE_LLM_API_KEY yo'q).");
  await requireVerified(userId);
  const u = await freeUsageToday(userId);
  const providers = freeProviders();
  const model = providers[0].model;
  if (u.remaining <= 0) {
    await db.aiRequest.create({ data: { userId, feature: "free-chat", model, status: "blocked" } });
    throw new ApiError(429, `Bugungi bepul AI limiti tugadi (${u.limit} ta). Ertaga qayta urinib ko'ring.`);
  }
  let status = "ok", input = 0, output = 0, used = model;
  try {
    for (const p of providers) {
      try {
        const res = await fetch(`${p.base}/chat/completions`, {
          method: "POST", signal: AbortSignal.timeout(45_000),
          headers: { "content-type": "application/json", authorization: `Bearer ${p.key}` },
          body: JSON.stringify({ model: p.model, max_tokens: opts.maxTokens ?? 1200, messages: [{ role: "system", content: opts.system ?? SYSTEM }, ...messages] }),
        });
        if (!res.ok) { console.error("Free AI provider failed", new URL(p.base).host, res.status); continue; }
        const d = await res.json();
        const text = String(d.choices?.[0]?.message?.content ?? "").trim();
        if (!text) { console.error("Free AI provider empty", new URL(p.base).host); continue; }
        input = d.usage?.prompt_tokens ?? 0; output = d.usage?.completion_tokens ?? 0; used = d.model ?? p.model;
        return { text, model: used };
      } catch (e) { console.error("Free AI provider error", new URL(p.base).host, (e as Error).message); }
    }
    status = "error";
    throw new ApiError(503, "Bepul AI hozir band yoki limitga yetgan. Birozdan so'ng urinib ko'ring.");
  } catch (e) {
    if (e instanceof ApiError) throw e;
    status = "error"; console.error("Free AI error", (e as Error).message);
    throw new ApiError(502, "Bepul AI bilan aloqa yo'q. Birozdan so'ng urinib ko'ring.");
  } finally {
    await db.aiRequest.create({ data: { userId, feature: "free-chat", model: used, inputTokens: input, outputTokens: output, status } }).catch(() => {});
  }
}
