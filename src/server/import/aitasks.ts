import type { z } from "zod";
import { ApiError } from "../auth";
import { aiAvailable, runAi, runGeminiJson, visionConfigured, type GeminiPart } from "../ai/gateway";
import { parseStructured } from "../ai/parse";
import { runAnyAi } from "../ai/structured";
import { aiClassifySchema, aiExtractSchema, aiVerifySchema, normalizeAiKey, normalizeAiQuestions, type AiClassify, type AiVerify, type ExtractedDraft } from "./aischema";
import { classifyPrompt, extractFromFilePrompt, extractFromTextPrompt, extractKeyPrompt, SYSTEM_CLASSIFY, SYSTEM_EXTRACT, SYSTEM_VERIFY, verifyPrompt, type VerifyItem } from "./prompts";
import type { LabelStyle } from "./keyparse";

/**
 * Import uchun AI chaqiruvlari. Barcha so'rovlar server-side shlyuz (ai/gateway.ts) orqali o'tadi: kalitlar brauzerga chiqmaydi.
 * Imkoniyatlar (capability) bo'yicha tanlov: PDF va rasm faqat Gemini (multimodal) orqali; faqat matnli vazifalar uchun zaxira sifatida
 * mavjud bepul xizmat yoki Claude. Hech biri ulanmagan bo'lsa 503 («BLOCKED») va tegishli bosqich belgilanadi.
 */
export const MAX_INLINE_BYTES = 14 * 1024 * 1024;

export type ProviderCaps = { id: string; label: string; configured: boolean; pdf: boolean; image: boolean; json: boolean; reasoning: boolean; note: string };
/** Admin va UI uchun: qaysi provayder nimaga qodir (haqiqiy holat, taxmin emas). */
export function providerCaps(): ProviderCaps[] {
  const a = aiAvailable();
  return [
    { id: "gemini", label: "Gemini (multimodal)", configured: visionConfigured(), pdf: true, image: true, json: true, reasoning: true, note: "PDF, skaner va rasm tahlili, tezkor ajratish." },
    { id: "claude", label: "Claude", configured: a.claude, pdf: false, image: false, json: true, reasoning: true, note: "Hozircha faqat matnli tekshiruv (murakkab savollarni ikkinchi marta tekshirish)." },
    { id: "free", label: "Bepul AI xizmatlari", configured: a.free, pdf: false, image: false, json: true, reasoning: false, note: "Faqat matnli ajratish zaxirasi; PDF va rasm qo'llab-quvvatlanmaydi (tekshirilmagan)." },
  ];
}

export const canReadFiles = () => visionConfigured();
export const canReadText = () => visionConfigured() || aiAvailable().any;

type Provider = "gemini" | "free" | "claude";
async function aiJson<T>(o: { userId: string; parts?: GeminiPart[]; text?: string; system: string; schema: z.ZodType<T>; maxTokens: number; heavy?: boolean; promptVersion: string; verify?: boolean }): Promise<{ data: T; model: string; provider: Provider }> {
  const parts: GeminiPart[] = o.parts ?? (o.text ? [{ text: o.text }] : []);
  const textOnly = o.parts ? null : o.text ?? null;
  let lastErr: unknown = null;
  // Murakkab tekshiruv (ikkinchi bosqich): Claude ulangan bo'lsa avval shu; limit tugasa Gemini'ga o'tiladi.
  if (o.heavy && o.verify && textOnly && aiAvailable().claude) {
    try {
      for (let attempt = 0; attempt < 2; attempt++) {
        const r = await runAi({ userId: o.userId, feature: "verify", messages: [{ role: "user", content: attempt === 0 ? `${textOnly}\n\nReturn ONLY one JSON object.` : `${textOnly}\n\nYour previous answer was not valid JSON for the required shape. Return ONLY the JSON object.` }], system: o.system, maxTokens: Math.min(o.maxTokens, 6000), effort: "high", promptVersion: o.promptVersion, knowledge: false });
        const p = parseStructured(r.text, o.schema);
        if (p.ok) return { data: p.data, model: r.model, provider: "claude" };
        lastErr = new ApiError(502, `AI javobi kutilgan formatda emas (${p.error}).`);
      }
    } catch (e) { lastErr = e; }
  }
  if (visionConfigured()) {
    try {
      for (let attempt = 0; attempt < 2; attempt++) {
        const extra: GeminiPart[] = attempt === 0 ? [] : [{ text: "Your previous answer was not valid JSON for the required shape. Return ONLY the JSON object." }];
        // Matnli so'rovlar tez bo'lishi kerak (foydalanuvchi kutib qolmasligi uchun); fayl tahlili uzoqroq vaqt oladi.
        const r = await runGeminiJson({ userId: o.userId, parts: [...parts, ...extra], system: o.system, maxTokens: o.maxTokens, heavy: o.heavy, promptVersion: o.promptVersion, ...(o.parts ? {} : { timeoutMs: 25_000 }) });
        const p = parseStructured(r.text, o.schema);
        if (p.ok) return { data: p.data, model: r.model, provider: "gemini" };
        lastErr = new ApiError(502, `AI javobi kutilgan formatda emas (${p.error}).`);
      }
    } catch (e) {
      // Limit va band holatlar yuqoriga uzatiladi (qadam keyinroq qayta uriniladi); boshqa xatoda matnli zaxira sinab ko'riladi.
      if (e instanceof ApiError && (e.code === "daily_limit" || e.code === "rate_limited" || e.code === "provider_busy")) throw e;
      lastErr = e;
    }
  }
  if (textOnly && aiAvailable().any) {
    const system = o.system;
    try {
      for (let attempt = 0; attempt < 2; attempt++) {
        const msgs = [{ role: "user" as const, content: attempt === 0 ? `${textOnly}\n\nReturn ONLY one JSON object.` : `${textOnly}\n\nYour previous answer was not valid JSON for the required shape. Return ONLY the JSON object.` }];
        const r = await runAnyAi({ userId: o.userId, feature: "verify", messages: msgs, system, maxTokens: Math.min(o.maxTokens, 6000), promptVersion: o.promptVersion, knowledge: false });
        const p = parseStructured(r.text, o.schema);
        if (p.ok) return { data: p.data, model: r.model, provider: r.provider ? "free" : "claude" };
        lastErr = new ApiError(502, `AI javobi kutilgan formatda emas (${p.error}).`);
      }
    } catch (e) {
      // Birinchi (asosiy) xizmat sababi aniqroq va foydali (masalan, kalit yoki model noto'g'ri): shuni ko'rsatamiz.
      if (!lastErr) throw e;
    }
  }
  if (lastErr instanceof ApiError) throw lastErr;
  throw new ApiError(503, o.parts ? "PDF va rasmlarni o'qish uchun Gemini ulanmagan (GEMINI_API_KEY)." : "AI xizmati ulanmagan: bu bosqich bajarilmadi.", "ai_unconfigured");
}

