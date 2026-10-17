import { z } from "zod";
import { requireUser } from "@/server/auth";
import { handle } from "@/server/http";
import { generateStructured } from "@/server/ai/structured";
import { aiTaskReply, normalizeAiTasks, TASK_SHAPE } from "@/server/ai/tasks";
import { TASK_LABEL, TASK_TYPES } from "@/server/docsvalid";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const LEVEL = { easy: "oson", medium: "o'rta", hard: "murakkab" } as const;
const body = z.object({
  subject: z.string().trim().min(1).max(80), grade: z.string().trim().min(1).max(10), topic: z.string().trim().min(2).max(200),
  level: z.enum(["easy", "medium", "hard"]), count: z.number().int().min(1).max(15),
  types: z.array(z.enum(TASK_TYPES)).min(1).max(8),
  /** Matn asosida savol uchun o'qituvchi bergan matn. */
  passage: z.string().trim().max(3000).optional(),
});

/** AI topshiriq QORALAMASINI yaratadi: hammasi tasdiqlanmagan holda qaytadi, o'qituvchi tekshirib tasdiqlaydi. */
export const POST = (req: Request) => handle(async () => {
  const user = await requireUser();
  const b = body.parse(await req.json());
  const typeList = b.types.map((t) => `${t} (${TASK_LABEL[t]})`).join(", ");
  const prompt = [
    `${b.grade}-sinf, fan: ${b.subject}, mavzu: ${b.topic}. Qiyinlik: ${LEVEL[b.level]}.`,
    `Jami ${b.count} ta topshiriq tuz, turlari: ${typeList}. Turlarni teng taqsimla.`,
    "Qoidalar: bir javobli savolda aynan bitta to'g'ri variant (correct: bitta indeks), variantlar bir-biriga yaqin va uzunligi o'xshash bo'lsin; ko'p javobli savolda kamida 2 ta to'g'ri variant; moslashtirishda 3-5 juftlik (pairs); ketma-ketlikda options to'g'ri tartibda yoziladi; ochiq/vaziyatli/mantiqiy/matn asosidagi savolda answer maydoniga namunaviy javob yoki baholash mezonini yoz. Har birida explanation bo'lsin.",
    "Faktni o'ylab topma; ishonching komil bo'lmagan ma'lumot yozma. Rasmiy hujjat raqamlarini keltirma.",
    b.passage ? `Matn asosida savollar uchun shu matndan foydalan:\n"""${b.passage}"""` : "",
  ].filter(Boolean).join("\n");
  const r = await generateStructured({ userId: user.id, feature: "taskset", prompt, schema: aiTaskReply, shape: TASK_SHAPE, maxTokens: 3500, promptVersion: "taskset@1" });
  const { items, problems } = normalizeAiTasks(r.data, b.types, b.count);
  if (!items.length) return { items: [], problems: 0, note: "AI mos topshiriq qaytarmadi. Qayta urinib ko'ring yoki qo'lda qo'shing." };
  return { items, problems, model: r.model, note: problems ? `${problems} ta topshiriqda kamchilik bor: tahrirlab to'g'rilang.` : null };
});
