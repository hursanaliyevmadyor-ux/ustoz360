// Berilgan .sql faylni (har bir buyruqni alohida) bazaga qo'llaydi. Ishlatish:
//   npx tsx --env-file=.env.local prisma/apply-sql.ts prisma/supabase-update-practice.sql
import { readFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";

async function main() {
  const file = process.argv[2];
  if (!file) throw new Error("SQL fayl yo'lini bering.");
  const sql = readFileSync(file, "utf8").split("\n").filter((l) => !l.trim().startsWith("--")).join("\n");
  const parts = sql.split(/;\s*(?:\n|$)/).map((s) => s.trim()).filter(Boolean);
  const db = new PrismaClient();
  try {
    for (const p of parts) {
      await db.$executeRawUnsafe(p);
      console.log("OK:", p.replace(/\s+/g, " ").slice(0, 90));
    }
    console.log(`Tayyor: ${parts.length} ta buyruq bajarildi.`);
  } finally {
    await db.$disconnect();
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
