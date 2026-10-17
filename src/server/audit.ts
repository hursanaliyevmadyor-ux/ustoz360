import { Prisma } from "@prisma/client";
import { db } from "./db";

/** Muhim amallar jurnali (kim, nima qildi). Jurnal yozilmasa asosiy amal buzilmasligi uchun xato yutiladi. */
export async function audit(userId: string | null, action: string, meta?: Record<string, unknown>) {
  try {
    await db.auditLog.create({ data: { userId, action, ...(meta && { meta: meta as Prisma.InputJsonValue }) } });
  } catch (e) {
    console.error("audit", action, (e as Error).message);
  }
}
