/**
 * Platforma E2E (ishga tushirilgan server va haqiqiy baza bilan): MARKET va to'lov, DARSYOR hujjatlari, TOIFA, SINF, BILIMXONA, admin himoyasi.
 *
 * Tayyorgarlik (sinov foydalanuvchilari, haqiqiy foydalanuvchi emas):
 *   npx tsx --env-file=.env.local prisma/dev-test-user.ts --admin     -> E2E_ADMIN_TOKEN
 *   npx tsx --env-file=.env.local prisma/dev-test-user.ts --second     -> E2E_USER_TOKEN
 * Ishga tushirish:  $env:E2E_ADMIN_TOKEN="..."; $env:E2E_USER_TOKEN="..."; npm run test:e2e:platform
 * Tugagach:         npx tsx --env-file=.env.local prisma/dev-test-user.ts --remove   (sinov ma'lumotlari kaskad bilan o'chadi)
 */
import assert from "node:assert/strict";

const BASE = process.env.BASE_URL ?? "http://127.0.0.1:3000";
const ADMIN = process.env.E2E_ADMIN_TOKEN, USER = process.env.E2E_USER_TOKEN;
if (!ADMIN || !USER) { console.error("E2E_ADMIN_TOKEN va E2E_USER_TOKEN kerak (yuqoridagi tayyorgarlikka qarang)."); process.exit(1); }

let pass = 0;
const t = async (name: string, fn: () => Promise<void>) => { await fn(); pass++; console.log("OK  ", name); };
async function call(token: string | null, method: string, path: string, body?: unknown) {
  const res = await fetch(BASE + path, { method, headers: { ...(body !== undefined && { "content-type": "application/json" }), ...(token && { cookie: `u360_session=${token}` }) }, body: body === undefined ? undefined : JSON.stringify(body) });
  const txt = await res.text(); let json: any; try { json = JSON.parse(txt); } catch { json = txt; }
  return { status: res.status, json };
}
const as = (token: string | null) => ({ get: (p: string) => call(token, "GET", p), post: (p: string, b?: unknown) => call(token, "POST", p, b ?? {}), put: (p: string, b: unknown) => call(token, "PUT", p, b), patch: (p: string, b: unknown) => call(token, "PATCH", p, b), del: (p: string) => call(token, "DELETE", p) });
const admin = as(ADMIN), user = as(USER), anon = as(null);

