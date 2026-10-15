/**
 * E2E: Google va Telegram orqali kirish. Server shu muhit o'zgaruvchilari bilan ishga tushirilgan bo'lishi kerak:
 *  GOOGLE_CLIENT_ID=test-client GOOGLE_CLIENT_SECRET=test-secret GOOGLE_TOKEN_URL=http://localhost:4455/token
 *  TELEGRAM_BOT_TOKEN=123456:TEST-bot-token TELEGRAM_BOT_USERNAME=testbot APP_URL=http://localhost:3112
 * Google o'rniga mahalliy soxta token serveri ishlatiladi (u PKCE'ni ham tekshiradi).
 */
import assert from "node:assert/strict";
import { createHash, createHmac } from "node:crypto";
import http from "node:http";
import { PrismaClient } from "@prisma/client";

const BASE = process.env.BASE_URL ?? "http://localhost:3112";
const BOT = "123456:TEST-bot-token";
const db = new PrismaClient();
let pass = 0;
const t = async (name: string, fn: () => Promise<void>) => { await fn(); pass++; console.log("OK  ", name); };

// ---- soxta Google token serveri ----
const mock = http.createServer((req, res) => {
  let body = ""; req.on("data", (c) => (body += c));
  req.on("end", () => {
    const f = new URLSearchParams(body); const send = (st: number, o: unknown) => { res.writeHead(st, { "content-type": "application/json" }); res.end(JSON.stringify(o)); };
    try {
      const c = JSON.parse(Buffer.from(f.get("code") ?? "", "base64url").toString());
      if (f.get("client_id") !== "test-client" || f.get("client_secret") !== "test-secret" || f.get("grant_type") !== "authorization_code") return send(400, { error: "invalid_client" });
      if (f.get("redirect_uri") !== `${BASE}/api/auth/google/callback`) return send(400, { error: "redirect_uri_mismatch" });
      const verifier = f.get("code_verifier") ?? "";
      if (createHash("sha256").update(verifier).digest("base64url") !== c.challenge) return send(400, { error: "invalid_grant (PKCE)" });
      const payload = { iss: "https://accounts.google.com", aud: "test-client", exp: Math.floor(Date.now() / 1000) + 600, sub: c.sub, email: c.email, email_verified: c.verified ?? true, name: c.name ?? "Test", nonce: c.nonce, ...(c.override ?? {}) };
      const enc = (o: unknown) => Buffer.from(JSON.stringify(o)).toString("base64url");
      send(200, { id_token: `${enc({ alg: "RS256" })}.${enc(payload)}.sig` });
    } catch { send(400, { error: "bad_code" }); }
  });
}).listen(4455);

class Jar {
  c: Record<string, string> = {};
  get header() { return Object.entries(this.c).map(([k, v]) => `${k}=${v}`).join("; "); }
  async get(path: string, opts: { follow?: boolean } = {}) {
    const res = await fetch(BASE + path, { redirect: "manual", headers: { cookie: this.header } });
    for (const sc of res.headers.getSetCookie()) { const [kv] = sc.split(";"); const i = kv.indexOf("="); const k = kv.slice(0, i), v = kv.slice(i + 1); if (/Max-Age=0|Expires=Thu, 01 Jan 1970/i.test(sc) || v === "") delete this.c[k]; else this.c[k] = v; }
    return { status: res.status, location: res.headers.get("location") ?? "", json: res.headers.get("content-type")?.includes("json") ? await res.json() : null };
  }
}
const me = async (j: Jar) => (await j.get("/api/me")).json.user as { id: string; email: string | null; name: string | null } | null;

/** start -> Google'ga yo'naltirish + cookie; so'ngra Google qaytargandek callback'ni chaqiradi. */
async function googleLogin(j: Jar, claims: { sub: string; email: string; verified?: boolean; name?: string; override?: Record<string, unknown> }, tweak: { nonce?: string; state?: string } = {}) {
  const s = await j.get("/api/auth/google/start"); const u = new URL(s.location);
  const code = Buffer.from(JSON.stringify({ ...claims, nonce: tweak.nonce ?? u.searchParams.get("nonce"), challenge: u.searchParams.get("code_challenge") })).toString("base64url");
  return j.get(`/api/auth/google/callback?code=${code}&state=${tweak.state ?? u.searchParams.get("state")}`);
}

const tgSign = (d: Record<string, string>) => ({ ...d, hash: createHmac("sha256", createHash("sha256").update(BOT).digest()).update(Object.keys(d).sort().map((k) => `${k}=${d[k]}`).join("\n")).digest("hex") });
const tgQuery = (d: Record<string, string>) => new URLSearchParams(d).toString();

