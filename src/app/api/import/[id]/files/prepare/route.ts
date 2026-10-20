import { requireUser } from "@/server/auth";
import { handle } from "@/server/http";
import { prepareSchema, prepareUpload } from "@/server/import/service";
export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

/** Katta fayl: yozuv yaratiladi va bo'lak hajmi beriladi; brauzer bo'laklarni `chunk` ga yuboradi, so'ng `complete` chaqiriladi. */
export const POST = (req: Request, { params }: Ctx) => handle(async () => prepareUpload(await requireUser(), (await params).id, prepareSchema.parse(await req.json())));
