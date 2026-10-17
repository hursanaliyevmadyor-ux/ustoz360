import { z } from "zod";
import { requireUser } from "@/server/auth";
import { handle } from "@/server/http";
import { LESSON_SECTIONS, usageToday } from "@/server/ai/gateway";
import { generateStructured } from "@/server/ai/structured";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const body = z.object({
  subject: z.string().trim().min(1).max(80), grade: z.coerce.number().int().min(1).max(11),
  topic: z.string().trim().min(2).max(200), duration: z.coerce.number().int().min(10).max(120).default(45),
  goal: z.string().trim().max(500).optional().default(""),
});
const reply = z.object({ sections: z.array(z.object({ title: z.coerce.string(), content: z.coerce.string() })).min(1) });

/** Dars ishlanmasi QORALAMASI. AI ulanmagan bo'lsa 503 (ai_unconfigured): sahifa bo'sh shablon bilan qo'lda to'ldirishni taklif qiladi. */
export const POST = (req: Request) => handle(async () => {
  const user = await requireUser();
  const b = body.parse(await req.json());
  const prompt = `Quyidagi dars uchun ishlanma tuz.\nFan: ${b.subject}\nSinf: ${b.grade}\nMavzu: ${b.topic}\nDavomiyligi: ${b.duration} daqiqa\nMaqsad: ${b.goal || "(ko'rsatilmagan, o'zing mos maqsad yoz)"}\n\nQuyidagi bo'limlarning har biri uchun amaliy, vaqt taqsimotini hisobga olgan matn yoz, aynan shu tartib va nomlarda: ${LESSON_SECTIONS.join("; ")}.`;
  const r = await generateStructured({ userId: user.id, feature: "lesson", prompt, schema: reply, shape: '{"sections":[{"title":"bo\'lim nomi","content":"matn"}]}', maxTokens: 4000, promptVersion: "lesson@2" });
  const map = Object.fromEntries(r.data.sections.map((s) => [s.title.trim(), s.content]));
  return { sections: Object.fromEntries(LESSON_SECTIONS.map((t) => [t, map[t] ?? ""])), model: r.model, ...(await usageToday(user.id)) };
});
