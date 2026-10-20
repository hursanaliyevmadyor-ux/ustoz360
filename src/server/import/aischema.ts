import { z } from "zod";
import { canonLabel, type LabelStyle } from "./keyparse";
import type { DraftQuestion, Opt, QType } from "./qparse";

/**
 * AI javoblari uchun sxemalar va me'yorlashtirish (toza funksiyalar). AI ga ishonilmaydi: hamma narsa tekshiriladi, yorliqlar
 * tartib bo'yicha qayta yoziladi, savol matni o'zgartirilmaydi, noaniq joy belgilanadi.
 */
const optString = z.string().nullable().optional();

export const aiQuestionSchema = z.object({
  number: z.union([z.number(), z.string()]).nullable().optional(),
  text: z.string().default(""),
  options: z.array(z.object({ label: optString, text: z.string().default("") })).default([]),
  type: optString,
  page: z.union([z.number(), z.string()]).nullable().optional(),
  answer: z.union([z.array(z.string()), z.string()]).nullable().optional(),
  subject: optString, topic: optString, grade: optString, difficulty: optString,
  uncertain: z.boolean().nullable().optional(),
  note: optString,
});
export type AiQuestion = z.infer<typeof aiQuestionSchema>;

export const aiKeyItem = z.object({ number: z.union([z.number(), z.string()]), answer: z.union([z.array(z.string()), z.string()]) });

export const aiExtractSchema = z.object({
  questions: z.array(aiQuestionSchema).default([]),
  answerKey: z.array(aiKeyItem).default([]),
  warnings: z.array(z.string()).default([]),
});
export type AiExtract = z.infer<typeof aiExtractSchema>;

export const aiClassifySchema = z.object({
  pageCount: z.number().nullable().optional(),
  sections: z.array(z.object({ kind: z.string(), fromPage: z.number().nullable().optional(), toPage: z.number().nullable().optional() })).default([]),
  subject: optString, grade: optString, language: optString,
  hasQuestions: z.boolean().nullable().optional(), hasAnswerKey: z.boolean().nullable().optional(),
  note: optString,
});
export type AiClassify = z.infer<typeof aiClassifySchema>;

export const aiVerifySchema = z.object({
  results: z.array(z.object({
    id: z.string(),
    answer: z.union([z.string(), z.array(z.string()), z.null()]).optional(),
    confidence: optString,
    explanation: optString,
    usedSources: z.array(z.string()).nullable().optional(),
    needsExternal: z.boolean().nullable().optional(),
    reasoningChecked: z.boolean().nullable().optional(),
    note: optString,
  })).default([]),
});
export type AiVerify = z.infer<typeof aiVerifySchema>;

const QTYPES: QType[] = ["SINGLE", "MULTI", "MATCHING", "ORDERING", "SHORT", "SITUATIONAL", "UNKNOWN"];
const toNum = (v: unknown): number | null => { const n = typeof v === "number" ? v : typeof v === "string" ? parseInt(v.replace(/\D/g, ""), 10) : NaN; return Number.isFinite(n) && n > 0 ? n : null; };
const clean = (s: string) => s.replace(/ /g, " ").replace(/[ \t]+/g, " ").trim();

/** AI javobidagi harf(lar)ni lotin yorlig'iga aylantiradi: «b», «B)», «Б» → «B». Tanib bo'lmasa bo'sh. */
export function labelsOf(v: unknown, style: LabelStyle = "latin"): string[] {
  let raw = Array.isArray(v) ? v.join(",") : typeof v === "string" ? v : "";
  if (/^[A-Ja-j]{2,4}$/.test(raw.trim())) raw = raw.trim().split("").join(","); // «AC» → A, C
  const out: string[] = [];
  for (const m of raw.matchAll(/(?<![\p{L}])[A-Ja-jАБВГДЕабвгде](?![\p{L}])/gu)) { const l = canonLabel(m[0], style); if (l && !out.includes(l)) out.push(l); }
  return out.sort();
}

