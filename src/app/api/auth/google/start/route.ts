import { NextResponse } from "next/server";
import { appOrigin, pkceChallenge, randomToken } from "@/server/oauth";
export const dynamic = "force-dynamic";

export const GET = (req: Request) => {
  const origin = appOrigin(req);
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId || !process.env.GOOGLE_CLIENT_SECRET) return NextResponse.redirect(`${origin}/kirish?xato=google_yoq`);

  const state = randomToken(), verifier = randomToken(48), nonce = randomToken();
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.search = new URLSearchParams({
    client_id: clientId, redirect_uri: `${origin}/api/auth/google/callback`, response_type: "code", scope: "openid email profile",
    state, nonce, code_challenge: pkceChallenge(verifier), code_challenge_method: "S256", prompt: "select_account",
  }).toString();

  const res = NextResponse.redirect(url);
  // state/verifier/nonce faqat brauzerda (httpOnly) turadi, 10 daqiqa amal qiladi
  res.cookies.set("u360_oauth", `${state}.${verifier}.${nonce}`, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/api/auth/google", maxAge: 600 });
  return res;
};
