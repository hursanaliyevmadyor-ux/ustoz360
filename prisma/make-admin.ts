/**
 * Foydalanuvchiga ADMIN (yoki --super bilan SUPERADMIN: bosh administrator) rolini beradi yoki olib tashlaydi.
 * Ishlatish:  npm run db:make-admin -- <foydalanuvchi_id yoki email>
 *             npm run db:make-admin -- <id yoki email> --super     (ADMIN + SUPERADMIN)
 *             npm run db:make-admin -- <id yoki email> --remove    (ikkalasini ham olib tashlaydi)
 */
import { PrismaClient, type RoleKey } from "@prisma/client";

const [who, ...flags] = process.argv.slice(2);
const db = new PrismaClient();

async function main() {
  if (!who) throw new Error("Foydalanuvchi id yoki emailini yozing.");
  const user = await db.user.findFirst({ where: { OR: [{ id: who }, { email: who.toLowerCase() }] }, include: { roles: true } });
  if (!user) throw new Error(`Foydalanuvchi topilmadi: ${who}`);
  if (flags.includes("--remove")) {
    await db.userRole.deleteMany({ where: { userId: user.id, role: { in: ["ADMIN", "SUPERADMIN"] } } });
    console.log(`Admin rollari olib tashlandi: ${user.name ?? user.email ?? user.id}`);
    return;
  }
  const want: RoleKey[] = flags.includes("--super") ? ["ADMIN", "SUPERADMIN"] : ["ADMIN"];
  const added: RoleKey[] = [];
  for (const role of want) if (!user.roles.some((r) => r.role === role)) { await db.userRole.create({ data: { userId: user.id, role } }); added.push(role); }
  if (added.length) await db.auditLog.create({ data: { userId: user.id, action: "admin.role_granted", meta: { roles: added } } });
  console.log(`${added.length ? `Berildi: ${added.join(", ")}` : "Rollar allaqachon bor"} -> ${user.name ?? "(ismsiz)"} <${user.email ?? "email yo'q"}>`);
}
main().catch((e) => { console.error(e.message ?? e); process.exitCode = 1; }).finally(() => db.$disconnect());
