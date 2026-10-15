import { z } from "zod";
import { login } from "@/server/auth";
import { handle } from "@/server/http";
export const dynamic = "force-dynamic";

export const POST = (req: Request) => handle(async () => {
  const b = z.object({ email: z.string().trim().max(254), password: z.string().max(128) }).parse(await req.json());
  const u = await login(b.email, b.password);
  return { ok: true, user: { id: u.id, name: u.name, email: u.email } };
});
