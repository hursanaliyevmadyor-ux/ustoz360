/**
 * Internet qidiruvi E2E: ishga tushirilgan sayt va HAQIQIY baza bilan, lekin Tavily o'rniga soxta server (hech qanday kredit sarflanmaydi).
 * Tekshiriladi: bilim bazasi birinchi, rasmiy domenlar, ishonchlilik tartibi, qat'iy javob, tayyor material (yaratilmaydi), kesh, limitlar, admin ko'rsatkichlari.
 *
 * Tayyorgarlik (sinov foydalanuvchilari):
 *   npx tsx --env-file=.env.local prisma/apply-sql.ts prisma/supabase-update-web-cache.sql   (bir marta)
 *   npx tsx --env-file=.env.local prisma/dev-test-user.ts --admin     -> E2E_ADMIN_TOKEN
 *   npx tsx --env-file=.env.local prisma/dev-test-user.ts --second     -> E2E_USER_TOKEN
 * Saytni soxta Tavily bilan ishga tushiring (alohida terminal):
 *   $env:TAVILY_API_KEY='tv-e2e'; $env:TAVILY_API_BASE='http://127.0.0.1:8098'; npm run dev
 * Ishga tushirish:  $env:E2E_ADMIN_TOKEN='...'; $env:E2E_USER_TOKEN='...'; npm run test:e2e:websearch
 * Tugagach:         npx tsx --env-file=.env.local prisma/dev-test-user.ts --remove
 */
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { PrismaClient } from "@prisma/client";

const BASE = process.env.BASE_URL ?? "http://127.0.0.1:3000";
const ADMIN = process.env.E2E_ADMIN_TOKEN, USER = process.env.E2E_USER_TOKEN;
if (!ADMIN || !USER) { console.error("E2E_ADMIN_TOKEN va E2E_USER_TOKEN kerak (yuqoridagi tayyorgarlikka qarang)."); process.exit(1); }
const db = new PrismaClient();

// ---------- soxta Tavily ----------
type Req = { path: string; auth: string; body: Record<string, any> };
const reqs: Req[] = [];
const searches = () => reqs.filter((r) => r.path === "/search");
const fake = createServer((req, res) => {
  let raw = "";
  req.on("data", (c) => (raw += c));
  req.on("end", () => {
    const body = raw ? JSON.parse(raw) : {};
    reqs.push({ path: String(req.url), auth: String(req.headers.authorization ?? ""), body });
    res.setHeader("content-type", "application/json");
    if (req.url === "/usage") return res.end(JSON.stringify({ account: { current_plan: "Researcher", plan_usage: 42, plan_limit: 1000 } }));
    const q = String(body.query ?? "").toLowerCase();
    let results: unknown[];
    if (q.includes("11-sinf")) results = [
      { title: "10-sinf algebra testlari", url: "https://blog-e2e.uz/10", content: "Matematika 10-sinf 4-chorak testlari. ".repeat(4), score: 0.95 },
      { title: "11-sinf matematika 4-chorak nazorat testlari", url: "https://edu.uz/e2e/11", content: "Matematika fanidan 11-sinf uchun 4-chorak nazorat testlari. ".repeat(4), score: 0.6 },
      { title: "Test kanali", url: "https://t.me/e2etests", content: "tayyor testlar kanali ".repeat(8), score: 0.99 },
    ];
    else if (q.includes("9-sinf")) results = [{ title: "Tarix 5-sinf", url: "https://blog-e2e.uz/tarix", content: "Tarix fanidan 5-sinf 1-chorak savollari. ".repeat(5), score: 0.7 }];
    else if (Array.isArray(body.include_domains)) results = [
      { title: "Attestatsiya tartibi", url: "https://lex.uz/e2e/att", content: "Attestatsiya 2026-yil mart oyida boshlanadi. ".repeat(4), score: 0.5 },
      { title: "Blog fikri", url: "https://blog-e2e.uz/att", content: "Attestatsiya haqida fikrlar. ".repeat(4), score: 0.99 },
    ];
    else results = [{ title: "Yangilik", url: "https://kun.uz/e2e/n", content: "Ta'lim yangiliklari matni. ".repeat(5), score: 0.8 }];
    res.end(JSON.stringify({ results }));
  });
});

