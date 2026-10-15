import { NextResponse } from "next/server";
import { appOrigin, pkceChallenge, randomToken } from "@/server/oauth";
export const dynamic = "force-dynamic";

export const GET = (req: Request) => {
  const origin = appOrigin(req);
  const clientId = process.env.YANDEX_CLIENT_ID;
  if (!clientId || !process.env.YANDEX_CLIENT_SECRET) return NextResponse.redirect(`${origin}/kirish?xato=yandex_yoq`);

  const state = randomToken(), verifier = randomToken(48);
  const url = new URL("https://oauth.yandex.com/authorize");
  url.search = new URLSearchParams({
    response_type: "code", client_id: clientId, redirect_uri: `${origin}/api/auth/yandex/callback`, scope: "login:email login:info",
    state, code_challenge: pkceChallenge(verifier), code_challenge_method: "S256", force_confirm: "yes",
  }).toString();

  const res = NextResponse.redirect(url);
  res.cookies.set("u360_oauth_y", `${state}.${verifier}`, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/api/auth/yandex", maxAge: 600 });
  return res;
};
