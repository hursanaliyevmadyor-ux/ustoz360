import { z } from "zod";
import { isIsoDate } from "./planlogic";

const text = (max: number) => z.string().trim().min(1, "Bo'sh bo'lmasligi kerak").max(max);
const optText = (max: number) => z.string().trim().max(max).optional().transform((v) => (v ? v : undefined));
const isoDate = z.string().refine(isIsoDate, "Sana noto'g'ri");

export const planItemInput = z.object({ date: isoDate, title: text(160), kind: z.enum(["TASK", "TEST", "REVIEW", "DIAG", "SIM", "EXAM"]).default("TASK") });
export const planItemPatch = z.object({ done: z.boolean().optional(), title: text(160).optional(), date: isoDate.optional() });

export const checklistInput = z.object({ label: text(160), note: optText(300) });
export const checklistPatch = z.object({ done: z.boolean().optional(), label: text(160).optional(), note: z.string().trim().max(300).optional() });

/** Rasmiy ma'lumot (admin kiritadi). Havola faqat https; sana majburiy (DATE uchun). */
export const officialInput = z.object({
  kind: z.enum(["LINK", "DATE"]),
  exam: z.enum(["ATTESTATSIYA", "MILLIY_SERTIFIKAT"]).nullable().optional(),
  title: text(200),
  url: z.string().trim().max(500).optional().transform((v) => (v ? v : undefined)).refine((v) => !v || /^https:\/\/\S+$/i.test(v), "Havola https:// bilan boshlanishi kerak"),
  date: isoDate.nullable().optional(),
  note: optText(500),
  sourceName: optText(160),
  verified: z.boolean().default(false),
  active: z.boolean().default(true),
}).superRefine((v, ctx) => {
  if (v.kind === "DATE" && !v.date) ctx.addIssue({ code: "custom", path: ["date"], message: "Sana kiritilishi shart" });
  if (v.kind === "LINK" && !v.url) ctx.addIssue({ code: "custom", path: ["url"], message: "Havola kiritilishi shart" });
  // Tekshirilgan deb belgilash uchun manba nomi kerak: manbasiz ma'lumot "rasmiy" ko'rinmasligi uchun.
  if (v.verified && !v.sourceName) ctx.addIssue({ code: "custom", path: ["sourceName"], message: "Tekshirilgan deb belgilash uchun manba nomini yozing" });
});
export type OfficialInput = z.infer<typeof officialInput>;
