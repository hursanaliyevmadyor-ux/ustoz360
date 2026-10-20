import { z } from "zod";

/** Admin tahrirlaydigan ma'lumotlar uchun tekshiruvlar. Toza funksiyalar: bazaga tegmaydi. */

const text = (max: number) => z.string().trim().min(1, "Bo'sh bo'lmasligi kerak").max(max);
const optText = (max: number) => z.string().trim().max(max).optional().transform((v) => (v ? v : undefined));

/**
 * Savol: variantli (CHOICE) yoki yozma (WRITTEN). Variantlar FAQAT variantli savolga, qabul qilinadigan javoblar FAQAT yozma savolga
 * kiritiladi: admin savol kiritayotganda turini o'zi tanlaydi.
 */
export const questionInput = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("CHOICE"),
    text: text(2000),
    options: z.array(text(300)).min(2, "Kamida 2 ta variant kerak").max(8, "Ko'pi bilan 8 ta variant"),
    correct: z.number().int().min(0),
    explanation: optText(1000),
  }).refine((q) => q.correct < q.options.length, { message: "To'g'ri variant tanlanmagan", path: ["correct"] }),
  z.object({
    type: z.literal("WRITTEN"),
    text: text(2000),
    accepted: z.array(text(200)).min(1, "Kamida bitta to'g'ri javob kerak").max(10),
    explanation: optText(1000),
  }),
]);
export type QuestionInput = z.infer<typeof questionInput>;

export const examInput = z.object({
  title: text(120),
  subject: text(80),
  durationMin: z.number().int().min(1, "Vaqt kamida 1 daqiqa").max(300, "Vaqt ko'pi bilan 300 daqiqa"),
  /** Savollar bankidan nechtasi tushishi; bo'sh bo'lsa hammasi. */
  pickCount: z.number().int().min(1).max(500).nullable().optional(),
  active: z.boolean().optional(),
  /** Reyting yo'nalishi (sozlamalardagi kalit); bo'sh: hamma yo'nalish uchun umumiy. */
  directionKey: z.string().trim().regex(/^[A-Z][A-Z0-9_]{1,29}$/).nullable().optional(),
  /** Faqat admin tasdiqlagan imtihon natijalari reytingga hisoblanadi (nashr qilinganligi alohida). */
  rankingEligible: z.boolean().optional(),
});
export type ExamInput = z.infer<typeof examInput>;

export const seminarInput = z.object({
  title: text(160),
  description: optText(4000),
  speaker: optText(120),
  startsAt: z.string().refine((v) => !Number.isNaN(Date.parse(v)), "Sana noto'g'ri"),
  durationMin: z.number().int().min(5).max(1440).nullable().optional(),
  place: optText(200),
  link: z.string().trim().max(500).optional().transform((v) => (v ? v : undefined)).refine((v) => !v || /^https?:\/\/\S+$/i.test(v), "Havola http:// yoki https:// bilan boshlanishi kerak"),
  capacity: z.number().int().min(1).max(100000).nullable().optional(),
  active: z.boolean().optional(),
});
export type SeminarInput = z.infer<typeof seminarInput>;

export const QUESTION_STATUSES = ["DRAFT", "REVIEW", "APPROVED", "REJECTED", "ARCHIVED"] as const;
/** Mashq (Bilim laboratoriyasi) savollar banki: mavzuga bog'langan variantli savol, izoh va "Super kalit". */
export const bankQuestionInput = z.object({
  topicId: z.string().min(1, "Mavzu tanlanmagan").max(60),
  text: text(1000),
  options: z.array(text(300)).min(2, "Kamida 2 ta variant kerak").max(6, "Ko'pi bilan 6 ta variant"),
  correct: z.number().int().min(0),
  explanation: text(1500),
  superKey: optText(250),
  difficulty: z.enum(["EASY", "MEDIUM", "HARD"]),
  status: z.enum(QUESTION_STATUSES),
  sourceRef: optText(250),
  /** Tekshiriladigan ko'nikma/tushuncha: xatolar testi shu bo'yicha yangi vaziyatdagi savollarni topadi. */
  skill: optText(120),
  /** CLASSIC: oddiy savol; SITUATIONAL: dars vaziyatiga asoslangan murakkab savol (4 ta yaqin variant). */
  kind: z.enum(["CLASSIC", "SITUATIONAL"]).default("CLASSIC"),
}).refine((q) => q.correct < q.options.length, { message: "To'g'ri variant tanlanmagan", path: ["correct"] })
  .refine((q) => new Set(q.options.map((o) => o.toLowerCase())).size === q.options.length, { message: "Variantlar bir-biridan farq qilishi kerak", path: ["options"] });
export type BankQuestionInput = z.infer<typeof bankQuestionInput>;

/** Mavzu o'quv maqsadlari ("Bu mavzuda nimalarni bilib olasiz?"): 0–5 ta qisqa band. */
export const objectivesInput = z.object({ objectives: z.array(text(160)).max(5, "Ko'pi bilan 5 ta maqsad") });

export const nameInput = z.object({ name: text(120) });
export const topicInput = z.object({ name: text(120), subjectId: z.string().min(1).max(60) });

/** Imtihon turi savollar turidan o'zi aniqlanadi (qo'lda tanlanmaydi). */
export function deriveKind(types: readonly string[]): "TEST" | "WRITTEN" | "MIXED" {
  const hasChoice = types.includes("CHOICE"), hasWritten = types.includes("WRITTEN");
  if (hasChoice && hasWritten) return "MIXED";
  return hasWritten ? "WRITTEN" : "TEST";
}

/** Nomdan manzil uchun qisqa nom: "O'zbek tili 5-sinf" -> "ozbek-tili-5-sinf". */
export function slugify(s: string): string {
  const out = s.normalize("NFKD").toLowerCase().replace(/[‘’ʻʼ`´']/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
  return out || "nom";
}
