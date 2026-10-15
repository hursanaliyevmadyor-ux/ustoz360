/**
 * DEMO seed: savollar namunaviy va ekspert tekshirmagan (isDemo=true).
 * Dev muhitda diagnostikani sinash uchun APPROVED qilib qo'yiladi; production'da ishlatilmaydi.
 */
import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();

const topics = [
  ["formativ-baholash", "Formativ baholash"], ["pedagogik-mahorat", "Pedagogik mahorat"], ["matematika-metodikasi", "Matematika metodikasi"],
  ["kasb-standarti", "Kasb standarti"], ["inklyuziv-talim", "Inklyuziv ta'lim"],
] as const;

type Q = { topic: string; level: "EASY" | "MEDIUM" | "HARD"; q: string; opts: string[]; a: number; why: string };
const qs: Q[] = [
  { topic: "formativ-baholash", level: "EASY", q: "Formativ baholashning asosiy maqsadi nima?", opts: ["O'quv yili oxirida yakuniy ball qo'yish", "O'qitish jarayonida qayta aloqa berib, o'rganishni yo'naltirish", "O'quvchilarni reytingga qo'yish", "Faqat uy vazifasini tekshirish"], a: 1, why: "Formativ baholash jarayon davomida o'qituvchi va o'quvchiga keyingi qadam uchun ma'lumot beradi." },
  { topic: "pedagogik-mahorat", level: "MEDIUM", q: "Dars maqsadi qaysi holatda to'g'ri qo'yilgan?", opts: ["Mavzuni tushuntirish", "O'quvchi kasrlarni solishtira oladi", "Darslikning 12-betini o'qish", "Dars vaqtida tartib saqlash"], a: 1, why: "Maqsad o'quvchi nimaga erishishini o'lchanadigan fe'l bilan ifodalashi kerak." },
  { topic: "matematika-metodikasi", level: "MEDIUM", q: "Bo'lish amalini tushunishda ko'paytirish bilan bog'liqlik nimani bildiradi?", opts: ["Ular bir-biriga bog'liq emas", "Bo'lish — ko'paytirishga teskari amal", "Bo'lish faqat qoldiqli bo'ladi", "Ko'paytirish bo'lishdan keyin o'rganiladi"], a: 1, why: "Bo'lish ko'paytirishga teskari amal: 12 : 3 = 4, chunki 3 × 4 = 12." },
  { topic: "kasb-standarti", level: "HARD", q: "Qaysi holat o'qituvchining kasbiy rivojlanish talabiga to'g'ri keladi?", opts: ["Bir marta kursga borib, qayta o'qimaslik", "O'z faoliyatini tahlil qilib, rejali malaka oshirish", "Faqat sertifikat to'plash", "Boshqalarning dars rejasini ko'chirish"], a: 1, why: "Kasbiy rivojlanish refleksiya va rejali o'sishga asoslanadi." },
  { topic: "inklyuziv-talim", level: "EASY", q: "Differensial topshiriqlar nima uchun beriladi?", opts: ["Bir xil topshiriq berish uchun", "Turli tayyorgarlikdagi o'quvchilar bir maqsadga erishishi uchun", "O'quvchilarni guruhlarga bo'lib ajratish uchun", "Vaqtni qisqartirish uchun"], a: 1, why: "Maqsad bir, yo'llar va murakkablik darajasi turlicha." },
];

async function main() {
  const subject = await db.subject.upsert({ where: { slug: "umumiy-pedagogika" }, update: {}, create: { slug: "umumiy-pedagogika", name: "Umumiy pedagogika (DEMO)" } });
  const topicId: Record<string, string> = {};
  for (const [slug, name] of topics) topicId[slug] = (await db.topic.upsert({ where: { slug }, update: {}, create: { slug, name, subjectId: subject.id } })).id;

  await db.question.deleteMany({ where: { isDemo: true } });
  for (const q of qs) {
    await db.question.create({
      data: {
        topicId: topicId[q.topic], text: q.q, explanation: q.why, difficulty: q.level, status: "APPROVED", isDemo: true,
        options: { create: q.opts.map((text, i) => ({ text, isCorrect: i === q.a, position: i })) },
      },
    });
  }
  console.log(`Seed: ${qs.length} ta DEMO savol (APPROVED, isDemo)`);
}
main().finally(() => db.$disconnect());
