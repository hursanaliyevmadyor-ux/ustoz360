import { z } from "zod";
import { requireUser } from "@/server/auth";
import { handle } from "@/server/http";
import { saveSelection } from "@/server/practice";
export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

/** Yakunda tekshiriladigan testlarda tanlangan variantni saqlaydi (optionId: null, tanlovni bekor qiladi). Javob kaliti qaytmaydi. */
export const POST = (req: Request, { params }: Ctx) => handle(async () => {
  const user = await requireUser();
  const b = z.object({ questionId: z.string().min(1), optionId: z.string().min(1).nullable() }).parse(await req.json());
  return saveSelection(user.id, (await params).id, b.questionId, b.optionId);
});
