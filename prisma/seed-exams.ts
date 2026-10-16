/**
 * Imtihon simulyatori savollarini bazaga yuklaydi.
 * Ishlatish:  npm run db:seed-exams            (faqat yo'q imtihonlarni qo'shadi)
 *             npm run db:seed-exams -- --replace   (mavjud imtihon savollarini almashtiradi; eski urinishlar tahlili buzilishi mumkin)
 *             npm run db:seed-exams -- prisma/mening-testlarim.json   (boshqa fayldan)
 * Fayl formati: prisma/imtihon-namuna.json ga qarang.
 */
import { readFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";

type Q = { type: "CHOICE" | "WRITTEN"; text: string; options?: string[]; correct?: number; accepted?: string[]; explanation?: string };
type E = { slug: string; title: string; subject: string; kind: "TEST" | "WRITTEN" | "MIXED"; durationMin: number; pickCount?: number; questions: Q[] };

const args = process.argv.slice(2);
const replace = args.includes("--replace");
const file = args.find((a) => a.endsWith(".json")) ?? "prisma/imtihon-namuna.json";
const db = new PrismaClient();

function check(e: E) {
  if (!e.slug || !e.title || !e.subject || !e.durationMin || !e.questions?.length) throw new Error(`${e.slug}: slug, title, subject, durationMin va questions majburiy`);
  e.questions.forEach((q, i) => {
    const at = `${e.slug} #${i + 1}`;
    if (!q.text) throw new Error(`${at}: savol matni yo'q`);
    if (q.type === "CHOICE") {
      if (!q.options || q.options.length < 2 || q.options.length > 8) throw new Error(`${at}: 2 dan 8 gacha variant kerak`);
      if (!Number.isInteger(q.correct) || q.correct! < 0 || q.correct! >= q.options.length) throw new Error(`${at}: correct to'g'ri variant indeksi bo'lishi kerak (0 dan boshlab)`);
    } else if (q.type === "WRITTEN") {
      if (!q.accepted?.length) throw new Error(`${at}: accepted (qabul qilinadigan javoblar) kerak`);
    } else throw new Error(`${at}: type CHOICE yoki WRITTEN bo'lishi kerak`);
  });
}

async function main() {
  const { exams } = JSON.parse(readFileSync(file, "utf8")) as { exams: E[] };
  for (const e of exams) {
    check(e);
    const exist = await db.exam.findUnique({ where: { slug: e.slug }, select: { id: true } });
    if (exist && !replace) { console.log(`o'tkazib yuborildi (bor): ${e.slug}`); continue; }
    const data = { title: e.title, subject: e.subject, kind: e.kind, durationMin: e.durationMin, pickCount: e.pickCount ?? null, active: true };
    const exam = exist ? await db.exam.update({ where: { id: exist.id }, data }) : await db.exam.create({ data: { slug: e.slug, ...data } });
    if (exist) await db.examQuestion.deleteMany({ where: { examId: exam.id } });
    await db.examQuestion.createMany({
      data: e.questions.map((q, i) => ({ examId: exam.id, position: i, type: q.type, text: q.text, options: q.options ?? undefined, correct: q.correct ?? null, accepted: q.accepted ?? undefined, explanation: q.explanation ?? null })),
    });
    console.log(`${exist ? "yangilandi" : "qo'shildi"}: ${e.slug} (${e.questions.length} savol)`);
  }
}
main().catch((e) => { console.error(e.message ?? e); process.exitCode = 1; }).finally(() => db.$disconnect());