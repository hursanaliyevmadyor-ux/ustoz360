import { requireUser } from "@/server/auth";
import { handle } from "@/server/http";
import { usageToday } from "@/server/ai/gateway";
import { generateLesson, lessonInput } from "@/server/ai/generate";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Dars ishlanmasi QORALAMASI. AI ulanmagan bo'lsa 503 (ai_unconfigured): sahifa bo'sh shablon bilan qo'lda to'ldirishni taklif qiladi. */
export const POST = (req: Request) => handle(async () => {
  const user = await requireUser();
  const b = lessonInput.parse(await req.json());
  const r = await generateLesson(user.id, b);
  return { sections: r.sections, model: r.model, ...(await usageToday(user.id)) };
});