// ---------- yordamchilar ----------
let pass = 0;
const t = async (name: string, fn: () => Promise<void>) => { await fn(); pass++; console.log("OK  ", name); };
async function call(token: string | null, method: string, path: string, body?: unknown) {
  const res = await fetch(BASE + path, { method, headers: { ...(body !== undefined && { "content-type": "application/json" }), ...(token && { cookie: `u360_session=${token}` }) }, body: body === undefined ? undefined : JSON.stringify(body) });
  const txt = await res.text(); let json: any; try { json = JSON.parse(txt); } catch { json = txt; }
  return { status: res.status, json };
}
const as = (token: string | null) => ({ get: (p: string) => call(token, "GET", p), post: (p: string, b?: unknown) => call(token, "POST", p, b ?? {}), put: (p: string, b: unknown) => call(token, "PUT", p, b), del: (p: string) => call(token, "DELETE", p) });
const admin = as(ADMIN), user = as(USER), anon = as(null);
const msg = (content: string) => ({ messages: [{ role: "user", content }], save: false });
const web = (content: string) => user.post("/api/ai/web-chat", msg(content));

async function main() {
  await new Promise<void>((r) => fake.listen(8098, "127.0.0.1", r));
  const me = await db.user.findFirstOrThrow({ where: { email: "mashq-sinov2@example.invalid" } });
  const original = (await admin.get("/api/admin/settings")).json.settings.ai;
  const wipe = () => db.webSearchCache.deleteMany({ where: { OR: [{ query: { contains: "11-sinf" } }, { query: { contains: "9-sinf" } }, { query: { contains: "attestatsiya", mode: "insensitive" } }] } });
  const credits = () => db.aiRequest.count({ where: { userId: me.id, feature: "web-credit", model: "tavily" } });
  let officialId: string | null = null;
  try {
    await wipe();
    assert.equal((await admin.put("/api/admin/settings", { key: "ai", value: { ...original, enabled: true, webDailyLimit: 4, webAuto: true } })).status, 200); // AI umumiy tugmasi o'chiq bo'lsa ham sinov ishlashi uchun vaqtincha yoqiladi, oxirida tiklanadi

    await t("himoya: kirmagan foydalanuvchi 401, oddiy foydalanuvchi admin ko'rsatkichlarida 403", async () => {
      assert.equal((await anon.post("/api/ai/web-chat", msg("savol"))).status, 401);
      assert.equal((await anon.get("/api/admin/ai/web")).status, 401);
      assert.equal((await user.get("/api/admin/ai/web")).status, 403);
      assert.equal((await user.post("/api/ai/web-chat", { messages: [{ role: "assistant", content: "x" }] })).status, 400, "oxirgi xabar foydalanuvchidan bo'lishi kerak");
    });

    await t("holat: Tavily ulangan, foydalanuvchi limiti ko'rinadi, kalit hech qayerda yo'q", async () => {
      const s = (await user.get("/api/ai/status")).json;
      assert.equal(s.web.configured, true); assert.equal(s.web.tavily, true); assert.equal(s.web.limit, 4);
      assert.ok(!/tv-e2e/.test(JSON.stringify(s)));
    });

    await t("tayyor material: ishonchli manba birinchi, ijtimoiy tarmoq chiqarilgan, test YARATILMAYDI, qidiruv so'rovi aniqlashtirilgan", async () => {
      const r = await web("11-sinf 4-chorak matematika testlari");
      assert.equal(r.status, 200, JSON.stringify(r.json));
      assert.equal(r.json.material, true); assert.equal(r.json.found, true); assert.equal(r.json.engine, "tavily");
      assert.deepEqual(r.json.sources.map((s: any) => s.url), ["https://edu.uz/e2e/11"], "faqat to'liq mos manba");
      assert.equal(r.json.sources[0].trust, "official");
      assert.match(r.json.reply, /Tayyor testlar bu yerda yaratilmadi/);
      assert.ok(!/A\)|To'g'ri javob/.test(r.json.reply), "test savollari yaratilmasligi kerak");
      assert.equal(searches().length, 1);
      assert.match(searches()[0].body.query, /^11-sinf matematika 4-chorak test namuna 20\d\d-20\d\d/);
      assert.equal(searches()[0].auth, "Bearer tv-e2e");
      assert.equal(await credits(), 1);
    });

    await t("kesh: bir xil savol Tavily'ga qayta bormaydi va kredit sarflamaydi", async () => {
      const r = await web("11-sinf 4-chorak matematika testlari");
      assert.equal(r.status, 200); assert.equal(r.json.engine, "cache");
      assert.equal(searches().length, 1); assert.equal(await credits(), 1);
    });

    await t("mos tayyor material topilmasa: 'topdim' deyilmaydi, yangi namunaviy material taklif qilinadi", async () => {
      const r = await web("9-sinf kimyo 3-chorak testlari");
      assert.equal(r.status, 200); assert.equal(r.json.material, true); assert.equal(r.json.found, false);
      assert.match(r.json.reply, /mos tayyor material topilmadi/); assert.match(r.json.reply, /yangi namunaviy test tuzib beraman/);
      assert.ok(!/mos manbalar topildi/.test(r.json.reply));
    });

    await t("rasmiy so'rov: avval rasmiy domenlar, manbalar ishonchlilik bo'yicha, qat'iy javob (AI ulanmagan bo'lsa parchalar)", async () => {
      const before = searches().length;
      const r = await web("Attestatsiya qachon boshlanadi?");
      assert.equal(r.status, 200, JSON.stringify(r.json));
      const sent = searches().slice(before);
      assert.equal(sent.length, 1);
      assert.ok(sent[0].body.include_domains.includes("lex.uz") && sent[0].body.include_domains.includes("gov.uz"));
      assert.equal(sent[0].body.time_range, "year");
      assert.deepEqual(r.json.sources.map((s: any) => s.trust), ["official", "general"]);
      assert.equal(r.json.official, true);
      assert.match(r.json.reply, /Topilgan manbalar \(AI javobi tayyorlanmadi\)|\[1\]/);
    });

    await t("bilim bazasi birinchi: yaqinda tekshirilgan rasmiy ma'lumot bo'lsa internetga chiqilmaydi", async () => {
      const c = await admin.post("/api/admin/official", { kind: "LINK", exam: "ATTESTATSIYA", title: "Qoraqalpoq attestatsiyasi hujjatlarini topshirish muddati", url: "https://example.uz/e2e", note: "Hujjatlar mart oyigacha topshiriladi", sourceName: "E2E manba", verified: true });
      assert.ok(c.status < 300, JSON.stringify(c.json)); officialId = c.json.id;
      const before = searches().length;
      const r = await user.post("/api/ai/free-chat", msg("Qoraqalpoq attestatsiyasi hujjatlarini topshirish muddati qachon?"));
      assert.equal(r.status, 200, JSON.stringify(r.json));
      assert.equal(r.json.searched, true);
      assert.equal(searches().length, before, "internetga chiqilmasligi kerak");
      assert.equal(r.json.sources[0].trust, "kb"); assert.equal(r.json.sources[0].url, "https://example.uz/e2e");
    });

    await t("foydalanuvchi kunlik limiti: tugagach internetga chiqilmaydi; avtomatik rejimda oddiy AI'ga o'tiladi", async () => {
      const s = (await user.get("/api/ai/status")).json.web;
      assert.equal(s.remaining, 0, `qolgan: ${JSON.stringify(s)}`);
      const before = searches().length;
      const r = await web("Ta'lim yangiliklari qanday?");
      assert.equal(r.status, 429); assert.equal(r.json.code, "web_daily_limit");
      const auto = await user.post("/api/ai/free-chat", msg("Yangi o'quv yili qoidalari qanday?"));
      assert.notEqual(auto.json.code, "web_daily_limit", "avtomatik rejimda foydalanuvchi to'silmaydi");
      assert.equal(searches().length, before);
    });

    await t("admin: Tavily ulanishi, sarflangan kreditlar, kesh va bilim bazasi ko'rsatkichlari; kalit ko'rinmaydi", async () => {
      const s = (await admin.get("/api/admin/ai/web")).json;
      assert.equal(s.tavily.configured, true);
      assert.ok(s.tavily.creditsMonth >= 3, `kreditlar: ${s.tavily.creditsMonth}`);
      assert.equal(s.tavily.monthlyCap, 900); assert.equal(s.tavily.remaining, s.tavily.monthlyCap - s.tavily.creditsMonth);
      assert.deepEqual(s.tavily.remote, { used: 42, limit: 1000, plan: "Researcher" });
      assert.ok(s.cacheHitsMonth >= 1); assert.ok(s.kbAnswersMonth >= 1); assert.ok(s.cacheEntries >= 1);
      assert.equal(s.perUserLimit, 4); assert.equal(s.auto, true);
      assert.ok(!/tv-e2e/.test(JSON.stringify(s)));
      const n = searches().length;
      const h = (await admin.post("/api/admin/ai/test")).json;
      assert.equal(h.web.tavily.configured, true);
      assert.equal(searches().length, n, "sinash qidiruv kreditini sarflamasligi kerak");
    });
  } finally {
    await admin.put("/api/admin/settings", { key: "ai", value: original }).catch(() => undefined);
    if (officialId) await admin.del(`/api/admin/official/${officialId}`).catch(() => undefined);
    await wipe().catch(() => undefined);
    await db.$disconnect(); fake.close();
  }
  console.log(`\n${pass} ta blok o'tdi.`);
}

main().catch((e) => { console.error("\nXATO:", e.message ?? e); process.exitCode = 1; });