const filePart = (f: { bytes: Uint8Array; mime: string }): GeminiPart => ({ inlineData: { mimeType: f.mime, data: Buffer.from(f.bytes).toString("base64") } });

export type FileInput = { bytes: Uint8Array; mime: string };
export type ExtractResult = { questions: ExtractedDraft[]; answerKey: { number: number; answers: string[] }[]; warnings: string[]; model: string; provider: Provider };

export async function classifyDocument(userId: string, f: FileInput): Promise<{ data: AiClassify; model: string; provider: Provider }> {
  if (f.bytes.length > MAX_INLINE_BYTES) throw new ApiError(413, "Fayl AI tahlili uchun juda katta (14 MB gacha). Hajmini kichraytiring yoki qismlarga bo'ling.", "too_big_for_ai");
  return aiJson({ userId, parts: [filePart(f), { text: classifyPrompt() }], system: SYSTEM_CLASSIFY, schema: aiClassifySchema, maxTokens: 2000, promptVersion: "import-classify@1" });
}

/** Matnli hujjat namunasidan fan va daraja taxmini (bitta qisqa AI chaqiruvi). */
export async function classifyText(userId: string, sample: string): Promise<{ data: AiClassify; model: string; provider: Provider }> {
  return aiJson({ userId, text: `${classifyPrompt()}\n<document>\n${sample}\n</document>`, system: SYSTEM_CLASSIFY, schema: aiClassifySchema, maxTokens: 1200, promptVersion: "import-classify-text@1" });
}

export async function extractFromFile(userId: string, f: FileInput, o: { fromPage?: number; toPage?: number; hint?: string; style?: LabelStyle; section?: number }): Promise<ExtractResult> {
  if (f.bytes.length > MAX_INLINE_BYTES) throw new ApiError(413, "Fayl AI tahlili uchun juda katta (14 MB gacha).", "too_big_for_ai");
  const r = await aiJson({ userId, parts: [filePart(f), { text: extractFromFilePrompt(o) }], system: SYSTEM_EXTRACT, schema: aiExtractSchema, maxTokens: 16000, promptVersion: "import-extract-file@1" });
  return { questions: normalizeAiQuestions(r.data.questions, { style: o.style, section: o.section, pageFallback: o.fromPage ? `${o.fromPage}-${o.toPage ?? o.fromPage}` : null }), answerKey: normalizeAiKey(r.data.answerKey, o.style), warnings: r.data.warnings, model: r.model, provider: r.provider };
}

export async function extractKeyFromFile(userId: string, f: FileInput, style?: LabelStyle): Promise<{ key: { number: number; answers: string[] }[]; model: string; provider: Provider }> {
  if (f.bytes.length > MAX_INLINE_BYTES) throw new ApiError(413, "Fayl AI tahlili uchun juda katta (14 MB gacha).", "too_big_for_ai");
  const r = await aiJson({ userId, parts: [filePart(f), { text: extractKeyPrompt() }], system: SYSTEM_EXTRACT, schema: aiExtractSchema, maxTokens: 8000, promptVersion: "import-key-file@1" });
  return { key: normalizeAiKey(r.data.answerKey, style), model: r.model, provider: r.provider };
}

export async function extractFromText(userId: string, chunk: string, o: { hint?: string; style?: LabelStyle; section?: number } = {}): Promise<ExtractResult> {
  const r = await aiJson({ userId, text: extractFromTextPrompt(chunk, { hint: o.hint }), system: SYSTEM_EXTRACT, schema: aiExtractSchema, maxTokens: 12000, promptVersion: "import-extract-text@1" });
  return { questions: normalizeAiQuestions(r.data.questions, { style: o.style, section: o.section }), answerKey: normalizeAiKey(r.data.answerKey, o.style), warnings: r.data.warnings, model: r.model, provider: r.provider };
}

/** Savollar paketini mustaqil tekshirish (fayldagi kalit AI ga ko'rsatilmaydi). `heavy`: murakkab savollar uchun kuchliroq model. */
export async function verifyBatch(userId: string, items: VerifyItem[], o: { heavy?: boolean } = {}): Promise<{ data: AiVerify; model: string; provider: Provider }> {
  return aiJson({ userId, text: verifyPrompt(items), system: SYSTEM_VERIFY, schema: aiVerifySchema, maxTokens: 6000, heavy: o.heavy, verify: true, promptVersion: o.heavy ? "import-verify-heavy@1" : "import-verify@1" });
}
