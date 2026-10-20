import { z } from "zod";
import { requireUser } from "@/server/auth";
import { handle } from "@/server/http";
import { checkNickAvailable, setNickname } from "@/server/ranking/profile";
export const dynamic = "force-dynamic";

/** GET ?value=nik — nik bo'shmi (band bo'lsa «Bu nik band.»). */
export const GET = (req: Request) => handle(async () => { const u = await requireUser(); return checkNickAvailable(u.id, new URL(req.url).searchParams.get("value") ?? ""); });
/** PUT { nickname } — nikni o'rnatish yoki o'zgartirish. Imtihon natijalari o'zgarmaydi (ular foydalanuvchi id'siga bog'langan). */
export const PUT = (req: Request) => handle(async () => { const u = await requireUser(); return setNickname(u.id, z.object({ nickname: z.string().max(60) }).parse(await req.json()).nickname); });
