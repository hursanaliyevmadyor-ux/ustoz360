import { z } from "zod";
import { canonLabel, type LabelStyle } from "./keyparse";
import type { DraftQuestion, Opt, QType } from "./qparse";

/**
 * AI javoblari uchun sxemalar va me'yorlashtirish (toza funksiyalar). AI ga ishonilmaydi: hamma narsa tekshiriladi, yorliqlar
 * tartib bo'yicha qayta yoziladi, savol matni o'zgartirilmaydi, noaniq joy belgilanadi.
 */
const optString = z.string().nullable().optional();

export const aiFigureSchema = z.object({
  n: z.union([z.number(), z.string()]).nullable().optional(),
  page: z.union([z.number(), z.string()]).nullable().optional(),
  box: z.array(z.union([z.number(), z.string()])).nullable().optional(),
  kind: optString, caption: optString,
});

export const aiQuestionSchema = z.object({
  number: z.union([z.number(), z.string()]).nullable().optional(),
  group: optString,
  text: z.string().default(""),
  options: z.array(z.object({ label: optString, text: z.string().default("") })).default([]),
  type: optString,
  page: z.union([z.number(), z.string()]).nullable().optional(),
  answer: z.union([z.array(z.string()), z.string()]).nullable().optional(),
  figures: z.array(aiFigureSchema).nullable().optional(),
  subject: optString, topic: optString, grade: optString, difficulty: optString,
  uncertain: z.boolean().nullable().optional(),
  note: optString,
});
export type AiQuestion = z.infer<typeof aiQuestionSchema>;

export const aiKeyItem = z.object({ number: z.union([z.number(), z.string()]), answer: z.union([z.array(z.string()), z.string()]), group: optString });

/**
 * Savoldagi rasm/jadval/formula joyi. `box`: [ymin, xmin, ymax, xmax], sahifaning 0..1000 me'yorlashtirilgan koordinatalari (yuqori-chap burchakdan).
 * Matnda joyi `[[RASM:n]]` belgisi bilan ko'rsatiladi (asl joyida).
 */
export type Figure = { n: number; page: number | null; box: [number, number, number, number] | null; kind: "figure" | "table" | "formula" | "unreadable"; caption?: string };
export const FIGURE_MARK = /\[\[RASM:(\d{1,2})\]\]/g;

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

export type ExtractedDraft = DraftQuestion & { subject: string | null; topic: string | null; grade: string | null; difficulty: "EASY" | "MEDIUM" | "HARD"; uncertain: boolean; group: string | null; figures: Figure[] };

const FIGURE_KINDS = ["figure", "table", "formula", "unreadable"] as const;
/** AI bergan rasm joylarini tekshiradi: koordinatalar 0..1000 ga qisiladi, noto'g'ri qutilar tashlanadi (rasm joyi esa saqlanadi). */
export function normalizeFigures(items: z.infer<typeof aiFigureSchema>[] | null | undefined, pageOffset = 0): Figure[] {
  const out: Figure[] = [];
  for (const f of items ?? []) {
    const n = toNum(f.n) ?? out.length + 1;
    if (out.some((x) => x.n === n)) continue;
    const nums = (f.box ?? []).map((v) => Number(v));
    let box: Figure["box"] = null;
    if (nums.length === 4 && nums.every((v) => Number.isFinite(v))) {
      const c = nums.map((v) => Math.max(0, Math.min(1000, Math.round(v))));
      if (c[2] - c[0] >= 8 && c[3] - c[1] >= 8) box = [c[0], c[1], c[2], c[3]];
    }
    const kind = FIGURE_KINDS.find((k) => k === String(f.kind ?? "").toLowerCase()) ?? "figure";
    const pg = toNum(f.page);
    out.push({ n, page: pg ? pg + pageOffset : null, box, kind, ...(f.caption ? { caption: clean(f.caption).slice(0, 120) } : {}) });
  }
  return out;
}

/** AI ajratgan savollarni tizim ichki ko'rinishiga keltiradi. Variant yorliqlari tartib bo'yicha A, B, C... qilib yoziladi. */
export function normalizeAiQuestions(items: AiQuestion[], opts: { pageFallback?: string | null; style?: LabelStyle; section?: number; pageOffset?: number } = {}): ExtractedDraft[] {
  const offset = opts.pageOffset ?? 0;
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
    // Sahifa raqami: kesilgan PDF bo'lagida AI bo'lak ichidagi raqamni beradi, shuning uchun asl fayldagi raqamga o'tkaziladi.
    const pn = it.page === null || it.page === undefined ? null : toNum(it.page);
    const page = it.page === null || it.page === undefined ? opts.pageFallback ?? null : pn && offset ? String(pn + offset) : String(it.page);
    const incomplete = ["SINGLE", "MULTI", "SITUATIONAL"].includes(qtype) && options.length < 2;
    // Rasm joylari: belgi (`[[RASM:n]]`) matnda bo'lmasa, savol matni oxiriga qo'shiladi (variantlardan oldin).
    const figures = normalizeFigures(it.figures, offset).map((f) => (f.page ? f : { ...f, page: pn ? pn + offset : null }));
    let qtext = text;
    for (const f of figures) if (!new RegExp(`\\[\\[RASM:${f.n}\\]\\]`).test(qtext)) qtext += `\n[[RASM:${f.n}]]`;
    out.push({
      number: toNum(it.number), text: qtext, options, page, section: opts.section ?? 0, qtype, inlineAnswer: ans.length ? ans : null, incomplete,
      note: it.note ? clean(it.note) : undefined,
      subject: it.subject ? clean(it.subject) : null, topic: it.topic ? clean(it.topic) : null, grade: it.grade ? clean(it.grade) : null,
      difficulty: normalizeDifficulty(it.difficulty), uncertain: !!it.uncertain || figures.some((f) => f.kind === "unreadable"),
      group: cleanGroup(it.group), figures,
    });
  }
  return out;
}

/** Test/bo'lim sarlavhasi: ortiqcha belgilar tozalanadi, juda uzun bo'lsa qisqartiriladi. */
export const cleanGroup = (g: unknown): string | null => { const s = typeof g === "string" ? clean(g).replace(/^[\s:.\-–—]+|[\s:.\-–—]+$/g, "").slice(0, 120) : ""; return s || null; };

export function normalizeAiKey(items: z.infer<typeof aiKeyItem>[], style: LabelStyle = "latin"): { number: number; answers: string[]; group: string | null }[] {
  const out: { number: number; answers: string[]; group: string | null }[] = [];
  for (const k of items) { const n = toNum(k.number); const a = labelsOf(k.answer, style); if (n && a.length) out.push({ number: n, answers: a, group: cleanGroup(k.group) }); }
  return out;
}
