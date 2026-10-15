import { z } from "zod";
import { resetPassword } from "@/server/emailauth";
import { handle } from "@/server/http";
export const dynamic = "force-dynamic";

const body = z.object({
  email: z.string().trim().max(254).email(),
  code: z.string().trim().regex(/^\d{6}$/, "Kod 6 ta raqamdan iborat"),
  password: z.string().min(8, "Parol kamida 8 belgi bo'lsin").max(128),
});

export const POST = (req: Request) => handle(async () => {
  const b = body.parse(await req.json());
  return resetPassword(b.email, b.code, b.password);
});
