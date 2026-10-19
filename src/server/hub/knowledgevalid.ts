import { z } from "zod";
import { isIsoDate } from "../planlogic";
import { ENTRY_ACTIONS } from "./knowledgelogic";

const optText = (max: number) => z.string().trim().max(max).nullish().transform((v) => (v ? v : null));
const sourceRef = z.object({ title: z.string().trim().max(140).optional(), url: z.string().trim().max(500).refine((v) => /^https:\/\/\S+$/i.test(v), "Manba havolasi https:// bilan boshlanishi kerak") });
const futureDate = z.string().refine(isIsoDate, "Sana noto'g'ri").refine((v) => new Date(`${v}T23:59:59Z`).getTime() > Date.now(), "Tugash sanasi kelajakda bo'lishi kerak");

const body = {
  questionCanonical: z.string().trim().min(8, "Savol kamida 8 belgi bo'lsin").max(500),
  answer: z.string().trim().min(20, "Javob kamida 20 belgi bo'lsin").max(6000),
  subject: optText(60),
  topic: optText(120),
  category: z.enum(["general", "normative"]).default("general"),
  sources: z.array(sourceRef).max(8, "Ko'pi bilan 8 ta manba").default([]),
  sourceVersion: optText(120),
  /** YYYY-MM-DD. Me'yoriy yozuvda majburiy. */
  expiresOn: z.union([futureDate, z.literal(""), z.null()]).optional().transform((v) => (v ? v : null)),
};

const needNormative = (v: { category: string; sources: unknown[]; expiresOn: string | null }, ctx: z.RefinementCtx) => {
  // Me'yoriy ma'lumot (qaror, attestatsiya talablari...): manbasiz va muddatsiz saqlanmaydi.
  if (v.category !== "normative") return;
  if (!v.sources.length) ctx.addIssue({ code: "custom", path: ["sources"], message: "Me'yoriy ma'lumot uchun kamida bitta rasmiy manba (https) kerak" });
  if (!v.expiresOn) ctx.addIssue({ code: "custom", path: ["expiresOn"], message: "Me'yoriy ma'lumot uchun tekshiruv muddatini (tugash sanasini) belgilang" });
};

/** Admin qo'lda bilim kiritadi yoki nomzodni tasdiqlayotganda tahrirlaydi. */
export const entryInput = z.object(body).superRefine(needNormative);
export type EntryInput = z.infer<typeof entryInput>;

/** Mavjud yozuvni tahrirlash: hamma maydon ixtiyoriy emas, to'liq yuboriladi (bir xil qoida). */
export const entryUpdate = entryInput;

export const entryActionInput = z.object({ action: z.enum(ENTRY_ACTIONS as [string, ...string[]]), note: optText(300), expiresOn: body.expiresOn });

export const candidateReviewInput = z.discriminatedUnion("decision", [
  z.object({ decision: z.literal("approve"), entry: entryInput }),
  z.object({ decision: z.literal("reject"), note: optText(300) }),
]);

export const feedbackInput = z.object({
  entryId: z.string().min(1).max(40),
  rating: z.union([z.literal(1), z.literal(-1)]),
  reason: z.enum(["wrong", "outdated", "unclear", "off_topic", "other"]).optional(),
});

export const consentInput = z.object({ enabled: z.boolean() });
