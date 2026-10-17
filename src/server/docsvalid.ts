import { z } from "zod";

/** DARSYOR: o'qituvchi hujjatlari (dars ishlanmasi, ko'rgazma, rubrika, kuzatuv varaqasi, topshiriqlar to'plami). Toza tekshiruvlar. */

const s = (max: number) => z.string().trim().max(max);
const line = (max: number) => z.string().max(max);

export const DOC_KINDS = ["lesson_plan", "visual", "rubric", "observation", "taskset"] as const;
export type DocKind = (typeof DOC_KINDS)[number];
export const DOC_LABEL: Record<DocKind, string> = { lesson_plan: "Dars ishlanmasi", visual: "Ko'rgazmali material", rubric: "Rubrika", observation: "Kuzatuv varaqasi", taskset: "Topshiriqlar to'plami" };

// ---------- dars ishlanmasi ----------
export const lessonPlanData = z.object({
  params: z.object({ subject: s(80), grade: s(10), topic: s(200), duration: z.number().int().min(10).max(180), goal: s(500).optional() }),
  sections: z.record(s(80), line(8000)),
  ai: z.boolean().optional(),
});

// ---------- ko'rgazmali materiallar ----------
const items = (max = 12) => z.array(line(160)).max(max);
export const VISUAL_TEMPLATES = ["venn", "cluster", "frayer", "compare", "fishbone", "cards", "handout"] as const;
export const visualData = z.discriminatedUnion("template", [
  z.object({ template: z.literal("venn"), labels: z.array(line(60)).min(2).max(3), items: z.array(items()).min(2).max(3), shared: items() }),
  z.object({ template: z.literal("cluster"), center: line(80), branches: z.array(z.object({ label: line(60), items: items(8) })).max(8) }),
  z.object({ template: z.literal("frayer"), term: line(80), definition: line(400), characteristics: line(400), examples: line(400), nonExamples: line(400) }),
  z.object({ template: z.literal("compare"), headers: z.array(line(60)).min(2).max(5), rows: z.array(z.array(line(200)).max(5)).max(20) }),
  z.object({ template: z.literal("fishbone"), problem: line(120), causes: z.array(z.object({ label: line(60), items: items(6) })).max(6) }),
  z.object({ template: z.literal("cards"), cards: z.array(z.object({ front: line(200), back: line(300) })).max(24) }),
  z.object({ template: z.literal("handout"), blocks: z.array(z.object({ heading: line(120).optional(), text: line(3000) })).max(20) }),
]);

// ---------- rubrika va kuzatuv varaqasi ----------
export const rubricData = z.object({
  levels: z.array(line(40)).min(2).max(5),
  criteria: z.array(z.object({ name: line(120), cells: z.array(line(400)).max(5) })).min(1).max(15),
});
export const observationData = z.object({
  group: s(80),
  indicators: z.array(line(160)).min(1).max(20),
  columns: z.array(line(40)).min(1).max(12),
  /** "satr:ustun" -> "+" | "±" | "-" */
  marks: z.record(z.string().max(12), z.enum(["+", "±", "-"])),
  notes: line(2000),
});

