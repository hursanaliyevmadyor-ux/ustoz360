import { ApiError, requireUser } from "@/server/auth";
import { handle } from "@/server/http";
import { CHUNK_BYTES, uploadChunk } from "@/server/import/service";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
type Ctx = { params: Promise<{ id: string; fid: string }> };

/** Katta fayl bo'lagi (xom bayt, ?n=bo'lak raqami). Har bir bo'lak hosting so'rov hajmi chegarasidan kichik. */
export const PUT = (req: Request, { params }: Ctx) => handle(async () => {
  const u = await requireUser(), p = await params;
  if (Number(req.headers.get("content-length") ?? 0) > CHUNK_BYTES + 100_000) throw new ApiError(413, "Bo'lak juda katta.");
  const n = Number(new URL(req.url).searchParams.get("n"));
  return uploadChunk(u, p.id, p.fid, n, new Uint8Array(await req.arrayBuffer()));
});
