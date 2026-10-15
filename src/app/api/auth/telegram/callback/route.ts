import { NextResponse } from "next/server";
import { signInWithTelegram } from "@/server/auth";
import { landingPath } from "@/server/onboarding";
import { appOrigin, verifyTelegramAuth } from "@/server/oauth";
export const dynamic = "force-dynamic";

/** Telegram Login Widget (redirect rejimi): ma'lumot GET parametrlarida keladi, imzo bot tokeni bilan tekshiriladi. */
export const GET = async (req: Request) => {
  const origin = appOrigin(req);
  const fail = (why: string) => { console.warn("[telegram-auth]", why); return NextResponse.redirect(`${origin}/kirish?xato=telegram`); };
  try {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token) return fail("sozlanmagan");
    const params = Object.fromEntries(new URL(req.url).searchParams.entries());
    const v = verifyTelegramAuth(params, token);
    if (!v.ok) return fail(v.reason);
    const user = await signInWithTelegram(v.data);
    return NextResponse.redirect(`${origin}${await landingPath(user.id)}`);
  } catch (e) { return fail(`kutilmagan xato: ${(e as Error).message}`); }
};
