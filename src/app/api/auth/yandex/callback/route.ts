import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { signInWithYandex } from "@/server/auth";
import { appOrigin, validateYandexInfo, type YandexInfo } from "@/server/oauth";
export const dynamic = "force-dynamic";

// YANDEX_TOKEN_URL va YANDEX_INFO_URL faqat testlar uchun
const TOKEN_URL = process.env.YANDEX_TOKEN_URL ?? "https://oauth.yandex.com/token";
const INFO_URL = process.env.YANDEX_INFO_URL ?? "https://login.yandex.ru/info?format=json";
const COOKIE = "u360_oauth_y";

export const GET = async (req: Request) => {
  const origin = appOrigin(req);
  const fail = (why: string) => { console.warn("[yandex-auth]", why); const r = NextResponse.redirect(`${origin}/kirish?xato=yandex`); r.cookies.delete({ name: COOKIE, path: "/api/auth/yandex" }); return r; };
  try {
    const q = new URL(req.url).searchParams;
    if (q.get("error")) return fail(`yandex xato: ${q.get("error")}`);
    const cookie = req.headers.get("cookie")?.split(/;\s*/).find((c) => c.startsWith(`${COOKIE}=`))?.slice(COOKIE.length + 1);
    const [state, verifier] = (cookie ?? "").split(".");
    const given = q.get("state") ?? "", code = q.get("code");
    if (!state || !verifier || !code || given.length !== state.length || !timingSafeEqual(Buffer.from(given), Buffer.from(state))) return fail("state mos emas yoki cookie yo'q");

    const clientId = process.env.YANDEX_CLIENT_ID, clientSecret = process.env.YANDEX_CLIENT_SECRET;
    if (!clientId || !clientSecret) return fail("sozlanmagan");
    const tr = await fetch(TOKEN_URL, {
      method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ grant_type: "authorization_code", code, client_id: clientId, client_secret: clientSecret, code_verifier: verifier }),
    });
    if (!tr.ok) return fail(`token endpoint ${tr.status}`);
    const { access_token } = (await tr.json()) as { access_token?: string };
    if (!access_token) return fail("access_token yo'q");
    const ir = await fetch(INFO_URL, { headers: { authorization: `OAuth ${access_token}` } });
    if (!ir.ok) return fail(`info endpoint ${ir.status}`);
    const v = validateYandexInfo((await ir.json()) as YandexInfo);
    if (!v.ok) return fail(v.reason);

    await signInWithYandex(v);
    const res = NextResponse.redirect(`${origin}/dashboard`);
    res.cookies.delete({ name: COOKIE, path: "/api/auth/yandex" });
    return res;
  } catch (e) { return fail(`kutilmagan xato: ${(e as Error).message}`); }
};
