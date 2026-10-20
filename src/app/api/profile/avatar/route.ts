import { z } from "zod";
import { ApiError, requireUser } from "@/server/auth";
import { handle } from "@/server/http";
import { AVATAR_MAX_BYTES } from "@/server/ranking/imagemeta";
import { choosePreset, removeAvatar, saveAvatar } from "@/server/ranking/profile";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

/** Profil rasmi (raw body: image/jpeg, image/png yoki image/webp; 2 MB gacha). Tur bayt belgilari bo'yicha serverda tekshiriladi, metadata olib tashlanadi. */
export const POST = (req: Request) => handle(async () => {
  const u = await requireUser();
  if (Number(req.headers.get("content-length") ?? 0) > AVATAR_MAX_BYTES + 1024) throw new ApiError(413, "Rasm hajmi 2 MB dan oshmasin.");
  return saveAvatar(u.id, new Uint8Array(await req.arrayBuffer()));
});
/** Tayyor rasmlardan birini tanlash: `{ preset: "p3" }`. */
export const PUT = (req: Request) => handle(async () => {
  const u = await requireUser();
  return choosePreset(u.id, z.object({ preset: z.string().max(10) }).parse(await req.json()).preset);
});
/** Standart (avtomatik) rasmga qaytish. */
export const DELETE = () => handle(async () => removeAvatar((await requireUser()).id));
