import { ApiError, requireUser } from "@/server/auth";
import { handle } from "@/server/http";
import { addFile, roleSchema } from "@/server/import/service";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
type Ctx = { params: Promise<{ id: string }> };

/** Hosting so'rov hajmi chegarasi (≈4,5 MB) tufayli bu yo'l faqat kichik fayllar uchun; kattalari `prepare` + `chunk` + `complete` orqali yuklanadi. */
const MAX_VIA_SERVER = 4 * 1024 * 1024;

/** multipart/form-data: file, role?. Fayl serverda tekshiriladi (tur, tarkib, hajm) va shaxsiy bucket'ga yoziladi. */
export const POST = (req: Request, { params }: Ctx) => handle(async () => {
  const u = await requireUser();
  const declared = Number(req.headers.get("content-length") ?? 0);
  if (declared > MAX_VIA_SERVER + 200_000) throw new ApiError(413, "Fayl serverga to'g'ridan-to'g'ri yuborish uchun katta: katta fayl avtomatik usulda yuklanadi.", "use_direct");
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!form || !(file instanceof File)) throw new ApiError(400, "Fayl tanlanmagan.");
  const role = roleSchema.parse(form.get("role") ?? undefined);
  return addFile(u, (await params).id, { name: file.name, bytes: new Uint8Array(await file.arrayBuffer()) }, role);
});