// ---------- topshiriqlar to'plami (test generatori) ----------
export const TASK_TYPES = ["single", "multi", "match", "order", "open", "situation", "logic", "text"] as const;
export type TaskType = (typeof TASK_TYPES)[number];
export const TASK_LABEL: Record<TaskType, string> = { single: "Bir javobli", multi: "Ko'p javobli", match: "Moslashtirish", order: "Ketma-ketlik", open: "Ochiq savol", situation: "Vaziyatli savol", logic: "Mantiqiy topshiriq", text: "Matn asosida savol" };
export const taskItem = z.object({
  type: z.enum(TASK_TYPES),
  text: s(1500).min(1, "Savol matni bo'sh bo'lmasin"),
  /** single/multi: variantlar; order: to'g'ri tartibdagi bandlar. */
  options: z.array(line(300)).max(8),
  /** single/multi: to'g'ri variantlar indekslari. */
  correct: z.array(z.number().int().min(0).max(7)).max(8),
  pairs: z.array(z.object({ l: line(200), r: line(200) })).max(8),
  /** open/situation/logic/text: namunaviy javob yoki baholash mezoni. */
  answer: line(1500),
  explanation: line(1000),
  /** AI qoralamasi o'qituvchi tasdiqlamaguncha o'quvchi varag'iga kirmaydi. */
  approved: z.boolean(),
  source: z.enum(["manual", "ai"]),
});
export type TaskItem = z.infer<typeof taskItem>;
export const tasksetData = z.object({
  params: z.object({ subject: s(80), grade: s(10), topic: s(200), level: z.enum(["easy", "medium", "hard"]) }),
  items: z.array(taskItem).max(60),
  /** SINF tahlilidan kelgan kontekst (ixtiyoriy): shu sinf va mavzu uchun. */
  context: z.object({ classId: s(60).optional(), topic: s(200).optional() }).optional(),
});

/** Variantli savol to'g'ri tuzilganmi (ikki to'g'ri javob bir variantli savolda bo'lmasligi va h.k.): approved bo'lishidan oldin tekshiriladi. */
export function taskProblems(t: TaskItem): string[] {
  const p: string[] = [];
  const opts = t.options.filter((o) => o.trim());
  if (t.type === "single" || t.type === "multi") {
    if (opts.length < 2) p.push("Kamida 2 ta variant kerak.");
    if (t.type === "single" && t.correct.length !== 1) p.push("Bir javobli savolda aynan bitta to'g'ri variant bo'lsin.");
    if (t.type === "multi" && t.correct.length < 2) p.push("Ko'p javobli savolda kamida 2 ta to'g'ri variant bo'lsin.");
    if (t.correct.some((i) => i >= t.options.length || !t.options[i]?.trim())) p.push("To'g'ri variant bo'sh qolgan.");
    if (new Set(opts.map((o) => o.trim().toLowerCase())).size !== opts.length) p.push("Variantlar bir-biridan farq qilsin.");
  } else if (t.type === "order") {
    if (opts.length < 3) p.push("Ketma-ketlik uchun kamida 3 band kerak.");
  } else if (t.type === "match") {
    if (t.pairs.filter((x) => x.l.trim() && x.r.trim()).length < 2) p.push("Moslashtirish uchun kamida 2 ta juftlik kerak.");
  } else if (!t.answer.trim()) p.push("Namunaviy javob yoki baholash mezonini yozing.");
  return p;
}

export const docInput = z.object({
  kind: z.enum(DOC_KINDS),
  title: s(120).min(1, "Nom bo'sh bo'lmasin"),
  subject: s(80).optional(),
  grade: s(10).optional(),
  status: z.enum(["DRAFT", "SAVED"]).default("SAVED"),
  data: z.unknown(),
}).superRefine((v, ctx) => {
  const map = { lesson_plan: lessonPlanData, visual: visualData, rubric: rubricData, observation: observationData, taskset: tasksetData } as const;
  const r = map[v.kind].safeParse(v.data);
  if (!r.success) ctx.addIssue({ code: "custom", path: ["data"], message: `Ma'lumot tuzilmasi noto'g'ri: ${r.error.issues[0]?.path.join(".") || "ildiz"}` });
  if (JSON.stringify(v.data ?? null).length > 200_000) ctx.addIssue({ code: "custom", path: ["data"], message: "Hujjat juda katta (200 KB dan oshmasin)." });
});
export type DocInput = z.infer<typeof docInput>;

/** Chop etish uchun deterministik aralashtirish (har chop etishda bir xil, kalit bilan). */
export function seededShuffle<T>(arr: T[], seed: string): T[] {
  let h = 2166136261;
  for (const ch of seed) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
  const rnd = () => { h ^= h << 13; h ^= h >>> 17; h ^= h << 5; return ((h >>> 0) % 100000) / 100000; };
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
