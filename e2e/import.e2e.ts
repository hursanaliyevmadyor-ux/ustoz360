/**
 * Aqlli fayl yuklash E2E (docs/SMART-IMPORT.md): ishga tushirilgan sayt + HAQIQIY baza + HAQIQIY fayl saqlash (Supabase Storage), lekin AI o'rniga soxta Gemini serveri
 * (hech qanday kalit/kredit ketmaydi). Tekshiriladi: fayl xavfsizligi (tur, eski format, soxta kengaytma, dublikat, egalik), savollarni ajratish, javob kaliti
 * mustaqil tekshirilishi (kalit hech qachon haqiqat emas: ziddiyat, hisob, «javob tasdiqlanmadi»), o'qituvchi tasdig'i, shaxsiy test, diagnostikada javoblar yashirinligi,
 * adminga yuborish (ulashish huquqi), admin tasdig'i, shaxsiy va umumiy bank ajralishi.
 *
 * Tayyorgarlik:
 *   npx tsx --env-file=.env.local prisma/apply-sql.ts prisma/supabase-update-smart-import.sql      (bir marta)
 *   npx tsx --env-file=.env.local prisma/dev-test-user.ts --admin     -> E2E_ADMIN_TOKEN   (admin: ko'rib chiqadi)
 *   npx tsx --env-file=.env.local prisma/dev-test-user.ts --second     -> E2E_USER_TOKEN    (oddiy ustoz: fayl yuklaydi va testni yuboradi)
 * Saytni soxta AI bilan ishga tushiring (alohida terminal; Claude kaliti bo'sh bo'lsin, aks holda qiyin savollar haqiqiy Claude'ga boradi):
 *   $env:GEMINI_API_KEY='e2e-gem'; $env:GEMINI_API_BASE='http://127.0.0.1:8098'; $env:ANTHROPIC_API_KEY=''; $env:FREE_LLM_BASE_URL=''
 *   $env:STORAGE_LOCAL_DIR='.tmp-e2e-storage'    (Supabase Storage ulanmagan bo'lsa: fayllar vaqtincha diskda saqlanadi; production'da ishlamaydi)
 *   npm run dev
 * Ishga tushirish:  $env:E2E_ADMIN_TOKEN='...'; $env:E2E_USER_TOKEN='...'; npm run test:e2e:import
 * Tugagach:         npx tsx --env-file=.env.local prisma/dev-test-user.ts --remove
 * Sinov o'zi yaratgan import, shaxsiy test va umumiy bankka o'tgan nusxalarni oxirida o'chiradi.
 */
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { PrismaClient } from "@prisma/client";

const BASE = process.env.BASE_URL ?? "http://127.0.0.1:3000";
const ADMIN = process.env.E2E_ADMIN_TOKEN ?? "", USER = process.env.E2E_USER_TOKEN ?? "";
if (!ADMIN || !USER) { console.error("E2E_ADMIN_TOKEN va E2E_USER_TOKEN kerak (yuqoridagi tayyorgarlikka qarang)."); process.exit(1); }
const db = new PrismaClient();

// ---------- soxta Gemini ----------
const aiCalls: string[] = [];
const ANSWERS: [RegExp, string][] = [[/poytaxti/i, "Toshkent"], [/fotosintez/i, "Xloroplast"]];
const fake = createServer((req, res) => {
  let raw = "";
  req.on("data", (c) => (raw += c));
  req.on("end", () => {
    const body = raw ? JSON.parse(raw) : {};
    const text: string = (body.contents?.[0]?.parts ?? []).map((p: { text?: string }) => p.text ?? "").join("\n");
    aiCalls.push(text);
    let out: unknown;
    if (text.includes("Solve each question independently")) {
      const inner = text.split("<questions>")[1]?.split("</questions>")[0] ?? "";
      const results = inner.split("### id=").slice(1).map((blk) => {
        const lines = blk.trim().split("\n");
        const id = lines[0].trim();
        const stem = lines.slice(1).filter((l) => !/^[A-J]\) /.test(l)).join(" ");
        const opts = lines.filter((l) => /^[A-J]\) /.test(l)).map((l) => ({ label: l[0], text: l.slice(3).trim() }));
        const hit = ANSWERS.find(([re]) => re.test(stem));
        const opt = hit ? opts.find((o) => o.text === hit[1]) : undefined;
        return opt
          ? { id, answer: opt.label, confidence: "high", explanation: "Soxta AI izohi.", usedSources: [], needsExternal: false, reasoningChecked: true, note: null }
          : { id, answer: null, confidence: "low", explanation: null, usedSources: [], needsExternal: false, reasoningChecked: false, note: null };
      });
      out = { results };
    } else {
      out = { pageCount: 1, sections: [], subject: "Pedagogika", grade: null, language: "uz-latn", hasQuestions: true, hasAnswerKey: false, note: null, questions: [], answerKey: [], warnings: [] };
    }
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(out) }] }, finishReason: "STOP" }], usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 10 } }));
  });
});

