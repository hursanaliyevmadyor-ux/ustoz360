/**
 * Telegram bot E2E: ishga tushirilgan sayt va HAQIQIY baza bilan, lekin Telegram o'rniga soxta server (hech kimga xabar ketmaydi).
 *
 * 1) Bazaga bot jadvali qo'llangan bo'lsin:  npx tsx --env-file=.env.local prisma/apply-sql.ts prisma/supabase-update-bot-state.sql
 * 2) Saytni soxta Telegram bilan ishga tushiring (alohida terminal):
 *      $env:TELEGRAM_BOT_TOKEN="1:e2e"; $env:TELEGRAM_BOT_USERNAME="E2E_bot"; $env:TELEGRAM_API_BASE="http://127.0.0.1:8099"; $env:CRON_SECRET="e2e-cron-secret"; npm run dev
 * 3) Ishga tushirish:  npm run test:e2e:bot
 * Sinov foydalanuvchilari (example.invalid) ochiladi va oxirida o'chiriladi.
 */
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { createServer } from "node:http";
import { PrismaClient } from "@prisma/client";
import { signInitData } from "../src/server/bot/webapp";

const BASE = process.env.BASE_URL ?? "http://127.0.0.1:3000";
const PORT = 8099;
const AUTH = process.env.AUTH_SECRET;
if (!AUTH || AUTH.length < 32) { console.error("AUTH_SECRET kerak (.env.local)."); process.exit(1); }
const SECRET = createHmac("sha256", AUTH).update("telegram-webhook").digest("hex").slice(0, 48);
const CRON = "e2e-cron-secret";
const db = new PrismaClient();

// ---------- soxta Telegram ----------
type Call = { method: string; body: Record<string, any> };
const calls: Call[] = [];
const problems: string[] = [];
let mid = 1000;

/** Telegram HTML rejimining soddalashtirilgan tekshiruvi: ruxsat etilgan teglar, juftlik, '&' va '<' qochirilgan bo'lishi kerak. */
function htmlProblem(s: string): string | null {
  const stack: string[] = [];
  const re = /<\/?([a-z]+)[^>]*>|&(?!(?:amp|lt|gt|quot);)|<(?![a-z/])/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s))) {
    if (m[0].startsWith("&")) return `qochirilmagan &: ...${s.slice(Math.max(0, m.index - 15), m.index + 15)}...`;
    if (m[0] === "<") return `qochirilmagan <: ...${s.slice(Math.max(0, m.index - 15), m.index + 15)}...`;
    const tag = m[1].toLowerCase();
    if (!["b", "i", "u", "s", "code", "pre", "a"].includes(tag)) return `ruxsat etilmagan teg <${tag}>`;
    if (m[0].startsWith("</")) { if (stack.pop() !== tag) return `teg juftligi buzilgan </${tag}>`; } else stack.push(tag);
  }
  return stack.length ? `yopilmagan teg <${stack.at(-1)}>` : null;
}

const fake = createServer((req, res) => {
  let raw = "";
  req.on("data", (c) => (raw += c));
  req.on("end", () => {
    const method = String(req.url).split("/").pop()!;
    const body = raw ? JSON.parse(raw) : {};
    calls.push({ method, body });
    let out: Record<string, unknown> = { ok: true, result: { message_id: ++mid } };
    if (method === "sendMessage" || method === "editMessageText") {
      if (String(body.text ?? "").length > 4096) problems.push(`${method}: 4096 belgidan uzun`);
      for (const row of body.reply_markup?.inline_keyboard ?? []) for (const k of row) if (k.callback_data && Buffer.byteLength(k.callback_data) > 64) problems.push(`callback_data uzun: ${k.callback_data}`);
      if (body.parse_mode === "HTML") {
        const p = htmlProblem(String(body.text));
        if (p) { problems.push(`HTML xato: ${p}`); out = { ok: false, error_code: 400, description: "Bad Request: can't parse entities" }; }
      }
    }
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify(out));
  });
});

