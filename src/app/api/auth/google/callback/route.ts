import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { signInWithGoogle } from "@/server/auth";
import { landingPath } from "@/server/onboarding";
import { appOrigin, decodeJwtPayload, validateGoogleClaims } from "@/server/oauth";
export const dynamic = "force-dynamic";

const TOKEN_URL = process.env.GOOGLE_TOKEN_URL ?? "https://oauth2.googleapis.com/token"; // GOOGLE_TOKEN_URL faqat testlar uchun

export const GET = async (req: Request) => {
  const origin = appOrigin(req);
  const fail = (why: string) => { console.warn("[google-auth]", why); const r = NextResponse.redirect(`${origin}/kirish?xato=google`); r.cookies.delete({ name: "u360_oauth", path: "/api/auth/google" }); return r; };
  try {
    const q = new URL(req.url).searchParams;
    if (q.get("error")) return fail(`google xato: ${q.get("error")}`);
    const cookie = req.headers.get("cookie")?.split(/;\s*/).find((c) => c.startsWith("u360_oauth="))?.slice("u360_oauth=".length);
    const [state, verifier, nonce] = (cookie ?? "").split(".");
    const given = q.get("state") ?? "", code = q.get("code");
    if (!state || !verifier || !nonce || !code || given.length !== state.length || !timingSafeEqual(Buffer.from(given), Buffer.from(state))) return fail("state mos emas yoki cookie yo'q");

    const clientId = process.env.GOOGLE_CLIENT_ID!, clientSecret = process.env.GOOGLE_CLIENT_SECRET!;
    if (!clientId || !clientSecret) return fail("sozlanmagan");
    const tr = await fetch(TOKEN_URL, {
      method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ code, client_id: clientId, client_secret: clientSecret, redirect_uri: `${origin}/api/auth/google/callback`, grant_type: "authorization_code", code_verifier: verifier }),
    });
    if (!tr.ok) return fail(`token endpoint ${tr.status}`);
    const { id_token } = (await tr.json()) as { id_token?: string };
    const v = validateGoogleClaims(id_token ? decodeJwtPayload(id_token) : null, clientId, nonce);
    if (!v.ok) return fail(v.reason);

    const user = await signInWithGoogle(v);
    const res = NextResponse.redirect(`${origin}${await landingPath(user.id)}`);
    res.cookies.delete({ name: "u360_oauth", path: "/api/auth/google" });
    return res;
  } catch (e) { return fail(`kutilmagan xato: ${(e as Error).message}`); }
};
