/**
 * E2E: AI bo'limi. Server shu bilan ishga tushirilgan bo'lishi kerak:
 *  ANTHROPIC_API_KEY=test-key ANTHROPIC_BASE_URL=http://localhost:4466 AI_DAILY_LIMIT=5 AI_MODEL=claude-opus-5-5 FREE_LLM_BASE_URL=http://localhost:4467 FREE_LLM_API_KEY=free-key AI_FREE_DAILY_LIMIT=5
 * Anthropic o'rniga mahalliy soxta server ishlatiladi (haqiqiy API'ga so'rov ketmaydi).
 */
import assert from "node:assert/strict";
import http from "node:http";
import { PrismaClient } from "@prisma/client";

const BASE = process.env.BASE_URL ?? "http://localhost:3113";
const db = new PrismaClient();
let pass = 0;
const t = async (name: string, fn: () => Promise<void>) => { await fn(); pass++; console.log("OK  ", name); };

const freeSeen: any[] = [];
const freeMock = http.createServer((req, res) => {
  let b = ""; req.on("data", (c) => (b += c));
  req.on("end", () => {
    freeSeen.push({ url: req.url, auth: req.headers.authorization, body: JSON.parse(b || "{}") });
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ model: "free-x", choices: [{ message: { content: "Bepul javob" } }], usage: { prompt_tokens: 3, completion_tokens: 4 } }));
  });
}).listen(4467);
const seen: { headers: http.IncomingHttpHeaders; body: any }[] = [];
let mode: "ok" | "refusal" | "error" = "ok";
const mock = http.createServer((req, res) => {
  let b = ""; req.on("data", (c) => (b += c));
  req.on("end", () => {
    const body = JSON.parse(b || "{}"); seen.push({ headers: req.headers, body });
    const send = (st: number, o: unknown) => { res.writeHead(st, { "content-type": "application/json" }); res.end(JSON.stringify(o)); };
    if (mode === "error") return send(500, { type: "error", error: { type: "api_error", message: "boom" } });
    const base = { id: "msg_1", type: "message", role: "assistant", model: body.model, usage: { input_tokens: 11, output_tokens: 7 } };
    if (mode === "refusal") return send(200, { ...base, content: [], stop_reason: "refusal", stop_details: { type: "refusal", category: null } });
    const text = body.output_config?.format ? JSON.stringify({ sections: [{ title: "Maqsad va kutiladigan natijalar", content: "Test maqsad" }, { title: "Yangi mavzu", content: "Test mavzu" }] }) : "Test javob";
    send(200, { ...base, content: [{ type: "text", text }], stop_reason: "end_turn" });
  });
}).listen(4466);

class Jar {
  c: Record<string, string> = {};
  async req(method: string, path: string, body?: unknown) {
    const res = await fetch(BASE + path, { method, headers: { "content-type": "application/json", cookie: Object.entries(this.c).map(([k, v]) => `${k}=${v}`).join("; ") }, body: body ? JSON.stringify(body) : undefined });
    for (const sc of res.headers.getSetCookie()) { const [kv] = sc.split(";"); const i = kv.indexOf("="); this.c[kv.slice(0, i)] = kv.slice(i + 1); }
    return { status: res.status, json: (await res.json().catch(() => null)) as any };
  }
}

