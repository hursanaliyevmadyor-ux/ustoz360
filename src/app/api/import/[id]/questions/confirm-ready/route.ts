import { requireUser } from "@/server/auth";
import { handle } from "@/server/http";
import { confirmAllReady } from "@/server/import/service";
export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

/** Faqat «Tayyor» (mustaqil tasdiqlangan) savollarni qabul qiladi; qolganlari alohida ko'rib chiqiladi. */
export const POST = (_r: Request, { params }: Ctx) => handle(async () => confirmAllReady(await requireUser(), (await params).id));
