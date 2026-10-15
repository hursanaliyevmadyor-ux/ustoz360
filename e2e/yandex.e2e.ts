/**
 * E2E: Yandex orqali kirish. Server shu bilan ishga tushirilgan bo'lishi kerak:
 *  YANDEX_CLIENT_ID=ya-client YANDEX_CLIENT_SECRET=ya-secret YANDEX_TOKEN_URL=http://localhost:4456/token
 *  YANDEX_INFO_URL=http://localhost:4456/info APP_URL=http://localhost:3114
 * Yandex o'rniga mahalliy soxta server ishlatiladi (u PKCE'ni ham tekshiradi).
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import http from "node:http";
import { PrismaClient } from "@prisma/client";

const BASE = process.env.BASE_URL ?? "http://localhost:3114";
const db = new PrismaClient();
let pass = 0;
const t = async (name: string, fn: () => Promise<void>) => { await fn(); pass++; console.log("OK  ", name); };

const mock = http.createServer((req, res) => {
  let body = ""; req.on("data", (c) => (body += c));
  req.on("end", () => {
    const send = (st: number, o: unknown) => { res.writeHead(st, { "content-type": "application/json" }); res.end(JSON.stringify(o)); };
    if (req.url === "/token") {
      const f = new URLSearchParams(body);
      try {
        const c = JSON.parse(Buffer.from(f.get("code") ?? "", "base64url").toString());
        if (f.get("client_id") !== "ya-client" || f.get("client_secret") !== "ya-secret" || f.get("grant_type") !== "authorization_code") return send(400, { error: "invalid_client" });
        if (createHash("sha256").update(f.get("code_verifier") ?? "").digest("base64url") !== c.challenge) return send(400, { error: "invalid_grant (PKCE)" });
        return send(200, { access_token: `tok.${Buffer.from(JSON.stringify(c.info)).toString("base64url")}` });
      } catch { return send(400, { error: "bad_code" }); }
    }
    if (req.url === "/info") {
      const m = /^OAuth tok\.(.+)$/.exec(String(req.headers.authorization));
      if (!m) return send(401, { error: "unauthorized" });
      return send(200, JSON.parse(Buffer.from(m[1], "base64url").toString()));
    }
    send(404, {});
  });
}).listen(4456);

class Jar {
  c: Record<string, string> = {};
  async get(path: string) {
    const res = await fetch(BASE + path, { redirect: "manual", headers: { cookie: Object.entries(this.c).map(([k, v]) => `${k}=${v}`).join("; ") } });
    for (const sc of res.headers.getSetCookie()) { const [kv] = sc.split(";"); const i = kv.indexOf("="); const k = kv.slice(0, i), v = kv.slice(i + 1); if (/Max-Age=0|Expires=Thu, 01 Jan 1970/i.test(sc) || v === "") delete this.c[k]; else this.c[k] = v; }
    return { status: res.status, location: res.headers.get("location") ?? "", json: res.headers.get("content-type")?.includes("json") ? await res.json() : null };
  }
}
const me = async (j: Jar) => (await j.get("/api/me")).json.user as { id: string; email: string | null } | null;

async function yandexLogin(j: Jar, info: Record<string, unknown>, tweakState?: string) {
  const s = await j.get("/api/auth/yandex/start"); const u = new URL(s.location);
  assert.equal(u.origin + u.pathname, "https://oauth.yandex.com/authorize");
  const code = Buffer.from(JSON.stringify({ info, challenge: u.searchParams.get("code_challenge") })).toString("base64url");
  return j.get(`/api/auth/yandex/callback?code=${code}&state=${tweakState ?? u.searchParams.get("state")}`);
}

async function main() {
  const stamp = Date.now(); const email = `ya-${stamp}@yandex.ru`;
  await t("providers: yandex sozlangan", async () => { assert.equal((await new Jar().get("/api/auth/providers")).json.yandex, true); });
  await t("yangi foydalanuvchi: akkaunt ochiladi va sessiya beriladi", async () => {
    const j = new Jar(); const r = await yandexLogin(j, { id: String(stamp), default_email: email, real_name: "Ya Test" });
    assert.ok(r.location.endsWith("/dashboard")); const u = await me(j); assert.equal(u?.email, email);
    const row = await db.user.findUnique({ where: { email } }); assert.equal(row?.yandexId, String(stamp)); assert.ok(row?.emailVerifiedAt);
  });
  await t("qayta kirish: o'sha akkaunt, dublikat yo'q", async () => {
    const j = new Jar(); await yandexLogin(j, { id: String(stamp), default_email: email });
    assert.equal(await db.user.count({ where: { yandexId: String(stamp) } }), 1); assert.equal((await me(j))?.email, email);
  });
  await t("email bo'yicha mavjud parolli akkaunt bog'lanadi, tasdiqlanmagan parol o'chiriladi (pre-hijack)", async () => {
    const e2 = `pre-${stamp}@yandex.ru`;
    await db.user.create({ data: { email: e2, passwordHash: "x", roles: { create: { role: "TEACHER" } }, profile: { create: {} } } });
    const j = new Jar(); await yandexLogin(j, { id: String(stamp + 1), default_email: e2 });
    const row = await db.user.findUnique({ where: { email: e2 } }); assert.equal(row?.yandexId, String(stamp + 1)); assert.equal(row?.passwordHash, null);
  });
  await t("noto'g'ri state rad etiladi", async () => {
    const j = new Jar(); const r = await yandexLogin(j, { id: "5", default_email: "x@ya.ru" }, "boshqa");
    assert.ok(r.location.includes("/kirish?xato=yandex")); assert.equal(await me(j), null);
  });
  await t("email yo'q bo'lsa rad etiladi", async () => {
    const j = new Jar(); const r = await yandexLogin(j, { id: "6" });
    assert.ok(r.location.includes("/kirish?xato=yandex")); assert.equal(await me(j), null);
  });
  await t("cookie'siz callback rad etiladi", async () => {
    const r = await new Jar().get("/api/auth/yandex/callback?code=x&state=y"); assert.ok(r.location.includes("xato=yandex"));
  });
  console.log(`\n${pass} ta tekshiruv muvaffaqiyatli.`);
}
main().then(() => { mock.close(); return db.$disconnect(); }).catch((e) => { console.error(e); process.exit(1); });
