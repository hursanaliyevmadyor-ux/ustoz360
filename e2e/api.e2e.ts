/** E2E: ishga tushirilgan server (BASE_URL) va haqiqiy PostgreSQL bilan. `npm run test:e2e` */
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";

const BASE = process.env.BASE_URL ?? "http://localhost:3112";
const db = new PrismaClient();
let pass = 0;
const t = async (name: string, fn: () => Promise<void>) => { await fn(); pass++; console.log("OK  ", name); };

class Client {
  cookie = "";
  async call(path: string, body?: unknown, method?: string) {
    const res = await fetch(BASE + path, { method: method ?? (body === undefined && !/^\/api\/(diagnostic|auth|review)/.test(path) ? "GET" : "POST"), headers: { "content-type": "application/json", cookie: this.cookie }, body: body === undefined ? undefined : JSON.stringify(body) });
    const set = res.headers.get("set-cookie");
    if (set) this.cookie = set.split(";")[0];
    return { status: res.status, json: (await res.json()) as any };
  }
  async register(email: string, password = "Sinov-parol-123", name = "Test") {
    const r = await this.call("/api/auth/register", { email, password, name });
    assert.equal(r.status, 200, JSON.stringify(r.json));
  }
}

async function main() {
  const stamp = Date.now();
  const emailA = `e2e-a-${stamp}@example.com`, emailB = `e2e-b-${stamp}@example.com`, emailC = `e2e-c-${stamp}@example.com`;
  await db.user.deleteMany({ where: { email: { startsWith: "e2e-" } } });
  await db.auditLog.deleteMany({ where: { action: "auth.login_failed", userId: null } });

  await t("kirmagan foydalanuvchi diagnostikani boshlay olmaydi (401)", async () => {
    assert.equal((await new Client().call("/api/diagnostic/start", {})).status, 401);
  });
  await t("kuchsiz parol (8 belgidan kam) va noto'g'ri email rad etiladi (400)", async () => {
    const c = new Client();
    assert.equal((await c.call("/api/auth/register", { email: emailC, password: "qisqa" })).status, 400);
    assert.equal((await c.call("/api/auth/register", { email: "emailemas", password: "yetarlicha-uzun" })).status, 400);
  });
  await t("ro'yxatdan o'tish: parol xeshlanadi (ochiq matn saqlanmaydi), email kichik harfga keltiriladi", async () => {
    const c = new Client();
    const r = await c.call("/api/auth/register", { email: emailC.toUpperCase(), password: "Mening-parolim-1", name: "C" });
    assert.equal(r.status, 200);
    const u = await db.user.findUniqueOrThrow({ where: { email: emailC } });
    assert.ok(u.passwordHash?.startsWith("scrypt$") && !u.passwordHash.includes("Mening-parolim-1"));
    assert.equal((await c.call("/api/me")).json.user.email, emailC);
  });
  await t("takroriy email rad etiladi (409)", async () => {
    assert.equal((await new Client().call("/api/auth/register", { email: emailC, password: "Boshqa-parol-22" })).status, 409);
  });
  await t("noto'g'ri parol va mavjud bo'lmagan email bir xil xabar beradi (401)", async () => {
    const c = new Client();
    const wrong = await c.call("/api/auth/login", { email: emailC, password: "xato-parol-xx" });
    const none = await c.call("/api/auth/login", { email: `yoq-${stamp}@example.com`, password: "xato-parol-xx" });
    assert.equal(wrong.status, 401); assert.equal(none.status, 401); assert.equal(wrong.json.error, none.json.error);
  });
  await t("to'g'ri parol bilan kirish ishlaydi va sessiya beradi", async () => {
    const c = new Client(); const r = await c.call("/api/auth/login", { email: emailC.toUpperCase(), password: "Mening-parolim-1" });
    assert.equal(r.status, 200); assert.equal((await c.call("/api/me")).json.user.email, emailC);
  });
  await t("5 ta noto'g'ri urinishdan keyin akkaunt vaqtincha bloklanadi (429), hatto to'g'ri parol ham", async () => {
    const c = new Client(); const e = `e2e-lock-${stamp}@example.com`; await c.register(e, "Qulf-parol-123");
    const x = new Client(); const codes: number[] = [];
    for (let i = 0; i < 6; i++) codes.push((await x.call("/api/auth/login", { email: e, password: "xato-parol-xx" })).status);
    assert.deepEqual(codes, [401, 401, 401, 401, 401, 429]);
    assert.equal((await x.call("/api/auth/login", { email: e, password: "Qulf-parol-123" })).status, 429);
  });

  const a = new Client(), b = new Client(); const a2 = a;
  await a.register(emailA); await b.register(emailB);

  // DRAFT savol rasmiy diagnostikaga tushmasligi kerak
  const topic = await db.topic.findFirstOrThrow();
  const draft = await db.question.create({ data: { topicId: topic.id, text: "E2E DRAFT savol", explanation: "x", difficulty: "EASY", status: "DRAFT", isDemo: true, options: { create: [{ text: "a", isCorrect: true, position: 0 }, { text: "b", position: 1 }] } } });

  let session: any;
  await t("diagnostika boshlanadi, javob kaliti klientga yuborilmaydi, DRAFT kirmaydi", async () => {
    const r = await a.call("/api/diagnostic/start", {});
    assert.equal(r.status, 200); session = r.json;
    assert.ok(session.questions.length >= 1);
    const raw = JSON.stringify(session);
    assert.ok(!raw.includes("isCorrect") && !raw.includes("explanation"), "kalit sizib chiqdi");
    assert.ok(!session.questions.some((q: any) => q.id === draft.id), "DRAFT savol kirib qoldi");
  });

  await t("begona foydalanuvchi sessiyani topshira olmaydi (404)", async () => {
    assert.equal((await b.call("/api/diagnostic/submit", { sessionId: session.sessionId, answers: {} })).status, 404);
  });

  let result: any;
  await t("server baholaydi: 0-variantni tanlash natijasi bazadagi kalit bo'yicha", async () => {
    const answers: Record<string, string> = {};
    for (const q of session.questions) answers[q.id] = q.options[0].id;
    const r = await a.call("/api/diagnostic/submit", { sessionId: session.sessionId, answers });
    assert.equal(r.status, 200); result = r.json;
    const expected = await db.answerOption.count({ where: { questionId: { in: session.questions.map((q: any) => q.id) }, position: 0, isCorrect: true } });
    assert.equal(result.score, expected); assert.equal(result.total, session.questions.length);
  });
  await t("kam savolli mavzu 'qo'shimcha diagnostika kerak' deb belgilanadi", async () => {
    assert.ok(result.topics.every((x: any) => x.total >= 4 || x.needsMoreData));
  });
  await t("xatolar daftari avtomatik yangilanadi", async () => {
    const e = await a.call("/api/errors");
    assert.equal(e.status, 200);
    assert.equal(e.json.cards.length, result.total - result.score);
  });
  await t("qayta topshirish rad etiladi (409)", async () => {
    assert.equal((await a.call("/api/diagnostic/submit", { sessionId: session.sessionId, answers: {} })).status, 409);
  });
  await t("mastery mavzular bo'yicha saqlangan", async () => {
    const m = await a.call("/api/mastery"); assert.equal(m.status, 200); assert.ok(m.json.topics.length >= 1);
  });
  // ---- Takrorlash ----
  const userA = await db.user.findUniqueOrThrow({ where: { email: emailA } });
  const cards = () => db.errorCard.findMany({ where: { userId: userA.id }, orderBy: { id: "asc" } });
  const correctOf = async (qid: string) => (await db.answerOption.findFirstOrThrow({ where: { questionId: qid, isCorrect: true } })).id;
  const wrongOf = async (qid: string) => (await db.answerOption.findFirstOrThrow({ where: { questionId: qid, isCorrect: false } })).id;

  await t("muddati kelmagan kartochkalar takrorlashga kirmaydi", async () => {
    const r = await a2.call("/api/review/start", {}); assert.equal(r.status, 200); assert.equal(r.json.empty, true);
  });
  await db.errorCard.updateMany({ where: { userId: userA.id }, data: { nextReviewAt: new Date(Date.now() - 1000) } });
  let rs: any;
  await t("muddati kelgan kartochkalardan test tuziladi, kalit yuborilmaydi", async () => {
    const r = await a2.call("/api/review/start", {}); assert.equal(r.status, 200); rs = r.json;
    assert.equal(rs.questions.length, (await cards()).length);
    assert.ok(!JSON.stringify(rs).includes("isCorrect") && !JSON.stringify(rs).includes("explanation"));
  });
  await t("takrorlash sessiyasi diagnostika orqali topshirilmaydi (404)", async () => {
    assert.equal((await a2.call("/api/diagnostic/submit", { sessionId: rs.sessionId, answers: {} })).status, 404);
  });
  const before = await cards();
  await t("takrorlash: to'g'ri javob intervalni ikki baravar qiladi, noto'g'ri 1 kunga qaytaradi", async () => {
    const answers: Record<string, string> = {};
    for (let i = 0; i < rs.questions.length; i++) { const qid = rs.questions[i].id; answers[qid] = i === 0 ? await correctOf(qid) : await wrongOf(qid); }
    const r = await a2.call("/api/review/submit", { sessionId: rs.sessionId, answers });
    assert.equal(r.status, 200); assert.equal(r.json.score, 1);
    const after = await cards(); const okId = rs.questions[0].id;
    for (const c of after) {
      const b0 = before.find((x) => x.id === c.id)!;
      if (c.questionId === okId) { assert.equal(c.intervalDays, b0.intervalDays * 2); assert.equal(c.mistakes, b0.mistakes); }
      else { assert.equal(c.intervalDays, 1); assert.equal(c.mistakes, b0.mistakes + 1); assert.equal(c.mastered, false); }
      assert.ok(c.nextReviewAt.getTime() > Date.now(), "keyingi takrorlash kelajakda bo'lishi kerak");
    }
  });
  await t("takrorlashni qayta topshirib bo'lmaydi (409)", async () => {
    assert.equal((await a2.call("/api/review/submit", { sessionId: rs.sessionId, answers: {} })).status, 409);
  });
  await t("takrorlangandan keyin kartochkalar muddati kelmaguncha qayta chiqmaydi", async () => {
    assert.equal((await a2.call("/api/review/start", {})).json.empty, true);
  });
  await t("interval 8 kunga yetgach kartochka 'o'zlashtirildi' bo'ladi va takrorlashdan chiqadi", async () => {
    const card = (await cards())[0];
    await db.errorCard.update({ where: { id: card.id }, data: { intervalDays: 4, nextReviewAt: new Date(Date.now() - 1000), mastered: false } });
    const r = await a2.call("/api/review/start", {}); assert.equal(r.json.questions.length, 1);
    const qid = r.json.questions[0].id;
    await a2.call("/api/review/submit", { sessionId: r.json.sessionId, answers: { [qid]: await correctOf(qid) } });
    const c = await db.errorCard.findUniqueOrThrow({ where: { id: card.id } });
    assert.equal(c.intervalDays, 8); assert.equal(c.mastered, true);
    await db.errorCard.updateMany({ where: { userId: userA.id }, data: { nextReviewAt: new Date(Date.now() - 1000) } });
    const again = await a2.call("/api/review/start", {});
    assert.ok(!again.json.questions?.some((q: any) => q.id === qid), "o'zlashtirilgan kartochka qayta chiqdi");
  });
  // ---- Dashboard va profil ----
  await t("dashboard/profil kirmagan foydalanuvchiga yopiq (401)", async () => {
    assert.equal((await new Client().call("/api/dashboard")).status, 401);
    assert.equal((await new Client().call("/api/profile")).status, 401);
  });
  await t("dashboard sonlari bazadagi haqiqiy qiymatlarga mos", async () => {
    const d = await a2.call("/api/dashboard"); assert.equal(d.status, 200);
    const all = await cards();
    assert.equal(d.json.errors.total, all.length);
    assert.equal(d.json.errors.due, all.filter((c) => !c.mastered && c.nextReviewAt <= new Date()).length);
    assert.equal(d.json.errors.mastered, all.filter((c) => c.mastered).length);
    const last = await db.testSession.findFirstOrThrow({ where: { userId: userA.id, status: "SUBMITTED" }, orderBy: { submittedAt: "desc" } });
    assert.equal(d.json.lastTest.score, last.score); assert.equal(d.json.lastTest.total, last.total);
    assert.ok(d.json.history.length >= 2, "kamida diagnostika va takrorlash tarixi bor");
    assert.equal(d.json.daysLeft, null); assert.ok(d.json.tasks.some((x: any) => x.id === "exam"), "sana belgilanmagan: vazifa kerak");
    assert.ok(!d.json.tasks.some((x: any) => x.id === "diag"), "diagnostika topshirilgan");
  });
  await t("profil saqlanadi va dashboard imtihongacha kunlarni ko'rsatadi", async () => {
    const date = new Date(Date.now() + 20 * 86_400_000).toISOString().slice(0, 10);
    const r = await a2.call("/api/profile", { name: "E2E Ustoz", examDate: date, dailyMinutes: 60, targetExam: "ATTESTATSIYA" }, "PUT");
    assert.equal(r.status, 200); assert.equal(r.json.examDate, date); assert.equal(r.json.name, "E2E Ustoz");
    assert.equal((await a2.call("/api/profile")).json.dailyMinutes, 60);
    const d = await a2.call("/api/dashboard");
    assert.ok(d.json.daysLeft === 20 || d.json.daysLeft === 21, `daysLeft=${d.json.daysLeft}`); assert.equal(d.json.dailyMinutes, 60);
    assert.ok(!d.json.tasks.some((x: any) => x.id === "exam"));
  });
  await t("profilga noto'g'ri qiymatlar rad etiladi (400)", async () => {
    for (const bad of [{ dailyMinutes: 5 }, { dailyMinutes: 9999 }, { examDate: "2026-13-45" }, { targetExam: "BOSHQA" }, { experience: -1 }])
      assert.equal((await a2.call("/api/profile", bad, "PUT")).status, 400, JSON.stringify(bad));
  });
  await t("logoutdan keyin sessiya yaroqsiz", async () => {
    await a.call("/api/auth/logout", {});
    assert.equal((await a.call("/api/errors")).status, 401);
  });

  await db.question.delete({ where: { id: draft.id } });
  await db.user.deleteMany({ where: { email: { startsWith: "e2e-" } } });
  console.log(`\n${pass} ta tekshiruv o'tdi`);
}
main().then(() => db.$disconnect(), (e) => { console.error("FAIL", e); process.exit(1); });
