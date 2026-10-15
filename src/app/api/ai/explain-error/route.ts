import { z } from "zod";
import { ApiError, requireUser } from "@/server/auth";
import { db } from "@/server/db";
import { handle } from "@/server/http";
import { runAi, usageToday } from "@/server/ai/gateway";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export const POST = (req: Request) => handle(async () => {
  const user = await requireUser();
  const { cardId } = z.object({ cardId: z.string().min(1) }).parse(await req.json());
  const card = await db.errorCard.findFirst({ where: { id: cardId, userId: user.id }, include: { question: { include: { options: true, topic: true } } } });
  if (!card) throw new ApiError(404, "Xato kartochkasi topilmadi.");
  const q = card.question;
  const opts = q.options.map((o, i) => `${String.fromCharCode(65 + i)}) ${o.text}${o.isCorrect ? " (to'g'ri javob)" : ""}`).join("\n");
  const prompt = `Mavzu: ${q.topic.name}\nSavol: ${q.text}\nVariantlar:\n${opts}\n\nO'qituvchi bu savolda ${card.mistakes} marta xato qilgan. To'g'ri javob nima uchun to'g'riligini, odatda qanday xato qilinishini va eslab qolish uchun qisqa maslahatni yoz (6-8 gapdan oshmasin).`;
  const r = await runAi({ userId: user.id, feature: "explain", messages: [{ role: "user", content: prompt }], maxTokens: 900, effort: "low" });
  return { explanation: r.text, ...(await usageToday(user.id)) };
});
