/**
 * Faqat MAHALLIY sinov uchun: Google/Telegram'siz tizimga kirish imkonini beruvchi sinov foydalanuvchisi.
 *   npx tsx --env-file=.env.local prisma/dev-test-user.ts          -> foydalanuvchi + sessiya tokenini chiqaradi
 *   npx tsx --env-file=.env.local prisma/dev-test-user.ts --admin  -> admin roli bilan
 *   npx tsx --env-file=.env.local prisma/dev-test-user.ts --remove -> sinov foydalanuvchisi va uning ma'lumotlarini o'chiradi
 * Brauzerda: document.cookie = "u360_session=<TOKEN>; path=/"
 */
import { createHmac, randomBytes } from "node:crypto";
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();
// --second: ikkinchi sinov foydalanuvchisi (masalan, xaridor); --remove ikkalasini ham o'chiradi.
const SECOND = process.argv.includes("--second");
const EMAIL = SECOND ? "mashq-sinov2@example.invalid" : "mashq-sinov@example.invalid";

async function main() {
  const existing = await db.user.findUnique({ where: { email: EMAIL } });
  if (process.argv.includes("--remove")) {
    // Javoblar, sessiyalar, kurslar, to'lovlar, sinflar va hujjatlar foydalanuvchi o'chganda kaskad bilan o'chadi.
    for (const email of ["mashq-sinov@example.invalid", "mashq-sinov2@example.invalid"]) {
      const u = await db.user.findUnique({ where: { email } });
      if (!u) { console.log(`${email}: yo'q.`); continue; }
      await db.questionReport.deleteMany({ where: { userId: u.id } });
      await db.auditLog.deleteMany({ where: { userId: u.id } });
      await db.user.delete({ where: { id: u.id } });
      console.log(`${email}: o'chirildi.`);
    }
    return;
  }
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) throw new Error("AUTH_SECRET topilmadi.");
  const admin = process.argv.includes("--admin");
  const user = existing ?? await db.user.create({
    data: {
      email: EMAIL, name: "Sinov Foydalanuvchi", googleSub: SECOND ? "dev-test-mashq-2" : "dev-test-mashq", emailVerifiedAt: new Date(),
      roles: { create: { role: admin ? "ADMIN" : "TEACHER" } },
      profile: { create: { onboardedAt: new Date(), region: "Toshkent", district: "Yunusobod" } },
    },
  });
  if (admin && !(await db.userRole.findFirst({ where: { userId: user.id, role: "ADMIN" } }))) await db.userRole.create({ data: { userId: user.id, role: "ADMIN" } });
  const token = randomBytes(32).toString("base64url");
  await db.authSession.create({ data: { tokenHash: createHmac("sha256", secret).update(token).digest("hex"), userId: user.id, expiresAt: new Date(Date.now() + 86_400_000) } });
  console.log(`TOKEN=${token}`);
}
main().catch((e) => { console.error(e); process.exit(1); }).finally(() => db.$disconnect());