// ---------- yordamchilar ----------
let pass = 0;
const t = async (name: string, fn: () => Promise<void>) => { await fn(); pass++; console.log("OK  ", name); };
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type J = any;
async function call(token: string | null, method: string, path: string, body?: unknown): Promise<{ status: number; json: J }> {
  const res = await fetch(BASE + path, { method, headers: { ...(body !== undefined && { "content-type": "application/json" }), ...(token && { cookie: `u360_session=${token}` }) }, body: body === undefined ? undefined : JSON.stringify(body) });
  const txt = await res.text(); let json: J; try { json = JSON.parse(txt); } catch { json = txt; }
  return { status: res.status, json };
}
async function upload(token: string, sessionId: string, name: string, content: string | Uint8Array, role = "AUTO"): Promise<{ status: number; json: J }> {
  const fd = new FormData();
  fd.append("file", new Blob([content as BlobPart]), name); fd.append("role", role);
  const res = await fetch(`${BASE}/api/import/${sessionId}/files`, { method: "POST", headers: { cookie: `u360_session=${token}` }, body: fd });
  const txt = await res.text(); let json: J; try { json = JSON.parse(txt); } catch { json = txt; }
  return { status: res.status, json };
}
const as = (token: string | null) => ({ get: (p: string) => call(token, "GET", p), post: (p: string, b?: unknown) => call(token, "POST", p, b ?? {}), patch: (p: string, b: unknown) => call(token, "PATCH", p, b), del: (p: string) => call(token, "DELETE", p) });
const admin = as(ADMIN), user = as(USER), anon = as(null);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function runToEnd(id: string): Promise<J> {
  for (let i = 0; i < 80; i++) {
    const r = await user.post(`/api/import/${id}/advance`);
    assert.equal(r.status, 200, JSON.stringify(r.json));
    if (r.json.finished) return r.json;
    await sleep(Math.min(r.json.wait ?? 0, 3) * 1000 + 100);
  }
  throw new Error("Import 80 qadamda tugamadi");
}

const TEXT = [
  "Pedagogika asoslari bo'yicha sinov testi", "",
  "1. O'zbekiston Respublikasining poytaxti qaysi shahar?", "A) Samarqand", "B) Toshkent", "C) Buxoro", "D) Xiva", "Javob: B", "",
  "2. 12 + 8 nechaga teng?", "A) 18", "B) 20", "C) 22", "D) 24", "Javob: C", "",
  "3. Fotosintez hujayraning qaysi organoidida sodir bo'ladi?", "A) Mitoxondriya", "B) Xloroplast", "C) Ribosoma", "D) Yadro", "",
  "4. Quyidagilardan qaysi biri dars rejasining majburiy qismi hisoblanadi?", "A) Maqsad", "B) Rasm", "C) Musiqa", "D) Hech biri", "",
].join("\n");

const created = { sessions: [] as string[], collections: [] as string[], extra: [] as string[] };

