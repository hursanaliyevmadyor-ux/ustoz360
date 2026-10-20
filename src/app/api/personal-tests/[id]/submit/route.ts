import { requireUser } from "@/server/auth";
import { handle } from "@/server/http";
import { submitCollection, submitSchema, withdrawSubmission } from "@/server/import/collections";
export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

/** «Barcha ustozlar uchun ulashish»: test admin ko'rib chiqishiga yuboriladi (bevosita ommaviy bo'lmaydi). */
export const POST = (req: Request, { params }: Ctx) => handle(async () => submitCollection(await requireUser(), (await params).id, submitSchema.parse(await req.json())));
/** Yuborishni qaytarib olish. */
export const DELETE = (_r: Request, { params }: Ctx) => handle(async () => withdrawSubmission(await requireUser(), (await params).id));
