import { requireUser } from "@/server/auth";
import { handle } from "@/server/http";
import { generateTasks, tasksInput } from "@/server/ai/generate";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** AI topshiriq QORALAMASINI yaratadi: hammasi tasdiqlanmagan holda qaytadi, o'qituvchi tekshirib tasdiqlaydi. */
export const POST = (req: Request) => handle(async () => {
  const user = await requireUser();
  const b = tasksInput.parse(await req.json());
  const r = await generateTasks(user.id, b);
  if (!r.items.length) return { items: [], problems: 0, note: r.note };
  return { items: r.items, problems: r.problems, model: r.model, note: r.note };
});
