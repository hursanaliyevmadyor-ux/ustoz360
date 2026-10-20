import { requireUser } from "@/server/auth";
import { handle } from "@/server/http";
import { recheck } from "@/server/import/service";
export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

/** Barcha savollarni qayta tekshirishga yuboradi (masalan AI limiti tugab qolgan savollar uchun). */
export const POST = (_r: Request, { params }: Ctx) => handle(async () => recheck(await requireUser(), (await params).id));
