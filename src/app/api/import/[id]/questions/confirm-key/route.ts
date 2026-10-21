import { requireUser } from "@/server/auth";
import { handle } from "@/server/http";
import { confirmByKey } from "@/server/import/service";
export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

/** Javoblar kaliti raqam bo'yicha moslashgan savollarga kalitdagi javobni «To'g'ri» deb belgilaydi (ziddiyatli va noaniq savollar o'tkazib yuboriladi). */
export const POST = (_r: Request, { params }: Ctx) => handle(async () => confirmByKey(await requireUser(), (await params).id));
