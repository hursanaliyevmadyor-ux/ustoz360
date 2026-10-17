import type { z } from "zod";
import { ApiError } from "../auth";
import { aiConfigured, freeConfigured, runAi, runFreeAi, type AiFeature, type AiResult } from "./gateway";
import { parseStructured } from "./parse";

/**
 * Yagona kirish nuqtasi: bepul xizmat ulangan bo'lsa shu, bo'lmasa Claude. Hech biri ulanmagan bo'lsa 503 (ai_unconfigured):
 * chaqiruvchi shu holatda qo'lda ishlash imkonini beradi (sahifa buzilmaydi, "AI ishlayapti" deb aldanmaydi).
 */
export async function runAnyAi(o: { userId: string; feature: AiFeature; messages: { role: "user" | "assistant"; content: string }[]; system?: string; maxTokens: number; promptVersion: string }): Promise<AiResult> {
  if (freeConfigured()) return runFreeAi(o.userId, o.messages, { system: o.system, maxTokens: o.maxTokens, feature: o.feature, promptVersion: o.promptVersion });
  if (aiConfigured()) return runAi({ userId: o.userId, feature: o.feature, messages: o.messages, maxTokens: o.maxTokens, effort: "medium", system: o.system, promptVersion: o.promptVersion });
  throw new ApiError(503, "AI xizmati hali ulanmagan. Qo'lda to'ldirishingiz mumkin.", "ai_unconfigured");
}

/** Tuzilmali javob: JSON so'raladi, Zod bilan tekshiriladi; noto'g'ri bo'lsa xatoni aytib bir marta qayta so'raladi. */
export async function generateStructured<T>(o: { userId: string; feature: AiFeature; system?: string; prompt: string; schema: z.ZodType<T>; shape: string; maxTokens: number; promptVersion: string }): Promise<{ data: T; model: string }> {
  const instruction = `${o.prompt}\n\nJavobni FAQAT bitta JSON obyekt ko'rinishida ber (izoh, markdown belgisi yo'q). Format:\n${o.shape}`;
  const messages: { role: "user" | "assistant"; content: string }[] = [{ role: "user", content: instruction }];
  let lastError = "";
  for (let attempt = 0; attempt < 2; attempt++) {
    const r = await runAnyAi({ userId: o.userId, feature: o.feature, messages, system: o.system, maxTokens: o.maxTokens, promptVersion: o.promptVersion });
    const p = parseStructured(r.text, o.schema);
    if (p.ok) return { data: p.data, model: r.model };
    lastError = p.error;
    messages.push({ role: "assistant", content: r.text.slice(0, 4000) }, { role: "user", content: `Javob formati noto'g'ri edi (${p.error}). Faqat to'g'ri JSON obyektni qaytar.` });
  }
  throw new ApiError(502, `AI javobi kutilgan formatda emas (${lastError}). Qayta urinib ko'ring.`);
}
