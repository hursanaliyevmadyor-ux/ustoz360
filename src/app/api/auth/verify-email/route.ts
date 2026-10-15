import { z } from "zod";
import { verifyEmail } from "@/server/emailauth";
import { handle } from "@/server/http";
export const dynamic = "force-dynamic";

const body = z.object({ email: z.string().trim().max(254).email(), code: z.string().trim().regex(/^\d{6}$/, "Kod 6 ta raqamdan iborat") });

export const POST = (req: Request) => handle(async () => {
  const b = body.parse(await req.json());
  const u = await verifyEmail(b.email, b.code);
  return { ok: true, user: { id: u.id, name: u.name, email: u.email } };
});
