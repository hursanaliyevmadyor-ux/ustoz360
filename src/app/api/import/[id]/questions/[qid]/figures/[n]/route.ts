import { ApiError, requireUser } from "@/server/auth";
import { handle } from "@/server/http";
import { MAX_FIGURE_BYTES, uploadFigure } from "@/server/import/figures";
export const dynamic = "force-dynamic";
export const maxDuration = 30;
type Ctx = { params: Promise<{ id: string; qid: string; n: string }> };

/** Savoldagi rasm joyi uchun brauzer kesgan PNG (raw body, 3 MB gacha). */
export const PUT = (req: Request, { params }: Ctx) => handle(async () => {
  const u = await requireUser();
  const p = await params;
  const declared = Number(req.headers.get("content-length") ?? 0);
  if (declared > MAX_FIGURE_BYTES + 1024) throw new ApiError(413, "Rasm juda katta (3 MB gacha).");
  return uploadFigure(u.id, p.id, p.qid, Number(p.n), new Uint8Array(await req.arrayBuffer()));
});
