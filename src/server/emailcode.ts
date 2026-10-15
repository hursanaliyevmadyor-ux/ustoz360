import { randomInt, timingSafeEqual } from "node:crypto";
import { ApiError, signValue } from "./auth";
import { db } from "./db";

export type CodePurpose = "verify" | "reset";

const CODE_TTL_MS = 10 * 60_000;
const RESEND_COOLDOWN_MS = 60_000;
const MAX_PER_HOUR = 5;
const MAX_ATTEMPTS = 5;

const hashCode = (email: string, purpose: CodePurpose, code: string) => signValue(`emailcode:${purpose}:${email}:${code}`);

/** Yangi 6 xonali kod yaratadi (xeshi saqlanadi) va kodni qaytaradi. Juda tez-tez so'ralsa 429. */
export async function issueCode(email: string, purpose: CodePurpose): Promise<string> {
  const now = Date.now();
  const last = await db.emailCode.findFirst({ where: { email, purpose }, orderBy: { createdAt: "desc" }, select: { createdAt: true } });
  if (last && now - last.createdAt.getTime() < RESEND_COOLDOWN_MS) throw new ApiError(429, "Kod yaqinda yuborilgan. 1 daqiqadan keyin qayta so'rang.", "too_soon");
  const hourly = await db.emailCode.count({ where: { email, purpose, createdAt: { gt: new Date(now - 3_600_000) } } });
  if (hourly >= MAX_PER_HOUR) throw new ApiError(429, "Bir soatda juda ko'p kod so'raldi. Keyinroq urinib ko'ring.", "rate_limited");
  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  await db.emailCode.create({ data: { email, purpose, codeHash: hashCode(email, purpose, code), expiresAt: new Date(now + CODE_TTL_MS) } });
  return code;
}

/** Kodni tekshiradi va ishlatilgan deb belgilaydi. Noto'g'ri bo'lsa urinishlar sonini oshiradi (5 tadan keyin kod bloklanadi). */
export async function consumeCode(email: string, purpose: CodePurpose, code: string): Promise<void> {
  const bad = new ApiError(400, "Kod noto'g'ri yoki muddati tugagan.", "bad_code");
  const row = await db.emailCode.findFirst({ where: { email, purpose, usedAt: null, expiresAt: { gt: new Date() } }, orderBy: { createdAt: "desc" } });
  if (!row) throw bad;
  if (row.attempts >= MAX_ATTEMPTS) throw new ApiError(429, "Juda ko'p noto'g'ri urinish. Yangi kod so'rang.", "too_many_attempts");
  const given = Buffer.from(hashCode(email, purpose, code.trim()));
  const real = Buffer.from(row.codeHash);
  const ok = given.length === real.length && timingSafeEqual(given, real);
  if (!ok) { await db.emailCode.update({ where: { id: row.id }, data: { attempts: { increment: 1 } } }); throw bad; }
  await db.emailCode.update({ where: { id: row.id }, data: { usedAt: new Date() } });
}
