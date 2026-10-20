import { requireAdmin } from "@/server/auth";
import { handle } from "@/server/http";
import { moderate, moderateBody } from "@/server/ranking/admin";
export const dynamic = "force-dynamic";

/** Nik va avatar moderatsiyasi: reytingdan yashirish/qaytarish, nikni tiklash, rasmni olib tashlash. */
export const POST = (req: Request) => handle(async () => { const a = await requireAdmin(); return moderate(a, moderateBody.parse(await req.json())); });
