/**
 * Foydalanuvchiga ADMIN rolini beradi (yoki olib tashlaydi).
 * Ishlatish:  npm run db:make-admin -- <foydalanuvchi_id yoki email>
 *             npm run db:make-admin -- <id yoki email> --remove
 */
import { PrismaClient } from "@prisma/client";

const [who, flag] = process.argv.slice(2);
const db = new PrismaClient();

async function main() {
  if (!who) throw new Error("Foydalanuvchi id yoki emailini yozing.");
  const user = await db.user.findFirst({ where: { OR: [{ id: who }, { email: who.toLowerCase() }] }, include: { roles: true } });
  if (!user) throw new Error(`Foydalanuvchi topilmadi: ${who}`);
  if (flag === "--remove") {
    await db.userRole.deleteMany({ where: { userId: user.id, role: "ADMIN" } });
    console.log(`ADMIN roli olib tashlandi: ${user.name ?? user.email ?? user.id}`);
    return;
  }
  const has = user.roles.some((r) => r.role === "ADMIN");
  if (!has) await db.userRole.create({ data: { userId: user.id, role: "ADMIN" } });
  await db.auditLog.create({ data: { userId: user.id, action: "admin.role_granted" } });
  console.log(`${has ? "Allaqachon admin" : "ADMIN roli berildi"}: ${user.name ?? "(ismsiz)"} <${user.email ?? "email yo'q"}>`);
}
main().catch((e) => { console.error(e.message ?? e); process.exitCode = 1; }).finally(() => db.$disconnect());