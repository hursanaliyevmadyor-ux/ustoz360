import { requireUser } from "@/server/auth";
import { handle } from "@/server/http";
import { filePreview } from "@/server/import/service";
export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string; fid: string }> };

/** Asl fayl ko'rinishi: PDF/rasm uchun qisqa muddatli imzolangan havola (?page=N), matnli fayllar uchun ajratilgan matn. */
export const GET = (req: Request, { params }: Ctx) => handle(async () => { const p = await params; return filePreview(await requireUser(), p.id, p.fid, new URL(req.url).searchParams.get("page") ?? undefined); });
