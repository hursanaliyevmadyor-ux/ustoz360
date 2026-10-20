import { requireUser } from "@/server/auth";
import { handle } from "@/server/http";
import { completeUpload } from "@/server/import/service";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
type Ctx = { params: Promise<{ id: string; fid: string }> };

/** Bo'laklar yig'iladi va fayl serverda tekshiriladi (haqiqiy tur, hajm, dublikat); noto'g'ri bo'lsa hammasi o'chiriladi. */
export const POST = (_r: Request, { params }: Ctx) => handle(async () => { const p = await params; return completeUpload(await requireUser(), p.id, p.fid); });
