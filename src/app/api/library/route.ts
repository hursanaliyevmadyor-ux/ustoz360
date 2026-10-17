import { ApiError, requireUser } from "@/server/auth";
import { handle } from "@/server/http";
import { listLibrary, uploadDoc, uploadMeta } from "@/server/library";
import { MAX_FILE_BYTES } from "@/server/librarylogic";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export const GET = (req: Request) => handle(async () => {
  const u = await requireUser();
  const sp = new URL(req.url).searchParams;
  return listLibrary(u, { q: sp.get("q") ?? undefined, subject: sp.get("subject") ?? undefined, scope: sp.get("scope") ?? undefined, page: Math.max(1, Number(sp.get("page")) || 1) });
});

/** multipart/form-data: file, title, subject?, tags?. Fayl serverda tekshiriladi (tur, tarkib, hajm) va Supabase Storage'ga yoziladi. */
export const POST = (req: Request) => handle(async () => {
  const u = await requireUser();
  const declared = Number(req.headers.get("content-length") ?? 0);
  if (declared > MAX_FILE_BYTES + 200_000) throw new ApiError(413, "Fayl juda katta.");
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!form || !(file instanceof File)) throw new ApiError(400, "Fayl tanlanmagan.");
  const meta = uploadMeta.parse({ title: form.get("title") || file.name.replace(/\.[^.]+$/, ""), subject: form.get("subject") ?? undefined, tags: form.get("tags") ?? undefined });
  return uploadDoc(u, { name: file.name, bytes: new Uint8Array(await file.arrayBuffer()) }, meta);
});