async function main() {
  await new Promise<void>((r) => fake.listen(8098, "127.0.0.1", r));
  const st = await user.get("/api/import/status");
  if (st.status !== 200 || !st.json.storage?.configured) { console.error("Fayl saqlash ulanmagan (SUPABASE_* yoki mahalliy sinov uchun STORAGE_LOCAL_DIR): E2E yuklashni tekshira olmaydi (BLOCKED).", JSON.stringify(st.json)); process.exit(2); }

  await t("kirmagan foydalanuvchi import API'lariga kira olmaydi", async () => {
    assert.equal((await anon.get("/api/import")).status, 401);
    assert.equal((await anon.post("/api/import", { title: "x" })).status, 401);
    assert.equal((await anon.get("/api/personal-tests")).status, 401);
  });

  const sid = (await user.post("/api/import", { title: "E2E import sinovi" })).json.id as string;
  created.sessions.push(sid);

  await t("fayl xavfsizligi: eski format, soxta kengaytma, noma'lum tur, dublikat", async () => {
    const legacy = await upload(USER, sid, "eski.doc", new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1, 0, 0, 0, 0]));
    assert.equal(legacy.status, 400); assert.match(legacy.json.error, /\.docx|konvert|yangi format/i);
    const fakePdf = await upload(USER, sid, "soxta.pdf", "bu pdf emas, oddiy matn");
    assert.equal(fakePdf.status, 400, JSON.stringify(fakePdf.json));
    const exe = await upload(USER, sid, "dastur.exe", new Uint8Array([0x4d, 0x5a, 0x90, 0, 3, 0, 0, 0]));
    assert.equal(exe.status, 400);
    const ok = await upload(USER, sid, "sinov-test.txt", TEXT);
    assert.equal(ok.status, 200, JSON.stringify(ok.json));
    const dup = await upload(USER, sid, "sinov-test-nusxa.txt", TEXT);
    assert.equal(dup.status, 409); assert.equal(dup.json.code, "duplicate");
  });

  await t("egalik: boshqa foydalanuvchi importni ko'ra olmaydi va o'zgartira olmaydi", async () => {
    assert.equal((await admin.get(`/api/import/${sid}`)).status, 404);
    assert.equal((await admin.post(`/api/import/${sid}/start`)).status, 404);
    assert.equal((await admin.get(`/api/import/${sid}/questions`)).status, 404);
  });

  await t("tahlil: savollar ajratiladi, kalit mustaqil tekshiriladi, holatlar to'g'ri", async () => {
    assert.equal((await user.post(`/api/import/${sid}/start`, {})).status, 200);
    const end = await runToEnd(sid);
    assert.ok(["NEEDS_REVIEW", "READY_FOR_USER"].includes(end.status), end.status);
    const s = (await user.get(`/api/import/${sid}`)).json;
    assert.equal(s.counts.total, 4, JSON.stringify(s.counts));
    assert.equal(s.counts.ready, 1, "faqat kalit AI bilan mos kelgan savol «Tayyor»");
    assert.equal(s.counts.conflict, 1, "kalit (C) hisob (B) bilan ziddiyatli");
    assert.equal(s.counts.noAnswer, 1, "kalitsiz va AI bilmagan savol: javobi topilmagan");
    assert.ok(aiCalls.some((c) => c.includes("Solve each question independently")), "soxta AI tekshiruvga chaqirilgan");
    const list = (await user.get(`/api/import/${sid}/questions`)).json;
    assert.deepEqual(list.items.map((q: J) => q.number), [1, 2, 3, 4], "asl tartib saqlangan");
    assert.equal(list.items[0].text, "O'zbekiston Respublikasining poytaxti qaysi shahar?", "savol matni o'zgartirilmagan");
  });

  let qs: J[] = [];
  await t("dalillar paneli: haqiqiy manbalar, ziddiyatda kalit haqiqat deb qabul qilinmaydi", async () => {
    qs = (await user.get(`/api/import/${sid}/questions`)).json.items;
    const conflict = (await user.get(`/api/import/${sid}/questions/${qs[1].id}`)).json;
    assert.equal(conflict.reviewStatus, "CONFLICT");
    assert.deepEqual(conflict.answer.key, ["C"]); assert.deepEqual(conflict.answer.proposed, ["B"]);
    assert.ok(conflict.evidence.some((e: J) => e.type === "COMPUTED"), "hisob dalili bor");
    const none = (await user.get(`/api/import/${sid}/questions/${qs[3].id}`)).json;
    assert.equal(none.reviewStatus, "NO_ANSWER");
    assert.match(none.answer.note ?? "", /Javob tasdiqlanmadi — qo'lda tekshirish kerak\./);
    assert.ok(none.evidence.every((e: J) => e.type !== "WEB"), "internet manbasi o'ylab topilmaydi");
  });

  await t("hech narsa tasdiqlanmagan holda testga saqlab bo'lmaydi", async () => {
    const r = await user.post(`/api/import/${sid}/save`, {});
    assert.equal(r.status, 400); assert.equal(r.json.code, "nothing_to_save");
  });

  await t("o'qituvchi tasdig'i: tayyorlari, o'zi tanlagani va tasdiqlamasdan qo'shilgani; olib tashlash", async () => {
    const bulk = await user.post(`/api/import/${sid}/questions/confirm-ready`);
    assert.equal(bulk.json.confirmed, 1);
    assert.equal((await user.post(`/api/import/${sid}/questions/${qs[1].id}`, { action: "confirm", answer: "B" })).json.basis, "USER_SET");
    assert.equal((await user.post(`/api/import/${sid}/questions/${qs[2].id}`, { action: "confirm", answer: "B", vouch: false })).json.basis, "UNVERIFIED");
    assert.equal((await user.post(`/api/import/${sid}/questions/${qs[3].id}`, { action: "remove" })).status, 200);
    const bad = await user.post(`/api/import/${sid}/questions/${qs[1].id}`, { action: "confirm", answer: "Z" });
    assert.equal(bad.status, 400, "variantda yo'q harf qabul qilinmaydi");
    const edit = await user.patch(`/api/import/${sid}/questions/${qs[3].id}`, { text: "Tahrirlangan savol matni uchun sinov", options: ["Bir", "Ikki"] });
    assert.equal(edit.status, 200);
    const detail = (await user.get(`/api/import/${sid}/questions/${qs[3].id}`)).json;
    assert.equal(detail.original, "Quyidagilardan qaysi biri dars rejasining majburiy qismi hisoblanadi?", "asl matn saqlanadi");
  });

  let col = "";
  await t("shaxsiy testga saqlash: faqat tasdiqlanganlar, javob holatlari to'g'ri", async () => {
    const r = await user.post(`/api/import/${sid}/save`, { title: "E2E shaxsiy test" });
    assert.equal(r.status, 200, JSON.stringify(r.json));
    assert.equal(r.json.added, 3);
    col = r.json.collectionId; created.collections.push(col);
    const again = await user.post(`/api/import/${sid}/save`, { collectionId: col });
    assert.equal(again.json.added, 0, "ikkinchi saqlashda dublikat yaratilmaydi");
    const c = (await user.get(`/api/personal-tests/${col}`)).json;
    assert.equal(c.counts.total, 3);
    assert.deepEqual([c.counts.verified, c.counts.userSet, c.counts.unverified], [1, 1, 1]);
    assert.equal(c.status, "PRIVATE_ACTIVE");
  });

  await t("maxfiylik: shaxsiy savollar boshqa foydalanuvchiga va umumiy bankka ko'rinmaydi", async () => {
    assert.equal((await admin.get(`/api/personal-tests/${col}`)).status, 404);
    const mine = await db.question.findMany({ where: { collectionId: col }, select: { id: true, status: true, ownerId: true, source: true } });
    assert.equal(mine.length, 3);
    assert.ok(mine.every((q) => q.status === "DRAFT" && q.ownerId && q.source === "IMPORT"));
    const bank = await admin.get("/api/admin/qbank?q=" + encodeURIComponent("poytaxti"));
    assert.equal(bank.status, 200);
    assert.ok(!JSON.stringify(bank.json).includes(mine[0].id), "shaxsiy savol admin banki ro'yxatida chiqmaydi");
  });

  await t("diagnostika: javoblar yashirin, tasdiqlanmagan savol ball hisobiga kiritilmaydi", async () => {
    const s = await user.post(`/api/personal-tests/${col}/start`, { mode: "diagnostic" });
    assert.equal(s.status, 200, JSON.stringify(s.json));
    assert.equal(s.json.skippedUnverified, 1);
    const v = (await user.get(`/api/practice/${s.json.id}`)).json;
    assert.equal(v.total, 2); assert.equal(v.policy, "deferred");
    assert.ok(v.items.every((i: J) => i.answer === null), "to'g'ri javob test tugaguncha ko'rinmaydi");
    assert.ok(!JSON.stringify(v).includes("correctOptionId"));
    assert.equal(v.personal.mode, "diagnostic");
    const all = await user.post(`/api/personal-tests/${col}/start`, { mode: "diagnostic", includeUnverified: true });
    assert.equal(all.json.count, 3, "tasdiqlanmaganlar faqat aniq tanlansa qo'shiladi");
    const practice = await user.post(`/api/personal-tests/${col}/start`, { mode: "practice" });
    assert.equal(practice.status, 200); assert.equal(practice.json.count, 3);
  });

  await t("adminga yuborish: huquq tasdig'i majburiy; yuborilgach egasi tahrirlay olmaydi", async () => {
    assert.equal((await user.post(`/api/personal-tests/${col}/submit`, {})).status, 400);
    assert.equal((await user.post(`/api/personal-tests/${col}/submit`, { rightsConfirmed: false })).status, 400);
    const r = await user.post(`/api/personal-tests/${col}/submit`, { rightsConfirmed: true, rightsNote: "O'zim yozganman" });
    assert.equal(r.status, 200, JSON.stringify(r.json));
    const qid = (await db.question.findFirst({ where: { collectionId: col }, select: { id: true } }))!.id;
    assert.equal((await user.patch(`/api/personal-tests/${col}/questions/${qid}`, { text: "o'zgartirish" })).status, 409);
    assert.equal((await user.post(`/api/personal-tests/${col}/submit`, { rightsConfirmed: true })).status, 409, "ikki marta yuborib bo'lmaydi");
    assert.equal((await user.get("/api/admin/import-submissions")).status, 403, "oddiy foydalanuvchi admin ro'yxatini ko'ra olmaydi");
  });

  await t("admin tasdig'i: tasdiqlanmagan javob o'tmaydi, mavzu kerak, shaxsiy nusxa saqlanadi", async () => {
    const list = (await admin.get("/api/admin/import-submissions?status=SUBMITTED")).json;
    const sub = list.items.find((x: J) => x.collection.id === col);
    assert.ok(sub, "yuborilgan test admin ro'yxatida");
    const detail = (await admin.get(`/api/admin/import-submissions/${sub.id}`)).json;
    assert.equal(detail.rightsConfirmed, true); assert.equal(detail.questions.length, 3);
    assert.ok(detail.questions.some((q: J) => q.answerStatus === "UNVERIFIED"));
    let r = await admin.post(`/api/admin/import-submissions/${sub.id}`, { action: "approve" });
    if (r.status === 400 && r.json.code === "topic_required") {
      const topic = await db.topic.findFirst({ where: { subject: { slug: { not: "shaxsiy-testlar" } } }, select: { id: true } });
      assert.ok(topic, "bazada kamida bitta mavzu bo'lishi kerak");
      r = await admin.post(`/api/admin/import-submissions/${sub.id}`, { action: "approve", topicId: topic.id });
    }
    assert.equal(r.status, 200, JSON.stringify(r.json));
    assert.equal(r.json.published, 2, "tasdiqlanmagan javobli savol standart bo'yicha rad etiladi");
    assert.equal(r.json.rejected, 1);
    const mine = await db.question.findMany({ where: { collectionId: col }, select: { id: true, status: true } });
    assert.ok(mine.every((q) => q.status === "DRAFT"), "shaxsiy nusxa o'zgarmaydi");
    const copies = await db.question.findMany({ where: { collectionId: null, importSourceId: { in: mine.map((q) => q.id) } }, select: { id: true, status: true, ownerId: true } });
    copies.forEach((c) => created.extra.push(c.id));
    assert.equal(copies.length, 2); assert.ok(copies.every((c) => c.status === "APPROVED" && c.ownerId === null));
    assert.equal((await admin.post(`/api/admin/import-submissions/${sub.id}`, { action: "approve" })).status, 409, "qayta tasdiqlab bo'lmaydi");
    assert.equal((await user.get(`/api/personal-tests/${col}`)).json.status, "PUBLIC_APPROVED");
  });

  await t("import API: o'chirilgan importdan keyin fayllar va savollar yo'qoladi, shaxsiy test qoladi", async () => {
    assert.equal((await user.del(`/api/import/${sid}`)).status, 200);
    created.sessions.splice(created.sessions.indexOf(sid), 1);
    assert.equal((await user.get(`/api/import/${sid}`)).status, 404);
    assert.equal((await user.get(`/api/personal-tests/${col}`)).status, 200);
  });

  console.log(`\n${pass} ta sinov o'tdi.`);
}

