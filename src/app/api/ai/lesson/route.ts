import { z } from "zod";
import { requireUser } from "@/server/auth";
import { handle } from "@/server/http";
import { LESSON_SECTIONS, lessonSchema, runAi, usageToday } from "@/server/ai/gateway";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const body = z.object({
  subject: z.string().trim().min(1).max(80), grade: z.coerce.number().int().min(1).max(11),
  topic: z.string().trim().min(2).max(200), duration: z.coerce.number().int().min(10).max(120).default(45),
  goal: z.string().trim().max(500).optional().default(""),
});

export const POST = (req: Request) => handle(async () => {
  const user = await requireUser();
  const b = body.parse(await req.json());
  const prompt = `Quyidagi dars uchun ishlanma tuz.\nFan: ${b.subject}\nSinf: ${b.grade}\nMavzu: ${b.topic}\nDavomiyligi: ${b.duration} daqiqa\nMaqsad: ${b.goal || "(ko'rsatilmagan, o'zing mos maqsad yoz)"}\n\nQuyidagi bo'limlarning har biri uchun amaliy, vaqt taqsimotini hisobga olgan matn yoz, aynan shu tartib va nomlarda: ${LESSON_SECTIONS.join("; ")}.`;
  const r = await runAi({ userId: user.id, feature: "lesson", messages: [{ role: "user", content: prompt }], maxTokens: 4000, effort: "medium", schema: lessonSchema });
  let parsed: { sections: { title: string; content: string }[] };
  try { parsed = JSON.parse(r.text); } catch { throw new (await import("@/server/auth")).ApiError(502, "AI javobini o'qib bo'lmadi. Qayta urinib ko'ring."); }
  const map = Object.fromEntries(parsed.sections.map((s) => [s.title, s.content]));
  return { sections: Object.fromEntries(LESSON_SECTIONS.map((t) => [t, map[t] ?? ""])), ...(await usageToday(user.id)) };
});