// ---------- yordamchilar ----------
let pass = 0;
const t = async (name: string, fn: () => Promise<void>) => { const before = problems.length; await fn(); assert.deepEqual(problems.slice(before), [], "Telegram talablari buzilgan"); pass++; console.log("OK  ", name); };
let upd = 5_000_000 + Math.floor(Math.random() * 1e6);

async function post(update: unknown, secret = SECRET) {
  calls.length = 0;
  const r = await fetch(`${BASE}/api/telegram/webhook`, { method: "POST", headers: { "content-type": "application/json", "x-telegram-bot-api-secret-token": secret }, body: JSON.stringify(update) });
  return r.status;
}
const bot = (tg: number) => ({
  msg: async (text: string, extra: Record<string, unknown> = {}) => { assert.equal(await post({ update_id: ++upd, message: { message_id: ++mid, chat: { id: tg, type: "private" }, from: { id: tg, first_name: "Sinov" }, text, ...extra } }), 200); },
  press: async (data: string) => { assert.equal(await post({ update_id: ++upd, callback_query: { id: `c${upd}`, from: { id: tg, first_name: "Sinov" }, message: { message_id: 77, chat: { id: tg, type: "private" } }, data } }), 200); },
});
const shown = () => calls.filter((c) => c.method === "sendMessage" || c.method === "editMessageText").at(-1)?.body ?? {};
const text = () => String(shown().text ?? "");
const allText = () => calls.filter((c) => c.method === "sendMessage" || c.method === "editMessageText").map((c) => String(c.body.text)).join("\n---\n");
const cbs = (b: Record<string, any> = shown()) => ((b.reply_markup?.inline_keyboard ?? []) as { callback_data?: string }[][]).flat().map((k) => k.callback_data).filter(Boolean) as string[];
const labels = (b: Record<string, any> = shown()) => ((b.reply_markup?.inline_keyboard ?? []) as { text: string }[][]).flat().map((k) => k.text);
const alertText = () => String(calls.filter((c) => c.method === "answerCallbackQuery").at(-1)?.body.text ?? "");
const noCrash = () => assert.ok(!/Xatolik yuz berdi|Ichki xatolik/.test(allText()), "kutilmagan xato chiqdi: " + allText().slice(0, 300));

const TG = 91_000_001, TG_NEW = 91_000_002;
const EMAILS = ["bot-sinov@example.invalid", "bot-sinov-yangi@example.invalid"];

async function cleanup() {
  for (const tgId of [String(TG), String(TG_NEW)]) {
    const u = await db.user.findUnique({ where: { telegramId: tgId } });
    if (!u) continue;
    await db.questionReport.deleteMany({ where: { userId: u.id } });
    await db.auditLog.deleteMany({ where: { userId: u.id } });
    await db.user.delete({ where: { id: u.id } });
  }
  await db.user.deleteMany({ where: { email: { in: EMAILS } } });
  // Eslatma sinovi boshqa foydalanuvchilarga ham "yuborilgan" deb belgilangan bo'lishi mumkin (xabar soxta serverga ketgan): bugungi eslatma ular uchun tiklanadi.
  await db.botState.updateMany({ data: { remindedOn: null } });
}

