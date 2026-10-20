import { z } from "zod";
import { requireUser } from "@/server/auth";
import { handle } from "@/server/http";
import { setParticipation } from "@/server/ranking/service";
export const dynamic = "force-dynamic";

/** Reytingda qatnashish roziligi. Yoqishda `consent: true` majburiy (nik, avatar va indeks boshqalarga ko'rinishini tasdiqlash). */
const body = z.object({ optIn: z.boolean(), consent: z.boolean().optional() });
export const POST = (req: Request) => handle(async () => {
  const u = await requireUser();
  const b = body.parse(await req.json());
  if (b.optIn && b.consent !== true) return Response.json({ error: "Nik, avatar va reyting indeksi boshqa foydalanuvchilarga ko'rinishiga rozilik bering.", code: "consent_required" }, { status: 400 });
  return setParticipation(u.id, b.optIn);
});