async function main() {
  await t("himoya: kirmagan foydalanuvchi 401, oddiy foydalanuvchi admin API'larida 403", async () => {
    for (const p of ["/api/docs", "/api/toifa", "/api/sinf", "/api/library", "/api/notifications", "/api/market/purchases"]) assert.equal((await anon.get(p)).status, 401, p);
    for (const p of ["/api/admin/stats", "/api/admin/users", "/api/admin/payments", "/api/admin/settings", "/api/admin/courses", "/api/admin/library", "/api/admin/official", "/api/admin/reports?type=users&format=json"]) assert.equal((await user.get(p)).status, 403, p);
    assert.equal((await user.put("/api/admin/settings", { key: "payments", value: { mode: "manual", manualInstructions: "", minPriceUzs: 0 } })).status, 403);
    assert.equal((await anon.get("/api/market/catalog")).status, 200); // katalog hamma uchun ochiq
    assert.equal((await anon.get("/api/settings/public")).status, 200);
  });

  await t("ochiq sozlamalarda maxfiy ma'lumot yo'q", async () => {
    const s = await anon.get("/api/settings/public");
    assert.ok(!/key|secret|token|password/i.test(JSON.stringify(s.json)));
    const full = await admin.get("/api/admin/settings");
    assert.ok(!/sk-|postgres:|GOCSPX|bot\d/i.test(JSON.stringify(full.json)), "admin sozlamalarida kalit qiymati ko'rinmasin");
  });

  const me = (await user.get("/api/me")).json.user; assert.ok(me?.id, "E2E_USER_TOKEN yaroqsiz");
  const prevPay = (await admin.get("/api/admin/settings")).json.settings.payments;

  await t("MARKET: rol -> kurs -> tekshiruv -> tasdiq -> buyurtma -> to'lov tasdig'i -> kirish -> qaytarish", async () => {
    assert.equal((await user.get("/api/market/author")).status, 403, "muallif roli bo'lmasa kabinet yopiq");
    assert.equal((await admin.patch(`/api/admin/users/${me.id}`, { roles: ["COURSE_AUTHOR"] })).status, 200);
    assert.equal((await admin.put("/api/admin/settings", { key: "payments", value: { mode: "manual", manualInstructions: "E2E: sinov ko'rsatma", minPriceUzs: 0 } })).status, 200);

    const bad = await user.post("/api/market/author", { title: "E2E", description: "qisqa", subject: "x", kind: "Videokurs", priceUzs: -1, lessonCount: 0 });
    assert.equal(bad.status, 400);
    const c = await user.post("/api/market/author", { title: "E2E kurs", description: "E2E sinovi uchun yaratilgan kurs tavsifi.", subject: "Umumiy", kind: "Videokurs", priceUzs: 5000, lessonCount: 2, accessUrl: "https://example.com/e2e" });
    assert.equal(c.status, 200); const id = c.json.id;
    assert.equal((await admin.get("/api/market/catalog")).json.courses.some((x: any) => x.id === id), false, "tasdiqlanmagan kurs katalogda yo'q");
    assert.equal((await user.post(`/api/market/author/${id}/submit`)).status, 200);
    assert.equal((await admin.post("/api/market/order", { kind: "COURSE", courseId: id })).status, 404, "tasdiqlanmagan kursni sotib bo'lmaydi");
    assert.equal((await admin.patch(`/api/admin/courses/${id}`, { action: "reject" })).status, 400, "rad etish sababsiz bo'lmaydi");
    assert.equal((await admin.patch(`/api/admin/courses/${id}`, { action: "approve" })).status, 200);
    assert.equal((await admin.get("/api/market/catalog")).json.courses.some((x: any) => x.id === id), true);

    const o1 = await admin.post("/api/market/order", { kind: "COURSE", courseId: id }); assert.equal(o1.status, 200);
    assert.equal(o1.json.payment.amount, 5000); assert.equal(o1.json.payment.status, "PENDING");
    assert.equal((await admin.post("/api/market/order", { kind: "COURSE", courseId: id })).json.payment.id, o1.json.payment.id, "ochiq buyurtma takrorlanmaydi");
    assert.equal((await admin.get("/api/market/purchases")).json.courses.length, 0, "to'lovsiz kirish yo'q");
    const pid = o1.json.payment.id;
    assert.equal((await user.patch(`/api/admin/payments/${pid}`, { action: "confirm" })).status, 403);
    assert.equal((await admin.patch(`/api/admin/payments/${pid}`, { action: "confirm" })).json.already, false);
    assert.equal((await admin.patch(`/api/admin/payments/${pid}`, { action: "confirm" })).json.already, true, "takroriy tasdiq idempotent");
    assert.equal((await admin.get("/api/market/purchases")).json.courses.length, 1);
    assert.equal((await admin.post("/api/market/order", { kind: "COURSE", courseId: id })).status, 409, "allaqachon sotib olingan");
    assert.equal((await admin.patch(`/api/admin/payments/${pid}`, { action: "refund" })).status, 200);
    assert.equal((await admin.get("/api/market/purchases")).json.courses.length, 0, "qaytarilgach kirish yopiladi");
    assert.equal((await anon.post("/api/payments/webhook", { eventId: "e", reference: "U360-X", amount: 1, status: "paid" })).status, 503, "webhook kaliti yo'q: tasdiqlanmaydi");
  });

  await t("MARKET: tarif buyurtmasi va tasdiqlash AI limitini oshiradi", async () => {
    const before = (await admin.get("/api/ai/status")).json.limit;
    const o = await admin.post("/api/market/order", { kind: "PLAN", planKey: "PRO" }); assert.equal(o.status, 200);
    assert.equal((await admin.post("/api/market/order", { kind: "PLAN", planKey: "FREE" })).status, 400);
    assert.equal((await admin.patch(`/api/admin/payments/${o.json.payment.id}`, { action: "confirm" })).status, 200);
    assert.equal((await admin.get("/api/me")).json.user.plan, "PRO");
    assert.equal((await admin.get("/api/ai/status")).json.limit, before * 2);
    assert.equal((await admin.patch(`/api/admin/payments/${o.json.payment.id}`, { action: "refund" })).status, 200);
    assert.equal((await admin.get("/api/me")).json.user.plan, "FREE");
    assert.equal((await admin.put("/api/admin/settings", { key: "payments", value: prevPay })).status, 200); // sozlama joyiga qaytdi
    if (prevPay.mode === "off") assert.equal((await admin.post("/api/market/order", { kind: "PLAN", planKey: "PRO" })).status, 503, "to'lov yopiq bo'lsa buyurtma berib bo'lmaydi");
  });

  await t("DARSYOR: hujjat saqlash, o'zgartirish, egasi bo'lmaganga ko'rinmaslik, tuzilma tekshiruvi", async () => {
    assert.equal((await user.post("/api/docs", { kind: "lesson_plan", title: "X", data: {} })).status, 400);
    const d = await user.post("/api/docs", { kind: "rubric", title: "E2E rubrika", status: "SAVED", data: { levels: ["A", "B"], criteria: [{ name: "M", cells: ["a", "b"] }] } });
    assert.equal(d.status, 200);
    assert.equal((await user.put(`/api/docs/${d.json.id}`, { kind: "rubric", title: "E2E rubrika 2", status: "DRAFT", data: { levels: ["A", "B"], criteria: [{ name: "M", cells: ["a", "b"] }] } })).status, 200);
    assert.equal((await user.get(`/api/docs/${d.json.id}`)).json.title, "E2E rubrika 2");
    assert.equal((await admin.get(`/api/docs/${d.json.id}`)).status, 404, "boshqa foydalanuvchi ko'ra olmaydi");
    assert.equal((await admin.del(`/api/docs/${d.json.id}`)).status, 404);
    assert.equal((await user.del(`/api/docs/${d.json.id}`)).status, 200);
    const ai = await user.post("/api/ai/taskset", { subject: "Matematika", grade: "3", topic: "Kasrlar", level: "easy", count: 2, types: ["single"] });
    assert.ok([200, 503, 429].includes(ai.status), "AI ulanmagan bo'lsa halol 503");
  });

  await t("TOIFA: maqsad, qoidali reja, qo'lda band va bajarilganini saqlash, cheklist, rasmiy ma'lumot", async () => {
    assert.equal((await user.put("/api/profile", { targetExam: "ATTESTATSIYA", examDate: "2099-01-01", dailyMinutes: 60 })).status, 200);
    const g = await user.post("/api/toifa/plan"); assert.equal(g.status, 200); assert.ok(g.json.created > 0);
    const s1 = (await user.get("/api/toifa")).json;
    assert.ok(s1.plan.length > 0 && s1.goal.daysLeft > 0 && s1.roadmap.length === 5);
    const mine = await user.post("/api/toifa/plan", { date: s1.today, title: "E2E o'z vazifam" }); assert.equal(mine.status, 200);
    const auto = s1.plan.find((p: any) => p.source === "AUTO");
    assert.equal((await user.patch(`/api/toifa/plan/${auto.id}`, { done: true })).status, 200);
    assert.equal((await user.post("/api/toifa/plan")).status, 200);
    const s2 = (await user.get("/api/toifa")).json;
    assert.ok(s2.plan.some((p: any) => p.title === "E2E o'z vazifam"), "qo'lda qo'shilgan band saqlanadi");
    assert.ok(s2.plan.some((p: any) => p.id === auto.id && p.done), "bajarilgan band saqlanadi");
    assert.equal((await user.post("/api/toifa/checklist", { seed: true })).status, 200);
    assert.equal((await user.post("/api/toifa/checklist", { seed: true })).status, 409);
    assert.equal((await user.put("/api/profile", { targetExam: null, examDate: null })).status, 200);
    assert.equal((await admin.post("/api/admin/official", { kind: "LINK", title: "E2E", url: "https://example.uz", verified: true })).status, 400, "manbasiz tekshirilgan bo'lmaydi");
    const o = await admin.post("/api/admin/official", { kind: "LINK", title: "E2E havola", url: "https://example.uz", sourceName: "E2E manba", verified: false });
    assert.equal(o.status, 200);
    assert.equal((await user.get("/api/toifa")).json.official.find((x: any) => x.id === o.json.id).verified, false, "tekshirilmagan deb ko'rinadi");
    assert.equal((await admin.del(`/api/admin/official/${o.json.id}`)).status, 200);
  });

  await t("SINF: sinf, taxallus, baholash, ball, tahlil, oldin/keyin, egasi tekshiruvi", async () => {
    const c = await user.post("/api/sinf", { name: "E2E sinf", subject: "Matematika", grade: "3" }); assert.equal(c.status, 200); const id = c.json.id;
    assert.equal((await user.post(`/api/sinf/${id}/students`, { aliases: ["O1", "Ali Vali Karim"] })).status, 400, "ism-familiya taxallus emas");
    assert.equal((await user.post(`/api/sinf/${id}/students`, { aliases: ["O1", "O2", "O3", "O4", "O5"] })).json.added, 5);
    const sids = (await user.get(`/api/sinf/${id}`)).json.students.map((s: any) => s.id) as string[];
    const a1 = (await user.post(`/api/sinf/${id}/assessments`, { title: "Kirish", topic: "Bo'lish", kind: "BEFORE", maxScore: 10, date: "2026-10-01" })).json.id;
    const a2 = (await user.post(`/api/sinf/${id}/assessments`, { title: "Yakun", topic: "Bo'lish", kind: "AFTER", maxScore: 10, date: "2026-10-15" })).json.id;
    const sc = (v: number[]) => ({ scores: Object.fromEntries(sids.map((s, i) => [s, v[i]])) });
    assert.equal((await user.put(`/api/sinf/${id}/assessments/${a1}/scores`, sc([3, 4, 5, 2, 6]))).status, 200);
    assert.equal((await user.put(`/api/sinf/${id}/assessments/${a2}/scores`, sc([11, 8, 8, 5, 9]))).status, 400, "ball eng yuqori balldan oshmasin");
    assert.equal((await user.put(`/api/sinf/${id}/assessments/${a2}/scores`, sc([7, 8, 8, 5, 9]))).status, 200);
    const d = (await user.get(`/api/sinf/${id}`)).json;
    assert.equal(d.analysis.comparisons[0].common, 5); assert.ok(d.analysis.comparisons[0].delta > 0);
    assert.equal((await admin.get(`/api/sinf/${id}`)).status, 404, "boshqa o'qituvchi sinfni ko'ra olmaydi");
    assert.equal((await admin.put(`/api/sinf/${id}/assessments/${a1}/scores`, sc([1, 1, 1, 1, 1]))).status, 404);
    assert.equal((await user.del(`/api/sinf/${id}`)).status, 200);
  });

  await t("BILIMXONA: ro'yxat ishlaydi; saqlash xizmati ulanmagan bo'lsa yuklash halol 503, noto'g'ri fayl rad etiladi", async () => {
    const l = await user.get("/api/library"); assert.equal(l.status, 200);
    const fd = new FormData(); fd.append("file", new File(["salom"], "a.txt")); fd.append("title", "E2E");
    const r = await fetch(BASE + "/api/library", { method: "POST", headers: { cookie: `u360_session=${USER}` }, body: fd });
    if (l.json.storage.configured) assert.ok([200, 409].includes(r.status)); else assert.equal(r.status, 503);
    const empty = await fetch(BASE + "/api/library", { method: "POST", headers: { cookie: `u360_session=${USER}` }, body: new FormData() });
    assert.equal(empty.status, 400);
  });

  await t("admin: hisobot CSV va dashboard haqiqiy ma'lumot, foydalanuvchi qidiruvi", async () => {
    const csv = await fetch(BASE + "/api/admin/reports?type=payments&format=csv", { headers: { cookie: `u360_session=${ADMIN}` } });
    assert.equal(csv.status, 200); assert.match(csv.headers.get("content-type") ?? "", /text\/csv/);
    const st = (await admin.get("/api/admin/stats")).json; assert.ok(typeof st.users === "number" && st.users >= 2);
    const u = (await admin.get("/api/admin/users?q=sinov")).json; assert.ok(u.users.length >= 2);
    assert.equal((await admin.patch(`/api/admin/users/${(await admin.get("/api/me")).json.user.id}`, { roles: ["TEACHER"] })).status, 400, "o'z rolini o'zgartira olmaydi");
  });

  console.log(`\n${pass} ta blok o'tdi.`);
}
main().catch((e) => { console.error("XATO:", e); process.exit(1); });
