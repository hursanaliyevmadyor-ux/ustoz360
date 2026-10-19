import { requireUser } from "@/server/auth";
import { handle } from "@/server/http";
import { submitFeedback } from "@/server/hub/knowledge";
import { feedbackInput } from "@/server/hub/knowledgevalid";
export const dynamic = "force-dynamic";

/** Tasdiqlangan bilim javobini baholash (foydali / noto'g'ri). Bir foydalanuvchi bir yozuvga bitta ovoz; ovoz foydalanuvchiga bog'lanmaydi (bir tomonlama xesh). */
export const POST = (req: Request) => handle(async () => {
  const u = await requireUser();
  return submitFeedback(u.id, feedbackInput.parse(await req.json()));
});
