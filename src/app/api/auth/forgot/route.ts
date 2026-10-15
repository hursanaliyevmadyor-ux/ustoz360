import { z } from "zod";
import { forgotPassword } from "@/server/emailauth";
import { handle } from "@/server/http";
export const dynamic = "force-dynamic";

const body = z.object({ email: z.string().trim().max(254).email() });

export const POST = (req: Request) => handle(async () => forgotPassword(body.parse(await req.json()).email));
