import { z } from "zod";
import { handle } from "@/server/http";
import { pollTelegramLogin } from "@/server/telegram";
export const dynamic = "force-dynamic";

const body = z.object({ pollKey: z.string().min(10).max(200) });

export const POST = (req: Request) => handle(async () => pollTelegramLogin(body.parse(await req.json()).pollKey));
