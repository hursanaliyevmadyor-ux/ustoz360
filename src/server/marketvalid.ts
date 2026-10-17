import { z } from "zod";

const text = (max: number) => z.string().trim().min(1, "Bo'sh bo'lmasligi kerak").max(max);
const url = z.string().trim().max(500).optional().transform((v) => (v ? v : undefined))
  .refine((v) => !v || /^https:\/\/\S+$/i.test(v), "Havola https:// bilan boshlanishi kerak");

export const COURSE_KINDS = ["Videokurs", "Test to'plami", "Dars ishlanmasi", "Elektron kitob", "Mentorlik", "Intensiv"] as const;
export const COURSE_STATUSES = ["DRAFT", "REVIEW", "APPROVED", "REJECTED", "ARCHIVED"] as const;

export const courseInput = z.object({
  title: text(120),
  description: z.string().trim().min(20, "Tavsif kamida 20 belgi bo'lsin").max(3000),
  subject: text(60),
  kind: z.enum(COURSE_KINDS),
  priceUzs: z.number().int().min(0, "Narx manfiy bo'lmaydi").max(50_000_000, "Narx juda katta"),
  lessonCount: z.number().int().min(0).max(1000),
  accessUrl: url,
});
export type CourseInput = z.infer<typeof courseInput>;

export const courseReviewInput = z.discriminatedUnion("action", [
  z.object({ action: z.literal("approve") }),
  z.object({ action: z.literal("reject"), reason: text(300) }),
  z.object({ action: z.literal("archive") }),
]);

export const catalogQuery = z.object({
  q: z.string().trim().max(80).optional(),
  subject: z.string().trim().max(60).optional(),
  sort: z.enum(["new", "asc", "desc"]).optional(),
});

/** Muallif kursni qaysi holatlarda tahrirlay oladi: tasdiqlangan kurs tahrirlansa qayta tekshiruvga tushadi. */
export const EDITABLE = new Set(["DRAFT", "REJECTED", "APPROVED", "REVIEW"]);
export const nextStatusAfterEdit = (status: string) => (status === "APPROVED" || status === "REVIEW" ? "REVIEW" : "DRAFT");