export function normalizeType(t: unknown): QType {
  const u = typeof t === "string" ? t.trim().toUpperCase().replace(/[\s-]+/g, "_") : "";
  if (u === "MULTIPLE" || u === "MULTI_CHOICE" || u === "MULTIPLE_CHOICE_MULTI") return "MULTI";
  if (u === "SINGLE_CHOICE" || u === "MCQ" || u === "MULTIPLE_CHOICE") return "SINGLE";
  if (u === "SHORT_ANSWER" || u === "OPEN") return "SHORT";
  if (u === "ORDER" || u === "SEQUENCE") return "ORDERING";
  if (u === "MATCH") return "MATCHING";
  if (u === "SCENARIO" || u === "CASE") return "SITUATIONAL";
  return (QTYPES as string[]).includes(u) ? (u as QType) : "UNKNOWN";
}

export function normalizeDifficulty(d: unknown): "EASY" | "MEDIUM" | "HARD" {
  const u = typeof d === "string" ? d.trim().toUpperCase() : "";
  if (u.startsWith("EASY") || u.startsWith("OSON") || u === "1") return "EASY";
  if (u.startsWith("HARD") || u.startsWith("QIYIN") || u === "3") return "HARD";
  return "MEDIUM";
}

export type ExtractedDraft = DraftQuestion & { subject: string | null; topic: string | null; grade: string | null; difficulty: "EASY" | "MEDIUM" | "HARD"; uncertain: boolean };

/** AI ajratgan savollarni tizim ichki ko'rinishiga keltiradi. Variant yorliqlari tartib bo'yicha A, B, C... qilib yoziladi. */
export function normalizeAiQuestions(items: AiQuestion[], opts: { pageFallback?: string | null; style?: LabelStyle; section?: number } = {}): ExtractedDraft[] {
  const style = opts.style ?? "latin";
  const out: ExtractedDraft[] = [];
  for (const it of items) {
    const text = clean(it.text ?? "");
    if (!text) continue;
    // Bo'sh variantlar tashlanadi; qolganlar tartib bo'yicha A, B, C... bo'ladi. AI ko'rsatgan javob yorlig'i asl yorliq bo'yicha moslanadi.
    const raw = (it.options ?? []).map((o, i) => ({ orig: canonLabel((o.label ?? "").replace(/[^\p{L}]/gu, "").slice(0, 1), style) ?? "ABCDEFGHIJ"[i], text: clean(o.text ?? "") })).filter((o) => o.text).slice(0, 10);
    const options: Opt[] = raw.map((o, i) => ({ label: "ABCDEFGHIJ"[i], text: o.text }));
    const toNew = new Map(raw.map((o, i) => [o.orig, "ABCDEFGHIJ"[i]] as const));
    const ans = [...new Set(labelsOf(it.answer ?? null, style).map((l) => toNew.get(l)).filter((x): x is string => !!x))].sort();
    let qtype = normalizeType(it.type);
    if (options.length >= 2 && (qtype === "UNKNOWN" || qtype === "SHORT")) qtype = ans.length > 1 ? "MULTI" : "SINGLE";
    const page = it.page === null || it.page === undefined ? opts.pageFallback ?? null : String(it.page);
    const incomplete = ["SINGLE", "MULTI", "SITUATIONAL"].includes(qtype) && options.length < 2;
    out.push({
      number: toNum(it.number), text, options, page, section: opts.section ?? 0, qtype, inlineAnswer: ans.length ? ans : null, incomplete,
      note: it.note ? clean(it.note) : undefined,
      subject: it.subject ? clean(it.subject) : null, topic: it.topic ? clean(it.topic) : null, grade: it.grade ? clean(it.grade) : null,
      difficulty: normalizeDifficulty(it.difficulty), uncertain: !!it.uncertain,
    });
  }
  return out;
}

export function normalizeAiKey(items: z.infer<typeof aiKeyItem>[], style: LabelStyle = "latin"): { number: number; answers: string[] }[] {
  const out: { number: number; answers: string[] }[] = [];
  for (const k of items) { const n = toNum(k.number); const a = labelsOf(k.answer, style); if (n && a.length) out.push({ number: n, answers: a }); }
  return out;
}
