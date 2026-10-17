import { z } from "zod";
import { TASK_TYPES, taskProblems, type TaskItem, type TaskType } from "../docsvalid";

/** AI yaratgan topshiriqlarni tekshirish va tozalash (toza funksiyalar). AI javobi noto'g'ri bo'lsa ham sahifa buzilmaydi. */

const str = z.coerce.string().catch("");
export const aiTaskReply = z.object({
  items: z.array(z.object({
    type: z.string().catch("single"),
    text: str,
    options: z.array(str).catch([]),
    correct: z.array(z.coerce.number().int()).catch([]),
    pairs: z.array(z.object({ l: str, r: str })).catch([]),
    answer: str,
    explanation: str,
  })).min(1),
});

const TYPE_ALIAS: Record<string, TaskType> = { single_choice: "single", multiple: "multi", multi_choice: "multi", matching: "match", ordering: "order", sequence: "order", open_ended: "open", situational: "situation", logical: "logic", reading: "text" };
const asType = (t: string): TaskType | null => {
  const k = t.trim().toLowerCase();
  if ((TASK_TYPES as readonly string[]).includes(k)) return k as TaskType;
  return TYPE_ALIAS[k] ?? null;
};

/** Ruxsat etilgan turlarga mos, uzunligi cheklangan, tasdiqlanmagan (approved=false) topshiriqlar. */
export function normalizeAiTasks(reply: z.infer<typeof aiTaskReply>, allowed: readonly TaskType[], max: number): { items: TaskItem[]; problems: number } {
  const out: TaskItem[] = [];
  let problems = 0;
  for (const r of reply.items) {
    const type = asType(r.type) ?? allowed[0];
    if (!allowed.includes(type)) continue;
    const item: TaskItem = {
      type, text: r.text.trim().slice(0, 1500),
      options: type === "single" || type === "multi" || type === "order" ? r.options.map((o) => o.trim().slice(0, 300)).filter(Boolean).slice(0, 8) : [],
      correct: type === "single" || type === "multi" ? Array.from(new Set(r.correct)).filter((i) => i >= 0 && i < 8) : [],
      pairs: type === "match" ? r.pairs.map((p) => ({ l: p.l.trim().slice(0, 200), r: p.r.trim().slice(0, 200) })).filter((p) => p.l && p.r).slice(0, 8) : [],
      answer: r.answer.trim().slice(0, 1500), explanation: r.explanation.trim().slice(0, 1000),
      approved: false, source: "ai",
    };
    if (!item.text) continue;
    if (taskProblems(item).length) problems++;
    out.push(item);
    if (out.length >= max) break;
  }
  return { items: out, problems };
}

export const TASK_SHAPE = `{"items":[{"type":"single|multi|match|order|open|situation|logic|text","text":"savol matni","options":["variant", "..."],"correct":[0],"pairs":[{"l":"chap","r":"o'ng"}],"answer":"namunaviy javob (ochiq turlar uchun)","explanation":"nima uchun shunday"}]}`;