async function main() {
  await new Promise<void>((r) => fake.listen(PORT, "127.0.0.1", r));
  await cleanup();
  const today = new Date(Date.now() + 5 * 3_600_000).toISOString().slice(0, 10);
  const me = await db.user.create({ data: { email: EMAILS[0], name: "Bot Sinov", telegramId: String(TG), phone: "+998900000091", emailVerifiedAt: new Date(), roles: { create: { role: "TEACHER" } }, profile: { create: { onboardedAt: new Date(), region: "Toshkent shahri", district: "Yunusobod", targetExam: "ATTESTATSIYA", examDate: new Date(Date.now() + 7 * 86_400_000), dailyMinutes: 60 } } } });
  await db.planItem.create({ data: { userId: me.id, date: new Date(today + "T00:00:00Z"), title: "E2E bugungi band", kind: "TASK", source: "MANUAL", position: 0 } });
  const u = bot(TG);

  await t("himoya: noto'g'ri maxfiy kalit 401, ro'yxatdan o'tmagan foydalanuvchi tugmasi ogohlantirish oladi", async () => {
    assert.equal(await post({ update_id: ++upd, message: { chat: { id: 1, type: "private" }, from: { id: 1 }, text: "/menyu" } }, "noto'g'ri"), 401);
    await bot(777_000_111).press("t.q");
    assert.match(alertText(), /\/start/);
  });

  await t("bosh sahifa va barcha bo'limlar xatosiz ochiladi, har birida 'Menyu' tugmasi bor", async () => {
    await u.msg("/menyu");
    assert.match(text(), /Bosh sahifa/); assert.match(text(), /E2E bugungi band/); assert.match(text(), /Imtihongacha/);
    for (const s of ["📚 Testlar", "🧭 TOIFA reja", "👩‍🏫 Sinflarim", "📝 DARSYOR", "📖 Kutubxona", "🛒 Kurslar", "📅 Seminarlar", "👤 Profil"]) {
      await u.msg(s); noCrash(); assert.ok(cbs().includes("h"), `${s}: 'Menyu' tugmasi yo'q`);
    }
    await u.msg("/yordam"); assert.match(text(), /Yordam/);
  });

  await t("bosh sahifada reja bandi bosilsa bajariladi va bazaga yoziladi", async () => {
    await u.msg("🏠 Bosh sahifa");
    const btn = cbs().find((c) => c.startsWith("h.pt."))!; assert.ok(btn);
    await u.press(btn);
    assert.match(text(), /✅ E2E bugungi band/);
    assert.ok((await db.planItem.findFirst({ where: { userId: me.id, title: "E2E bugungi band" } }))?.doneAt);
    await u.press(`h.pt.${btn.split(".")[2]}.0`);
    assert.equal((await db.planItem.findFirst({ where: { userId: me.id, title: "E2E bugungi band" } }))?.doneAt, null);
  });

  await t("testlar: tezkor mashq boshidan oxirigacha (javoblar, natija, bilim xaritasi), ma'lumot bazaga yoziladi", async () => {
    await u.msg("📚 Testlar");
    await u.press("t.q");
    assert.match(text(), /Savol 1\//);
    let answered = 0;
    for (let i = 0; i < 8 && cbs().some((c) => c.startsWith("t.a.")); i++) {
      const a = cbs().find((c) => c.startsWith("t.a."))!;
      await u.press(a); answered++;
      assert.match(text(), /To'g'ri|Noto'g'ri/);
      const next = cbs().find((c) => c.startsWith("t.n.") || c.startsWith("t.f."));
      assert.ok(next, "keyingi/natija tugmasi yo'q");
      await u.press(next);
      if (/Natija:/.test(text())) break;
    }
    assert.ok(answered >= 1);
    assert.match(text(), /Natija: \d+\/\d+/);
    const s = await db.testSession.findFirst({ where: { userId: me.id }, orderBy: { startedAt: "desc" } });
    assert.equal(s?.status, "SUBMITTED");
    await u.press("t.r"); noCrash(); assert.match(text(), /Natijalarim/);
    await u.press("t.sub"); noCrash();
    const top = cbs().find((c) => c.startsWith("t.top."));
    if (top) { await u.press(top); noCrash(); }
  });

  await t("TOIFA: band qo'shish, belgilash, o'chirish; cheklist; kalendar; rasmiy ma'lumot; maqsad", async () => {
    await u.msg("🧭 TOIFA reja"); assert.match(text(), /Maqsad: <b>Attestatsiya/);
    await u.press("p.add"); await u.msg("E2E reja bandi"); assert.match(text(), /Qaysi kunga/);
    await u.press("p.ad.1");
    const item = await db.planItem.findFirst({ where: { userId: me.id, title: "E2E reja bandi" } });
    assert.ok(item); assert.match(text(), /E2E reja bandi/);
    await u.press(`p.t.${item!.id}.1`);
    assert.ok((await db.planItem.findUnique({ where: { id: item!.id } }))?.doneAt);
    await u.press("p.dl"); await u.press(`p.dx.${item!.id}`);
    assert.equal(await db.planItem.count({ where: { id: item!.id } }), 0);
    await u.press("p.ck"); await u.press("p.cseed"); assert.ok(labels().some((l) => /Pasport/.test(l)), "tayyor cheklist bandlari tugma sifatida chiqishi kerak");
    const ck = cbs().find((c) => c.startsWith("p.ct."))!; await u.press(ck); noCrash();
    await u.press("p.cadd"); await u.msg("E2E hujjat"); assert.ok(await db.checklistItem.findFirst({ where: { userId: me.id, label: "E2E hujjat" } }));
    await u.press("p.cal"); noCrash(); await u.press("p.of"); noCrash();
    await u.press("p.gen"); noCrash();
    await u.press("p.goal"); await u.press("p.ge.M"); await u.msg(`15.03.${new Date().getFullYear() + 2}`); await u.press("p.gm.90");
    const prof = await db.profile.findUnique({ where: { userId: me.id } });
    assert.equal(prof?.targetExam, "MILLIY_SERTIFIKAT"); assert.equal(prof?.dailyMinutes, 90);
  });

  await t("SINF: sinf, o'quvchilar, baholash, ball kiritish, tahlil, o'chirish", async () => {
    await u.msg("👩‍🏫 Sinflarim"); await u.press("s.new"); await u.msg("E2E-7A"); await u.msg("Matematika");
    const cls = await db.classroom.findFirst({ where: { userId: me.id, name: "E2E-7A" } }); assert.ok(cls);
    await u.press(`s.sa.${cls!.id}`); await u.msg("Aziz Karimov Valiyevich"); assert.match(text(), /Taxallus|taxallus|Ism/);
    await u.msg("O-1, O-2, O-3, O-4, O-5, O-6");
    assert.equal(await db.student.count({ where: { classId: cls!.id } }), 6);
    await u.press(`s.as.${cls!.id}`); await u.msg("Kasrlar nazorati"); await u.msg("Oddiy kasrlar"); await u.press("s.ak.B"); await u.press("s.am.20");
    const as = await db.assessment.findFirst({ where: { classId: cls!.id } }); assert.ok(as); assert.equal(as!.maxScore, 20);
    await u.press(`s.sq.${cls!.id}.${as!.id}`); assert.match(text(), /1\. O-1/);
    await u.msg("1 18\n2 15,5\n3 9\n4 12\n5 20\n6 7\nZ 5");
    assert.match(text(), /Saqlandi: <b>6<\/b>/); assert.match(text(), /Z 5/);
    assert.equal(await db.assessmentScore.count({ where: { assessmentId: as!.id } }), 6);
    await u.msg("1 25"); // endi holat bo'sh: ball sifatida qabul qilinmaydi
    assert.match(text(), /Tushunmadim/);
    await u.press(`s.an.${cls!.id}`); assert.match(text(), /tahlil/); assert.match(text(), /Sinf o'rtachasi/);
    await u.press(`s.st.${cls!.id}`); noCrash(); await u.press(`s.c.${cls!.id}`); noCrash();
    await u.press(`s.del.${cls!.id}`); await u.press(`s.dy.${cls!.id}`);
    assert.equal(await db.classroom.count({ where: { id: cls!.id } }), 0);
  });

  await t("DARSYOR: dars ishlanmasi bosqichlari; AI ulangan bo'lsa hujjat saqlanadi, ulanmagan bo'lsa tushunarli xabar", async () => {
    await u.msg("📝 DARSYOR"); await u.press("d.l"); await u.msg("Matematika"); await u.press("d.lg.6"); await u.msg("Oddiy kasrlar"); await u.press("d.ld.45");
    const t1 = allText();
    assert.ok(/qoralama|AI xizmati|AI|limit|band/.test(t1), "AI natijasi yoki halol xabar bo'lishi kerak: " + t1.slice(0, 200));
    await u.press("d.docs.0"); noCrash();
  });

  await t("AI yordamchi: tugma bilan yoqiladi; yoqilmaguncha matn AI'ga ketmaydi", async () => {
    await u.msg("oddiy gap"); assert.match(text(), /Tushunmadim/);
    await u.msg("🤖 AI yordamchi");
    const aiOn = /Savolingizni shu yerga yozing/.test(text());
    if (aiOn) { assert.equal((await db.botState.findUnique({ where: { userId: me.id } }))?.mode, "ai"); await u.msg("📅 Seminarlar"); assert.equal((await db.botState.findUnique({ where: { userId: me.id } }))?.mode, "idle"); }
    else assert.match(text(), /ulanmagan/);
  });

  await t("seminarlar, kurslar (katalog, tariflar, buyurtmalar), kutubxona (ro'yxat, qidiruv) xatosiz", async () => {
    await u.msg("📅 Seminarlar"); noCrash();
    const sem = cbs().find((c) => c.startsWith("n.o.")); if (sem) { await u.press(sem); noCrash(); }
    await u.msg("🛒 Kurslar"); await u.press("m.k.0"); noCrash();
    const c = cbs().find((x) => x.startsWith("m.c.")); if (c) { await u.press(c); noCrash(); }
    await u.press("m.pl"); assert.match(text(), /PRO/); await u.press("m.or"); noCrash(); await u.press("m.my"); noCrash();
    await u.msg("📖 Kutubxona"); await u.press("l.l.a.0"); noCrash(); await u.press("l.l.m.0"); noCrash(); await u.press("l.l.f.0"); noCrash();
    await u.press("l.s"); await u.msg("metod"); noCrash();
  });

  await t("profil: eslatmani o'chirish va yoqish bazaga yoziladi", async () => {
    await u.msg("👤 Profil"); assert.match(text(), /Profil/);
    await u.press("u.rm");
    assert.equal((await db.botState.findUnique({ where: { userId: me.id } }))?.remind, false); assert.match(text(), /o'chirilgan/);
    await u.press("u.rm");
    assert.equal((await db.botState.findUnique({ where: { userId: me.id } }))?.remind, true);
  });

  await t("kunlik eslatma: begona so'rov rad etiladi, cron bir kunda bir marta yuboradi, o'chirilgan eslatma yuborilmaydi", async () => {
    const anon = await fetch(`${BASE}/api/cron/bot-reminders`); assert.equal(anon.status, 401);
    assert.equal((await fetch(`${BASE}/api/cron/bot-reminders`, { headers: { authorization: "Bearer noto'g'ri" } })).status, 401);
    await db.botState.update({ where: { userId: me.id }, data: { remindedOn: null } });
    calls.length = 0;
    const r1 = await (await fetch(`${BASE}/api/cron/bot-reminders`, { headers: { authorization: `Bearer ${CRON}` } })).json();
    assert.ok(r1.sent >= 1, JSON.stringify(r1));
    const mine = calls.filter((c) => c.method === "sendMessage" && String(c.body.chat_id) === String(TG));
    assert.equal(mine.length, 1); assert.match(String(mine[0].body.text), /Xayrli tong/); assert.match(String(mine[0].body.text), /E2E bugungi band/);
    calls.length = 0;
    await fetch(`${BASE}/api/cron/bot-reminders`, { headers: { authorization: `Bearer ${CRON}` } });
    assert.equal(calls.filter((c) => c.method === "sendMessage" && String(c.body.chat_id) === String(TG)).length, 0, "ikkinchi marta yuborilmasligi kerak");
    await db.botState.update({ where: { userId: me.id }, data: { remindedOn: null, remind: false } });
    calls.length = 0;
    await fetch(`${BASE}/api/cron/bot-reminders`, { headers: { authorization: `Bearer ${CRON}` } });
    assert.equal(calls.filter((c) => c.method === "sendMessage" && String(c.body.chat_id) === String(TG)).length, 0, "o'chirilgan eslatma yuborilmasligi kerak");
  });

  await t("yangi foydalanuvchi: /start, telefon, ism-viloyat-tuman, keyin menyu ishlaydi", async () => {
    const n = bot(TG_NEW);
    await n.msg("/start"); assert.match(text(), /Telefon raqamni yuborish/);
    await n.msg("📚 Testlar"); assert.match(text(), /Telefon raqamni yuborish|Boshlash/); // raqamsiz bo'limlarga kira olmaydi
    await n.msg("", { text: undefined, contact: { phone_number: "+998 90 000 00 92", user_id: TG_NEW } });
    assert.match(allText(), /Raqamingiz qabul qilindi/); assert.match(allText(), /Ism va familiyangizni yozing/);
    await n.msg("📚 Testlar"); assert.match(text(), /Ism va familiyangizni yozing/); // yakunlamaguncha yopiq
    await n.msg("Sinov Yangi"); await n.press("o.r.2"); assert.match(text(), /Andijon/); await n.msg("Asaka tumani");
    assert.match(text(), /Tayyor/);
    const nu = await db.user.findUnique({ where: { telegramId: String(TG_NEW) }, include: { profile: true } });
    assert.equal(nu?.phone, "+998900000092"); assert.equal(nu?.name, "Sinov Yangi"); assert.equal(nu?.profile?.region, "Andijon viloyati"); assert.ok(nu?.profile?.onboardedAt);
    await n.msg("🏠 Bosh sahifa"); assert.match(text(), /Bosh sahifa/);
  });

  await t("Mini App: initData tekshiruvi, avtomatik kirish, boshqa akkauntga almashish, ro'yxatdan o'tmaganga rad", async () => {
    const TOKEN = "1:e2e"; // saytga berilgan TELEGRAM_BOT_TOKEN bilan bir xil
    const init = (id: number, authDateMs = Date.now(), tokenUsed = TOKEN) => signInitData({ auth_date: String(Math.floor(authDateMs / 1000)), query_id: "AAE2E", user: JSON.stringify({ id, first_name: "Sinov" }) }, tokenUsed);
    const auth = async (initData: string, cookie?: string) => {
      const r = await fetch(`${BASE}/api/auth/telegram/webapp`, { method: "POST", headers: { "content-type": "application/json", ...(cookie && { cookie }) }, body: JSON.stringify({ initData }) });
      const setCookie = (r.headers.getSetCookie?.() ?? []).find((c) => c.startsWith("u360_session="))?.split(";")[0];
      return { status: r.status, json: (await r.json()) as any, cookie: setCookie };
    };
    const me = async (cookie: string) => (await (await fetch(`${BASE}/api/me`, { headers: { cookie } })).json()) as any;

    assert.equal((await auth("hash=" + "0".repeat(64) + "&auth_date=1")).status, 401);
    assert.equal((await auth(init(TG, Date.now(), "999:boshqa-bot"))).status, 401, "boshqa bot imzosi rad etilishi kerak");
    assert.equal((await auth(init(TG, Date.now() - 26 * 3_600_000))).status, 401, "eskirgan ma'lumot rad etilishi kerak");
    const stranger = await auth(init(91_000_099));
    assert.equal(stranger.status, 404); assert.equal(stranger.json.code, "telegram_not_registered");

    const first = await auth(init(TG));
    assert.equal(first.status, 200); assert.equal(first.json.already, false); assert.ok(first.cookie, "sessiya cookie'si berilishi kerak");
    assert.equal((await me(first.cookie!)).user?.name, "Bot Sinov");
    const again = await auth(init(TG), first.cookie);
    assert.equal(again.status, 200); assert.equal(again.json.already, true); assert.equal(again.cookie, undefined, "ikkinchi marta yangi sessiya ochilmasligi kerak");

    // Shu qurilmada boshqa odamning sessiyasi qolgan bo'lsa, Telegram egasiga almashtiriladi
    const other = await auth(init(TG_NEW), first.cookie);
    assert.equal(other.status, 200); assert.equal(other.json.already, false); assert.ok(other.cookie && other.cookie !== first.cookie);
    assert.equal((await me(other.cookie!)).user?.name, "Sinov Yangi");
    assert.equal(await db.authSession.count({ where: { user: { telegramId: String(TG) } } }), 1);
  });

  console.log(`\n${pass} ta blok o'tdi.`);
}

main()
  .catch((e) => { console.error("\nXATO:", e.message ?? e); if (problems.length) console.error("Telegram muammolari:", problems); process.exitCode = 1; })
  .finally(async () => { await cleanup().catch((e) => console.error("tozalash xatosi", e.message)); await db.$disconnect(); fake.close(); });
