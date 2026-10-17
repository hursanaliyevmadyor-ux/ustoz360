import { z } from "zod";
import { isIsoDate } from "./planlogic";
import { aliasProblem } from "./sinflogic";

const text = (max: number) => z.string().trim().min(1, "Bo'sh bo'lmasligi kerak").max(max);

export const classInput = z.object({ name: text(40), subject: text(60), grade: z.string().trim().max(10).optional() });
export const aliasesInput = z.object({
  aliases: z.array(z.string()).min(1, "Kamida bitta taxallus kiriting").max(60).superRefine((arr, ctx) => {
    arr.forEach((a, i) => { const p = aliasProblem(a); if (p) ctx.addIssue({ code: "custom", path: [i], message: `«${a.trim().slice(0, 24)}»: ${p}` }); });
  }),
});
export const aliasRename = z.object({ alias: z.string().superRefine((a, ctx) => { const p = aliasProblem(a); if (p) ctx.addIssue({ code: "custom", message: p }); }) });

export const assessmentInput = z.object({
  title: text(80), topic: text(80),
  kind: z.enum(["BEFORE", "AFTER", "CURRENT"]),
  maxScore: z.number().int().min(1, "Eng yuqori ball kamida 1").max(1000),
  date: z.string().refine(isIsoDate, "Sana noto'g'ri"),
});
/** studentId -> ball (null: natijani o'chirish). Ball 0 dan eng yuqori ballgacha. */
export const scoresInput = z.object({ scores: z.record(z.string().max(40), z.number().min(0).max(1000).nullable()).refine((r) => Object.keys(r).length <= 100, "Juda ko'p natija") });
