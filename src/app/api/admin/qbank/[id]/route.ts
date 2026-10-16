import { z } from "zod";
import { requireAdmin } from "@/server/auth";
import { QUESTION_STATUSES, bankQuestionInput } from "@/server/adminvalid";
import { handle } from "@/server/http";
import { deleteBankQuestion, getBankQuestion, setBankStatus, updateBankQuestion } from "@/server/qbank";
export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

export const GET = (_r: Request, { params }: Ctx) => handle(async () => { await requireAdmin(); return getBankQuestion((await params).id); });
export const PUT = (req: Request, { params }: Ctx) => handle(async () => { await requireAdmin(); return updateBankQuestion((await params).id, bankQuestionInput.parse(await req.json())); });
/** Faqat holatni o'zgartirish (Draft → Review → Approved ...). */
export const PATCH = (req: Request, { params }: Ctx) => handle(async () => {
  await requireAdmin();
  return setBankStatus((await params).id, z.object({ status: z.enum(QUESTION_STATUSES) }).parse(await req.json()).status);
});
export const DELETE = (_r: Request, { params }: Ctx) => handle(async () => { await requireAdmin(); return deleteBankQuestion((await params).id); });
