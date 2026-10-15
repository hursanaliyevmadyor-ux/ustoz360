import { handle } from "@/server/http";
import { appOrigin } from "@/server/oauth";
import { createTelegramLogin } from "@/server/telegram";
export const dynamic = "force-dynamic";

export const POST = (req: Request) => handle(async () => createTelegramLogin(appOrigin(req)));