async function main() {
  const stamp = Date.now();
  await db.user.deleteMany({ where: { OR: [{ email: { startsWith: "e2e-s-" } }, { telegramId: { startsWith: "9000" } }] } });

  await t("providers: Google va Telegram sozlangan, sirlar qaytarilmaydi", async () => {
    const r = await (await fetch(BASE + "/api/auth/providers")).json();
    assert.equal(r.google, true); assert.equal(r.telegram, "testbot"); assert.ok(!JSON.stringify(r).includes("secret") && !JSON.stringify(r).includes("TEST-bot-token"));
  });
  await t("google/start: PKCE (S256), state, nonce va httpOnly cookie bilan Google'ga yo'naltiradi", async () => {
    const j = new Jar(); const r = await j.get("/api/auth/google/start"); const u = new URL(r.location);
    assert.equal(r.status, 307); assert.equal(u.host, "accounts.google.com"); assert.equal(u.searchParams.get("code_challenge_method"), "S256");
    assert.equal(u.searchParams.get("client_id"), "test-client"); assert.equal(u.searchParams.get("redirect_uri"), `${BASE}/api/auth/google/callback`);
    assert.ok((u.searchParams.get("state") ?? "").length >= 32 && (u.searchParams.get("nonce") ?? "").length >= 32); assert.ok(j.c["u360_oauth"]);
    const raw = (await fetch(BASE + "/api/auth/google/start", { redirect: "manual" })).headers.get("set-cookie") ?? "";
    assert.match(raw, /HttpOnly/i); assert.match(raw, /SameSite=lax/i);
  });
  await t("callback: cookie yo'q yoki state mos emas bo'lsa rad etiladi (sessiya berilmaydi)", async () => {
    const a = new Jar(); const r1 = await a.get("/api/auth/google/callback?code=x&state=y");
    assert.match(r1.location, /\/kirish\?xato=google$/); assert.equal(await me(a), null);
    const b = new Jar(); const r2 = await googleLogin(b, { sub: `s-bad-${stamp}`, email: `e2e-s-bad-${stamp}@gmail.com` }, { state: "boshqa-state-qiymati" });
    assert.match(r2.location, /xato=google/); assert.equal(await me(b), null);
  });
  await t("Google orqali yangi akkaunt: email tasdiqlangan, sessiya beriladi, /dashboard ga yo'naltiradi", async () => {
    const j = new Jar(); const email = `e2e-s-new-${stamp}@gmail.com`;
    const r = await googleLogin(j, { sub: `s-new-${stamp}`, email, name: "Dil Google" });
    assert.equal(r.status, 307); assert.match(r.location, /\/dashboard$/);
    const u = await me(j); assert.equal(u?.email, email); assert.equal(u?.name, "Dil Google");
    const row = await db.user.findUniqueOrThrow({ where: { email } }); assert.ok(row.emailVerifiedAt); assert.equal(row.googleSub, `s-new-${stamp}`); assert.equal(row.passwordHash, null);
    // oauth cookie tozalangan
    assert.equal(j.c["u360_oauth"], undefined);
  });
  await t("qayta kirganda o'sha akkaunt (dublikat yaratilmaydi)", async () => {
    const email = `e2e-s-new-${stamp}@gmail.com`; const before = await db.user.count({ where: { email } });
    const j = new Jar(); await googleLogin(j, { sub: `s-new-${stamp}`, email });
    assert.equal(await db.user.count({ where: { email } }), before); assert.equal((await me(j))?.email, email);
  });
  for (const [nom, claims] of [
    ["email tasdiqlanmagan", { verified: false }], ["aud boshqa ilova", { override: { aud: "boshqa-ilova" } }], ["muddati o'tgan", { override: { exp: 1 } }], ["iss soxta", { override: { iss: "https://evil.example" } }], ["nonce mos emas", { override: { nonce: "soxta" } }],
  ] as const) {
    await t(`soxta/noto'g'ri id_token rad etiladi: ${nom}`, async () => {
      const j = new Jar(); const r = await googleLogin(j, { sub: `s-x-${stamp}`, email: `e2e-s-x-${stamp}@gmail.com`, ...claims });
      assert.match(r.location, /xato=google/); assert.equal(await me(j), null);
      assert.equal(await db.user.count({ where: { email: `e2e-s-x-${stamp}@gmail.com` } }), 0);
    });
  }
  await t("PKCE: noto'g'ri code_verifier bilan Google rad etadi (token almashinuvi o'tmaydi)", async () => {
    const j = new Jar(); const s = await j.get("/api/auth/google/start"); const u = new URL(s.location);
    const code = Buffer.from(JSON.stringify({ sub: "p", email: `e2e-s-pkce-${stamp}@gmail.com`, nonce: u.searchParams.get("nonce"), challenge: "boshqa-challenge" })).toString("base64url");
    const r = await j.get(`/api/auth/google/callback?code=${code}&state=${u.searchParams.get("state")}`);
    assert.match(r.location, /xato=google/); assert.equal(await me(j), null);
  });
  await t("OLDINDAN EGALLASH HIMOYASI: birovning emaili bilan ochilgan parolli akkaunt Google'da haqiqiy ega kirganda bekor qilinadi", async () => {
    const victim = `e2e-s-victim-${stamp}@gmail.com`;
    const attacker = new Jar();
    const reg = await fetch(BASE + "/api/auth/register", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: victim, password: "Hujumchi-parol-1" }) });
    assert.equal(reg.status, 200); attacker.c["u360_session"] = reg.headers.getSetCookie().find((c) => c.startsWith("u360_session="))!.split(";")[0].split("=")[1];
    assert.equal((await me(attacker))?.email, victim);
    const owner = new Jar(); const r = await googleLogin(owner, { sub: `s-victim-${stamp}`, email: victim });
    assert.match(r.location, /\/dashboard$/);
    assert.equal(await me(attacker), null, "hujumchining eski sessiyasi o'chirilishi kerak");
    const pw = await fetch(BASE + "/api/auth/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: victim, password: "Hujumchi-parol-1" }) });
    assert.equal(pw.status, 401, "hujumchining paroli endi ishlamasligi kerak");
    const row = await db.user.findUniqueOrThrow({ where: { email: victim } }); assert.equal(row.passwordHash, null); assert.ok(row.emailVerifiedAt);
    assert.equal((await me(owner))?.id, row.id);
    assert.ok(await db.auditLog.findFirst({ where: { userId: row.id, action: "auth.google_link_reset_password" } }));
  });

  // ---- Telegram ----
  const tgBase = (id: string, over: Record<string, string> = {}) => ({ id, first_name: "Madiyor", last_name: "T", username: "madiyor_t", auth_date: String(Math.floor(Date.now() / 1000)), ...over });
  await t("Telegram: to'g'ri imzo bilan yangi akkaunt yaratiladi va sessiya beriladi", async () => {
    const j = new Jar(); const r = await j.get(`/api/auth/telegram/callback?${tgQuery(tgSign(tgBase(`9000${stamp}`)))}`);
    assert.equal(r.status, 307); assert.match(r.location, /\/dashboard$/);
    const u = await me(j); assert.equal(u?.name, "Madiyor T");
    const row = await db.user.findUniqueOrThrow({ where: { telegramId: `9000${stamp}` } }); assert.equal(row.telegramUsername, "madiyor_t"); assert.equal(row.email, null);
  });
  await t("Telegram: qayta kirganda o'sha akkaunt", async () => {
    const before = await db.user.count({ where: { telegramId: `9000${stamp}` } }); const j = new Jar();
    await j.get(`/api/auth/telegram/callback?${tgQuery(tgSign(tgBase(`9000${stamp}`)))}`);
    assert.equal(await db.user.count({ where: { telegramId: `9000${stamp}` } }), before); assert.ok(await me(j));
  });
  for (const [nom, mk] of [
    ["soxta imzo (hash o'zgartirilgan)", () => ({ ...tgSign(tgBase(`9001${stamp}`)), hash: "0".repeat(64) })],
    ["ma'lumot o'zgartirilgan (imzolangandan keyin id almashtirilgan)", () => ({ ...tgSign(tgBase(`9002${stamp}`)), id: `9003${stamp}` })],
    ["eskirgan auth_date (1 soat oldin)", () => tgSign(tgBase(`9004${stamp}`, { auth_date: String(Math.floor(Date.now() / 1000) - 3600) }))],
    ["boshqa bot tokeni bilan imzolangan", () => { const d = tgBase(`9005${stamp}`); return { ...d, hash: createHmac("sha256", createHash("sha256").update("999:BOSHQA").digest()).update(Object.keys(d).sort().map((k) => `${k}=${(d as Record<string, string>)[k]}`).join("\n")).digest("hex") }; }],
    ["hash umuman yo'q", () => tgBase(`9006${stamp}`)],
  ] as const) {
    await t(`Telegram rad etiladi: ${nom}`, async () => {
      const j = new Jar(); const data = mk() as Record<string, string>;
      const r = await j.get(`/api/auth/telegram/callback?${tgQuery(data)}`);
      assert.match(r.location, /\/kirish\?xato=telegram$/); assert.equal(await me(j), null);
      assert.equal(await db.user.count({ where: { telegramId: { in: [`9001${stamp}`, `9002${stamp}`, `9003${stamp}`, `9004${stamp}`, `9005${stamp}`, `9006${stamp}`] } } }), 0);
    });
  }

  await db.user.deleteMany({ where: { OR: [{ email: { startsWith: "e2e-s-" } }, { telegramId: { startsWith: "9000" } }] } });
  console.log(`\n${pass} ta tekshiruv o'tdi`);
}
main().then(() => { mock.close(); return db.$disconnect(); }, (e) => { console.error("FAIL", e); mock.close(); process.exit(1); });