async function cleanup() {
  try {
    for (const id of created.extra) { await db.answerOption.deleteMany({ where: { questionId: id } }); await db.question.deleteMany({ where: { id } }); }
    for (const c of created.collections) {
      const ids = (await db.question.findMany({ where: { collectionId: c }, select: { id: true } })).map((q) => q.id);
      await db.userAnswer.deleteMany({ where: { questionId: { in: ids } } });
      await db.errorCard.deleteMany({ where: { questionId: { in: ids } } });
      await db.questionReviewSubmission.deleteMany({ where: { collectionId: c } });
      await db.answerOption.deleteMany({ where: { questionId: { in: ids } } });
      await db.question.deleteMany({ where: { id: { in: ids } } });
      await db.personalQuestionCollection.deleteMany({ where: { id: c } });
    }
    for (const s of created.sessions) await user.del(`/api/import/${s}`);
    // Adminlarga yuborilgan «Foydalanuvchi test yubordi» bildirishnomalari (haqiqiy adminlarda ham qolmasligi uchun).
    await db.notification.deleteMany({ where: { kind: "import", text: { contains: "E2E shaxsiy test" } } });
  } catch (e) { console.error("Tozalashda xatolik:", (e as Error).message); }
}

main()
  .catch((e) => { console.error("\nSINOV YIQILDI:", e); process.exitCode = 1; })
  .finally(async () => { await cleanup(); fake.close(); await db.$disconnect(); });
