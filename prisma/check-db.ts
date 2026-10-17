/**
 * Faqat O'QISH: Prisma sxemasi bilan haqiqiy bazani (Supabase) solishtiradi.
 *   npx tsx --env-file=.env.local prisma/check-db.ts
 * Hech narsa yozmaydi, o'chirmaydi. Natija: yetishmayotgan jadval/ustunlar va jadval qatorlari soni.
 */
import { Prisma, PrismaClient } from "@prisma/client";

const db = new PrismaClient();

async function main() {
  const models = Prisma.dmmf.datamodel.models;
  const cols = await db.$queryRawUnsafe<{ table_name: string; column_name: string }[]>(
    `select table_name, column_name from information_schema.columns where table_schema = 'public'`,
  );
  const have = new Map<string, Set<string>>();
  for (const c of cols) { if (!have.has(c.table_name)) have.set(c.table_name, new Set()); have.get(c.table_name)!.add(c.column_name); }

  const missingTables: string[] = []; const missingCols: string[] = [];
  for (const m of models) {
    const t = m.dbName ?? m.name;
    const set = have.get(t);
    if (!set) { missingTables.push(t); continue; }
    for (const f of m.fields) {
      if (f.kind === "object") continue;
      const col = f.dbName ?? f.name;
      if (!set.has(col)) missingCols.push(`${t}.${col}`);
    }
  }
  const enums = await db.$queryRawUnsafe<{ typname: string }[]>(`select typname from pg_type t join pg_namespace n on n.oid = t.typnamespace where n.nspname = 'public' and t.typtype = 'e'`);
  const haveEnums = new Set(enums.map((e) => e.typname));
  const missingEnums = Prisma.dmmf.datamodel.enums.map((e) => e.name).filter((n) => !haveEnums.has(n));

  console.log("Jadvallar (sxemada):", models.length, "| bazada topilmagan:", missingTables.length ? missingTables.join(", ") : "yo'q");
  console.log("Yetishmayotgan ustunlar:", missingCols.length ? missingCols.join(", ") : "yo'q");
  console.log("Yetishmayotgan enum'lar:", missingEnums.length ? missingEnums.join(", ") : "yo'q");

  const extra = [...have.keys()].filter((t) => !models.some((m) => (m.dbName ?? m.name) === t) && !t.startsWith("_prisma"));
  console.log("Sxemada yo'q jadvallar (bazada ortiqcha):", extra.length ? extra.join(", ") : "yo'q");

  console.log("\nQatorlar soni:");
  for (const m of models) {
    const t = m.dbName ?? m.name;
    if (!have.has(t)) continue;
    const r = await db.$queryRawUnsafe<{ n: bigint }[]>(`select count(*)::bigint as n from "${t}"`);
    console.log(`  ${t}: ${r[0].n}`);
  }
  const roles = await db.$queryRawUnsafe<{ role: string; n: bigint }[]>(`select role::text as role, count(*)::bigint as n from "UserRole" group by role`);
  console.log("\nRollar:", roles.map((r) => `${r.role}=${r.n}`).join(", ") || "yo'q");
  const qs = await db.$queryRawUnsafe<{ status: string; isDemo: boolean; n: bigint }[]>(`select status::text as status, "isDemo", count(*)::bigint as n from "Question" group by status, "isDemo"`);
  console.log("Savollar:", qs.map((r) => `${r.status}${r.isDemo ? "(namunaviy)" : ""}=${r.n}`).join(", ") || "yo'q");
}

main().catch((e) => { console.error("XATO:", (e as Error).message); process.exitCode = 1; }).finally(() => db.$disconnect());