async function main() {
  const email = `ai-${Date.now()}@example.com`;
  const anon = new Jar(); const u = new Jar();
  await t("kirmagan foydalanuvchi AI ishlata olmaydi", async () => {
    assert.equal((await anon.req("POST", "/api/ai/chat", { messages: [{ role: "user", content: "salom" }] })).status, 401);
    assert.equal((await anon.req("GET", "/api/ai/status")).status, 401);
  });
  assert.equal((await u.req("POST", "/api/auth/register", { email, password: "Parol12345", name: "AI Test" })).status, 200);
  await t("status: sozlangan, limit 5", async () => {
    const r = await u.req("GET", "/api/ai/status"); assert.equal(r.json.configured, true); assert.equal(r.json.limit, 5); assert.equal(r.json.remaining, 5);
  });
  await t("chat: javob qaytadi, kalit/tizim so'rovi to'g'ri ketadi", async () => {
    const r = await u.req("POST", "/api/ai/chat", { messages: [{ role: "user", content: "Formativ baholash nima?" }] });
    assert.equal(r.status, 200); assert.equal(r.json.reply, "Test javob"); assert.equal(r.json.remaining, 4);
    const s = seen.at(-1)!; assert.equal(s.headers["x-api-key"], "test-key"); assert.equal(s.body.model, "claude-opus-5-5");
    assert.equal(s.body.fallbacks, "default"); assert.ok(String(s.headers["anthropic-beta"]).includes("server-side-fallback-2026-07-01"));
    assert.ok(!("temperature" in s.body));
  });
  await t("chat: validatsiya (bo'sh, noto'g'ri oxirgi rol)", async () => {
    assert.equal((await u.req("POST", "/api/ai/chat", { messages: [] })).status, 400);
    assert.equal((await u.req("POST", "/api/ai/chat", { messages: [{ role: "assistant", content: "x" }] })).status, 400);
  });
  await t("dars ishlanmasi: tuzilmali javob barcha 10 bo'lim bilan", async () => {
    const r = await u.req("POST", "/api/ai/lesson", { subject: "Matematika", grade: 3, topic: "Kasrlar", duration: 45 });
    assert.equal(r.status, 200); assert.equal(Object.keys(r.json.sections).length, 10);
    assert.equal(r.json.sections["Yangi mavzu"], "Test mavzu"); assert.equal(r.json.sections["Refleksiya"], "");
    assert.equal(seen.at(-1)!.body.output_config.format.type, "json_schema");
    assert.equal((await u.req("POST", "/api/ai/lesson", { subject: "M", grade: 99, topic: "x" })).status, 400);
  });
  await t("xato tushuntirish: boshqa foydalanuvchining kartochkasi 404", async () => {
    const other = await db.user.findFirst({ where: { email: { not: email } }, include: { errorCards: true } });
    const card = await db.errorCard.findFirst({ where: { userId: other?.id } });
    if (card) assert.equal((await u.req("POST", "/api/ai/explain-error", { cardId: card.id })).status, 404);
    assert.equal((await u.req("POST", "/api/ai/explain-error", { cardId: "yoq" })).status, 404);
  });
  await t("rad etish (refusal) tushunarli xato beradi", async () => {
    mode = "refusal"; const r = await u.req("POST", "/api/ai/chat", { messages: [{ role: "user", content: "x" }] });
    assert.equal(r.status, 422); assert.ok(r.json.error);
  });
  await t("Anthropic xatosi -> 502, ichki xabar sizmaydi", async () => {
    mode = "error"; const r = await u.req("POST", "/api/ai/chat", { messages: [{ role: "user", content: "x" }] });
    assert.equal(r.status, 502); assert.ok(!JSON.stringify(r.json).includes("boom"));
    mode = "ok";
  });
  await t("kunlik limit: 5 tadan keyin 429 va API'ga so'rov ketmaydi", async () => {
    for (let i = 0; i < 6; i++) { const s = await u.req("POST", "/api/ai/chat", { messages: [{ role: "user", content: "x" }] }); if (s.status === 429) break; }
    const before = seen.length; const r = await u.req("POST", "/api/ai/chat", { messages: [{ role: "user", content: "x" }] });
    assert.equal(r.status, 429); assert.equal(seen.length, before);
  });
  await t("bepul AI: javob, kalit va limit (FREE_LLM_* sozlangan bo'lsa)", async () => {
    assert.equal((await anon.req("POST", "/api/ai/free-chat", { messages: [{ role: "user", content: "x" }] })).status, 401);
    const st = await u.req("GET", "/api/ai/status"); assert.equal(st.json.free.configured, true);
    const r = await u.req("POST", "/api/ai/free-chat", { messages: [{ role: "user", content: "Salom" }] });
    assert.equal(r.status, 200); assert.equal(r.json.reply, "Bepul javob");
    const f = freeSeen.at(-1); assert.equal(f.url, "/chat/completions"); assert.equal(f.auth, "Bearer free-key");
    for (let i = 0; i < 4; i++) await u.req("POST", "/api/ai/free-chat", { messages: [{ role: "user", content: "x" }] });
    const lim = await u.req("POST", "/api/ai/free-chat", { messages: [{ role: "user", content: "x" }] });
    assert.equal(lim.status, 429);
  });
  await t("AiRequest jurnalida matn saqlanmaydi, tokenlar bor", async () => {
    const user = await db.user.findUnique({ where: { email } });
    const rows = await db.aiRequest.findMany({ where: { userId: user!.id } });
    assert.ok(rows.length >= 5); assert.ok(rows.some((r) => r.inputTokens === 11 && r.outputTokens === 7));
    assert.ok(Object.keys(rows[0]).every((k) => ["id", "userId", "feature", "model", "inputTokens", "outputTokens", "status", "createdAt"].includes(k)));
  });
  console.log(`\n${pass} ta tekshiruv muvaffaqiyatli.`);
}
main().then(() => { mock.close(); freeMock.close(); return db.$disconnect(); }).catch((e) => { console.error(e); process.exit(1); });
