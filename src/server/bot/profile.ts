import { db } from "../db";

/** Botdan profilni yangilash: saytdagi /api/profile bilan bir xil maydonlar (faqat kerakligi). */
export type ProfilePatch = {
  name?: string; targetExam?: "ATTESTATSIYA" | "MILLIY_SERTIFIKAT" | null; examDate?: string | null; dailyMinutes?: number | null;
  region?: string; district?: string; complete?: boolean;
};

export async function saveProfile(userId: string, p: ProfilePatch) {
  if (p.name !== undefined) await db.user.update({ where: { id: userId }, data: { name: p.name || null } });
  const data = {
    ...(p.targetExam !== undefined && { targetExam: p.targetExam }),
    ...(p.examDate !== undefined && { examDate: p.examDate ? new Date(p.examDate + "T00:00:00Z") : null }),
    ...(p.dailyMinutes !== undefined && { dailyMinutes: p.dailyMinutes }),
    ...(p.region !== undefined && { region: p.region }),
    ...(p.district !== undefined && { district: p.district || null }),
    ...(p.complete && { onboardedAt: new Date() }),
  };
  await db.profile.upsert({ where: { userId }, create: { userId, ...data }, update: data });
  await db.auditLog.create({ data: { userId, action: "profile.update_bot" } });
}

export const EXAM_LABEL = { ATTESTATSIYA: "Attestatsiya", MILLIY_SERTIFIKAT: "Milliy sertifikat" } as const;
