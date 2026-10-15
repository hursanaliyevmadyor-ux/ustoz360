import { z } from "zod";
import { emailSignupOpen, register } from "@/server/auth";
import { startRegistration } from "@/server/emailauth";
import { handle } from "@/server/http";
export const dynamic = "force-dynamic";

const body = z.object({
  email: z.string().trim().max(254).email(),
  password: z.string().min(8, "Parol kamida 8 belgi bo'lsin").max(128),
  name: z.string().trim().max(80).optional(),
});

export const POST = (req: Request) => handle(async () => {
  const b = body.parse(await req.json());
  // ALLOW_EMAIL_SIGNUP=1 (faqat testlar): kodsiz, darhol ro'yxatdan o'tish. Aks holda email kodi bilan tasdiqlanadi.
  if (emailSignupOpen()) {
    const u = await register(b.email, b.password, b.name);
    return { ok: true, user: { id: u.id, name: u.name, email: u.email } };
  }
  const r = await startRegistration(b.email, b.password);
  return { ok: true, verify: true, email: r.email };
});
