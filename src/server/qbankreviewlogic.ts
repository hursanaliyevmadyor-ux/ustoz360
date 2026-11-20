import { z } from "zod";

/**
 * Savollar bankini bitalab tekshirish (admin): toza mantiq, bazaga tegmaydi.
 * «Tekshirilgan» belgisi `Question.answerStatus = "VERIFIED"` (sxema o'zgarmaydi; bankdagi savollarda bu maydon boshqa maqsadda ishlatilmaydi).
 * Kim va qachon tekshirgani auditga yoziladi.
 */
export const VERIFIED = "VERIFIED";

export const reviewAction = z.discriminatedUnion("type", [
  /** Javob to'g'ri: savol tasdiqlanadi va «tekshirilgan» deb belgilanadi. */
  z.object({ type: z.literal("approve") }),
  /** Javob noto'g'ri: to'g'ri variant va izoh o'zgartirilib, tasdiqlanadi. */
  z.object({ type: z.literal("fix"), correct: z.number().int().min(0).max(5), explanation: z.string().trim().min(10, "Izoh kamida 10 belgi bo'lsin").max(1500) }),
  /** Savol yaroqsiz: rad etiladi va imtihondan olinadi. */
  z.object({ type: z.literal("reject") }),
  /** Belgini qaytarib olish (qayta tekshirish uchun). */
  z.object({ type: z.literal("unverify") }),
]);
export type ReviewAction = z.infer<typeof reviewAction>;

/** Navbat tartibi: avval «Tekshiruvda», keyin boshqalar; ichida id bo'yicha (barqaror, takrorlanmaydi). */
const RANK: Record<string, number> = { REVIEW: 0, DRAFT: 1, APPROVED: 2 };
export const queueOrder = (a: { id: string; status: string }, b: { id: string; status: string }) =>
  (RANK[a.status] ?? 9) - (RANK[b.status] ?? 9) || a.id.localeCompare(b.id);

/** Izohning boshidagi «To'g'ri javob: X.» harfini yangi javobga moslaydi (harf bo'lmasa, boshiga qo'shadi). */
export function reletterExplanation(explanation: string, correct: number): string {
  const L = String.fromCharCode(65 + correct);
  const head = /^To'g'ri javob:\s*[A-F]\.?/;
  return head.test(explanation) ? explanation.replace(head, `To'g'ri javob: ${L}.`) : `To'g'ri javob: ${L}.\n${explanation}`;
}

/** Tekshiruv holati: nechtasi tekshirilgan, nechtasi qolgan (arxiv va rad etilganlar hisobga olinmaydi). */
export function progress(counts: { verified: number; total: number }) {
  const remaining = Math.max(0, counts.total - counts.verified);
  return { ...counts, remaining, percent: counts.total ? Math.round((counts.verified / counts.total) * 100) : 100 };
}

/** Ommaviy tasdiqlash: belgilangan savollar (ro'yxat) yoki filtrga mos hamma savol. Ikkalasi birga bo'lmaydi. */
export const bulkApproveInput = z.object({
  ids: z.array(z.string().min(1).max(60)).min(1, "Hech narsa belgilanmagan").max(1000, "Bir safar ko'pi bilan 1000 ta").optional(),
  all: z.boolean().optional(),
  filter: z.object({ status: z.string().max(20), topicId: z.string().max(60), source: z.string().max(20), q: z.string().max(100), verified: z.string().max(1) }).partial().optional(),
}).refine((x) => (x.ids ? 1 : 0) + (x.all ? 1 : 0) === 1, { message: "Savollar belgilanmagan." });
export type BulkApproveInput = z.infer<typeof bulkApproveInput>;
