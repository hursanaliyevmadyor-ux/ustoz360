import { z } from "zod";
import { TASK_LABEL, type TaskType } from "../docsvalid";
import { LESSON_SECTIONS } from "./gateway";
import { generateStructured } from "./structured";
import { aiTaskReply, normalizeAiTasks, TASK_SHAPE } from "./tasks";

/** DARSYOR AI qoralamalari: sayt (API) ham, Telegram bot ham shu funksiyalarni ishlatadi. Natija har doim QORALAMA: o'qituvchi tekshiradi. */

export const lessonInput = z.object({
  subject: z.string().trim().min(1).max(80), grade: z.coerce.number().int().min(1).max(11),
  topic: z.string().trim().min(2).max(200), duration: z.coerce.number().int().min(10).max(120).default(45),
  goal: z.string().trim().max(500).optional().default(""),
});
const lessonReply = z.object({ sections: z.array(z.object({ title: z.coerce.string(), content: z.coerce.string() })).min(1) });

export async function generateLesson(userId: string, b: z.infer<typeof lessonInput>) {
  const prompt = `Quyidagi dars uchun ishlanma tuz.\nFan: ${b.subject}\nSinf: ${b.grade}\nMavzu: ${b.topic}\nDavomiyligi: ${b.duration} daqiqa\nMaqsad: ${b.goal || "(ko'rsatilmagan, o'zing mos maqsad yoz)"}\n\nQuyidagi bo'limlarning har biri uchun amaliy, vaqt taqsimotini hisobga olgan matn yoz, aynan shu tartib va nomlarda: ${LESSON_SECTIONS.join("; ")}.`;
  const r = await generateStructured({ userId, feature: "lesson", prompt, schema: lessonReply, shape: '{"sections":[{"title":"bo\'lim nomi","content":"matn"}]}', maxTokens: 4000, promptVersion: "lesson@2", knowledge: `${b.subject} ${b.topic}` });
  const map = Object.fromEntries(r.data.sections.map((s) => [s.title.trim(), s.content]));
  return { sections: Object.fromEntries(LESSON_SECTIONS.map((t) => [t, map[t] ?? ""])) as Record<string, string>, model: r.model };
}

const LEVEL = { easy: "oson", medium: "o'rta", hard: "murakkab" } as const;
export const TASK_TYPES_ALL = ["single", "multi", "match", "order", "open", "situation", "logic", "text"] as const;
export const tasksInput = z.object({
  subject: z.string().trim().min(1).max(80), grade: z.string().trim().min(1).max(10), topic: z.string().trim().min(2).max(200),
  level: z.enum(["easy", "medium", "hard"]), count: z.number().int().min(1).max(15),
  types: z.array(z.enum(TASK_TYPES_ALL)).min(1).max(8),
  /** Matn asosida savol uchun o'qituvchi bergan matn. */
  passage: z.string().trim().max(3000).optional(),
});

export async function generateTasks(userId: string, b: z.infer<typeof tasksInput>) {
  const typeList = b.types.map((t) => `${t} (${TASK_LABEL[t]})`).join(", ");
  const prompt = [
    `${b.grade}-sinf, fan: ${b.subject}, mavzu: ${b.topic}. Qiyinlik: ${LEVEL[b.level]}.`,
    `Jami ${b.count} ta topshiriq tuz, turlari: ${typeList}. Turlarni teng taqsimla.`,
    "Qoidalar: bir javobli savolda aynan bitta to'g'ri variant (correct: bitta indeks), variantlar bir-biriga yaqin va uzunligi o'xshash bo'lsin; ko'p javobli savolda kamida 2 ta to'g'ri variant; moslashtirishda 3-5 juftlik (pairs); ketma-ketlikda options to'g'ri tartibda yoziladi; ochiq/vaziyatli/mantiqiy/matn asosidagi savolda answer maydoniga namunaviy javob yoki baholash mezonini yoz. Har birida explanation bo'lsin.",
    "Faktni o'ylab topma; ishonching komil bo'lmagan ma'lumot yozma. Rasmiy hujjat raqamlarini keltirma.",
    b.passage ? `Matn asosida savollar uchun shu matndan foydalan:\n"""${b.passage}"""` : "",
  ].filter(Boolean).join("\n");
  const r = await generateStructured({ userId, feature: "taskset", prompt, schema: aiTaskReply, shape: TASK_SHAPE, maxTokens: 3500, promptVersion: "taskset@1", knowledge: `${b.subject} ${b.topic}` });
  const { items, problems } = normalizeAiTasks(r.data, b.types as readonly TaskType[], b.count);
  return { items, problems, model: r.model, note: !items.length ? "AI mos topshiriq qaytarmadi. Qayta urinib ko'ring yoki qo'lda qo'shing." : problems ? `${problems} ta topshiriqda kamchilik bor: tahrirlab to'g'rilang.` : null };
}
