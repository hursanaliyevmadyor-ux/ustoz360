import { z } from "zod";
import { ApiError, requireUser } from "@/server/auth";
import { REGIONS } from "@/lib/regions";
import { db } from "@/server/db";
import { handle } from "@/server/http";
export const dynamic = "force-dynamic";

const EXAMS = ["ATTESTATSIYA", "MILLIY_SERTIFIKAT"] as const;
const body = z.object({
  name: z.string().trim().max(80).optional(),
  subjectFocus: z.string().trim().max(80).optional(),
  grades: z.string().trim().max(40).optional(),
  experience: z.number().int().min(0).max(70).nullable().optional(),
  category: z.string().trim().max(60).optional(),
  targetExam: z.enum(EXAMS).nullable().optional(),
  examDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((v) => !Number.isNaN(Date.parse(v + "T00:00:00Z")) && new Date(v + "T00:00:00Z").toISOString().startsWith(v), "Noto'g'ri sana").nullable().optional(),
  dailyMinutes: z.number().int().min(10).max(480).nullable().optional(),
  region: z.enum(REGIONS).optional(),
  district: z.string().trim().max(80).optional(),
  /** Birinchi ro'yxatdan o'tishni yakunlash: ism, viloyat va tuman majburiy. */
  complete: z.boolean().optional(),
});

const shape = (u: { name: string | null; email: string | null }, p: Awaited<ReturnType<typeof db.profile.findUnique>>) => ({
  name: u.name ?? "", email: u.email ?? "", subjectFocus: p?.subjectFocus ?? "", grades: p?.grades ?? "", experience: p?.experience ?? null, category: p?.category ?? "",
  targetExam: p?.targetExam ?? null, examDate: p?.examDate ? p.examDate.toISOString().slice(0, 10) : null, dailyMinutes: p?.dailyMinutes ?? null,
  region: p?.region ?? "", district: p?.district ?? "", onboarded: !!p?.onboardedAt,
});

export const GET = () => handle(async () => {
  const user = await requireUser();
  return shape(user, await db.profile.findUnique({ where: { userId: user.id } }));
});

export const PUT = (req: Request) => handle(async () => {
  const user = await requireUser();
  const b = body.parse(await req.json());
  if (b.complete) {
    const fullName = (b.name ?? "").trim();
    if (fullName.split(/\s+/).filter(Boolean).length < 2) throw new ApiError(400, "Ism va familiyani to'liq yozing.");
    if (!b.region) throw new ApiError(400, "Viloyatni tanlang.");
    if (!b.district?.trim()) throw new ApiError(400, "Tuman yoki shahar nomini yozing.");
  }
  if (b.name !== undefined) await db.user.update({ where: { id: user.id }, data: { name: b.name || null } });
  const data = {
    ...(b.subjectFocus !== undefined && { subjectFocus: b.subjectFocus || null }), ...(b.grades !== undefined && { grades: b.grades || null }),
    ...(b.experience !== undefined && { experience: b.experience }), ...(b.category !== undefined && { category: b.category || null }),
    ...(b.targetExam !== undefined && { targetExam: b.targetExam }), ...(b.dailyMinutes !== undefined && { dailyMinutes: b.dailyMinutes }),
    ...(b.examDate !== undefined && { examDate: b.examDate ? new Date(b.examDate + "T00:00:00Z") : null }),
    ...(b.region !== undefined && { region: b.region }), ...(b.district !== undefined && { district: b.district || null }),
    ...(b.complete && { onboardedAt: new Date() }),
  };
  const p = await db.profile.upsert({ where: { userId: user.id }, create: { userId: user.id, ...data }, update: data });
  await db.auditLog.create({ data: { userId: user.id, action: "profile.update" } });
  const fresh = await db.user.findUniqueOrThrow({ where: { id: user.id } });
  return shape(fresh, p);
});
