/**
 * Kitob va hujjatlardan tayyorlangan qisqa bilim yozuvlarini AI Bilim markaziga (KnowledgeEntry) administrator nomidan kiritadi.
 * Ma'lumot: papkadagi *.json fayllar ({ book, sourceVersion, category, subject, expiresOn?, entries: [{ q, a, topic?, subject? }] }).
 * Hech narsa o'chirilmaydi va o'zgartirilmaydi: savol matni bir xil yozuv bor bo'lsa o'tkazib yuboriladi (qayta ishga tushirish xavfsiz).
 *
 * Ishlatish (o'z terminalingizda):
 *   npx tsx --env-file=.env.local prisma/import-knowledge.ts <papka>                     -> faqat tekshiradi (hech narsa yozmaydi)
 *   npx tsx --env-file=.env.local prisma/import-knowledge.ts <papka> --apply             -> bazaga yozadi
 *   ... --admin <email>   (standart: birinchi SUPERADMIN)   ... --replace-book "<kitob nomi>" : shu manbaning ESKI yozuvlarini arxivlaydi (o'chirmaydi)
 * Har yozuv KnowledgeAudit (operation entry.create, metadata.via = "import") va AuditLog ga yoziladi. hubMode o'zgartirilmaydi.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { Prisma, PrismaClient } from "@prisma/client";
import { entryInput } from "../src/server/hub/knowledgevalid";
import { normalizeSources, searchTextOf, sharedWordRun } from "../src/server/hub/knowledgelogic";
import { findPii } from "../src/server/hub/privacy";

type Item = { q: string; a: string; topic?: string | null; subject?: string | null };
type Pack = { book: string; sourceVersion?: string | null; category?: string; subject?: string | null; expiresOn?: string | null; entries: Item[] };

const args = process.argv.slice(2);
const flag = (n: string) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : undefined; };
const adminEmail = flag("--admin");
const replaceBook = flag("--replace-book");
// papka: bayroq qiymati bo'lmagan birinchi argument
const dirArg = args.find((a, i) => !a.startsWith("--") && !["--admin", "--replace-book"].includes(args[i - 1] ?? ""));
if (!dirArg) { console.error("Papka yo'lini bering."); process.exit(1); }
const dir: string = dirArg;
const apply = args.includes("--apply");

const db = new PrismaClient();
const TX = { maxWait: 15_000, timeout: 60_000 } as const;

async function main() {
  const files = readdirSync(dir).filter((f) => f.toLowerCase().endsWith(".json")).sort();
  if (!files.length) throw new Error(`Papkada .json yo'q: ${dir}`);

  const admin = adminEmail
    ? await db.user.findFirst({ where: { email: adminEmail.toLowerCase(), roles: { some: { role: { in: ["ADMIN", "SUPERADMIN"] } } } }, select: { id: true, email: true } })
    : await db.user.findFirst({ where: { roles: { some: { role: "SUPERADMIN" } } }, select: { id: true, email: true }, orderBy: { createdAt: "asc" } });
  if (!admin) throw new Error("Administrator topilmadi (--admin <email> bering).");
  console.log(`Administrator: ${admin.email ?? admin.id}${apply ? "" : "  [TEKSHIRUV: hech narsa yozilmaydi]"}`);

  const have = new Set((await db.knowledgeEntry.findMany({ select: { questionCanonical: true } })).map((e) => e.questionCanonical.trim().toLowerCase()));
  const seen = new Set<string>();
  let ok = 0, skip = 0, bad = 0, written = 0;
  const problems: string[] = [];

  for (const f of files) {
    const pack = JSON.parse(readFileSync(join(dir, f), "utf8")) as Pack;
    for (const [i, it] of pack.entries.entries()) {
      const label = `${f} #${i + 1}`;
      const parsed = entryInput.safeParse({
        questionCanonical: it.q, answer: it.a, subject: it.subject ?? pack.subject ?? null, topic: it.topic ?? null,
        category: pack.category ?? "general", sources: [], sourceVersion: pack.sourceVersion ?? pack.book, expiresOn: pack.expiresOn ?? null,
      });
      if (!parsed.success) { bad++; problems.push(`${label}: ${parsed.error.issues[0]?.message}`); continue; }
      const e = parsed.data;
      if (findPii(e.questionCanonical).length || findPii(e.answer).length) { bad++; problems.push(`${label}: shaxsiy ma'lumotga o'xshash matn`); continue; }
      const key = e.questionCanonical.trim().toLowerCase();
      if (have.has(key) || seen.has(key)) { skip++; continue; }
      seen.add(key); ok++;
      if (!apply) continue;
      await db.$transaction(async (t) => {
        const row = await t.knowledgeEntry.create({
          data: {
            questionCanonical: e.questionCanonical.trim(), answer: e.answer.trim(), subject: e.subject, topic: e.topic, category: e.category,
            sourceReferences: normalizeSources(e.sources) as Prisma.InputJsonValue, sourceVersion: e.sourceVersion,
            expiresAt: e.expiresOn ? new Date(`${e.expiresOn}T23:59:59Z`) : null, searchText: searchTextOf(e.questionCanonical, e.answer),
            origin: "ADMIN", status: "APPROVED", reviewedBy: admin.id, reviewedAt: new Date(),
          },
          select: { id: true },
        });
        await t.knowledgeAudit.create({ data: { actor: admin.id, operation: "entry.create", entryId: row.id, metadata: { via: "import", book: pack.book, file: f } as Prisma.InputJsonValue } });
      }, TX);
      written++;
    }
  }

  if (apply && replaceBook) {
    const old = await db.knowledgeEntry.findMany({ where: { sourceVersion: replaceBook, status: "APPROVED" }, select: { id: true } });
    console.log(`Eski «${replaceBook}» yozuvlari: ${old.length} ta (arxivga o'tkazilmaydi: avval yangilari kiritildi; qo'lda arxivlang).`);
  }
  if (apply && written) await db.auditLog.create({ data: { userId: admin.id, action: "knowledge.import", meta: { written, files: files.length, via: "import-knowledge.ts" } } }).catch(() => undefined);

  console.log(`Tekshirildi: ${ok + skip + bad} ta; yangi: ${ok}; takror (o'tkazildi): ${skip}; xato: ${bad}${apply ? `; YOZILDI: ${written}` : ""}`);
  for (const p of problems.slice(0, 30)) console.log("  XATO:", p);
  if (bad) process.exitCode = 2;
}

void sharedWordRun;
main().catch((e) => { console.error(e.message ?? e); process.exitCode = 1; }).finally(() => db.$disconnect());
