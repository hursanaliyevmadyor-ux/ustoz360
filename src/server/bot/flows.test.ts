import { beforeEach, describe, expect, it, vi } from "vitest";

process.env.AUTH_SECRET = "x".repeat(40);
process.env.TELEGRAM_BOT_TOKEN = "123:ABC"; process.env.TELEGRAM_BOT_USERNAME = "Test_bot";

type St = { mode: string; data: unknown; remind: boolean; updatedAt: Date };
const h = vi.hoisted(() => {
  const state: { cur: St | null } = { cur: null };
  const fn = () => vi.fn();
  return {
    state,
    db: {
      botState: {
        findUnique: vi.fn(async () => state.cur),
        upsert: vi.fn(async (a: { create: Partial<St>; update: Partial<St> }) => { state.cur = { mode: "idle", data: null, remind: true, ...(state.cur ?? {}), ...(state.cur ? a.update : a.create), updatedAt: new Date() } as St; return state.cur; }),
      },
      user: { findUnique: fn(), update: fn() },
      profile: { upsert: fn() },
      auditLog: { create: fn() },
      userRole: { findMany: fn() },
      aiChat: { findFirst: fn(), update: fn() },
      subscription: { findFirst: fn() }, courseAccess: { count: fn() }, payment: { count: fn() },
    },
    practice: { homeData: fn(), startPractice: fn(), practiceView: fn(), submitAnswer: fn(), finishPractice: fn(), practiceResult: fn(), giveHint: fn(), errorsProgress: fn(), topicsData: fn(), knowledgeMap: fn(), practiceHistory: fn() },
    toifa: { toifaState: fn(), addPlanItem: fn(), patchPlanItem: fn(), deletePlanItem: fn(), generatePlan: fn(), addChecklist: fn(), seedChecklist: fn(), patchChecklist: fn(), deleteChecklist: fn() },
    sinf: { listClasses: fn(), createClass: fn(), classDetail: fn(), addStudents: fn(), saveAssessment: fn(), saveScores: fn(), removeStudent: fn(), deleteClass: fn() },
    gen: { generateLesson: fn(), generateTasks: fn() },
    docs: { saveDoc: fn(), listDocs: fn(), getDoc: fn(), deleteDoc: fn() },
    market: { catalog: fn() },
    pay: { createOrder: fn(), myPurchases: fn(), cancelPayment: fn() },
    digest: fn(), settings: { getSetting: fn() },
    ai: { freeConfigured: fn(), freeUsageToday: fn(), runFreeAi: fn() }, chats: { saveExchange: fn() },
    lib: { listLibrary: fn(), getLibraryDoc: fn(), toggleFavorite: fn(), askDoc: fn(), downloadUrl: fn(), requestPublic: fn(), deleteDoc: fn(), uploadDoc: fn(), storageState: fn() },
    ent: { getEntitlements: fn() },
    seminars: { listPublicSeminars: fn() },
  };
});
vi.mock("../db", () => ({ db: h.db }));
vi.mock("../practice", () => h.practice);
vi.mock("../toifa", () => h.toifa);
vi.mock("../sinf", () => h.sinf);
vi.mock("../ai/generate", async (orig) => ({ ...(await orig<typeof import("../ai/generate")>()), ...h.gen }));
vi.mock("../docs", () => h.docs);
vi.mock("../market", () => h.market);
vi.mock("../payments", () => h.pay);
vi.mock("./digest", () => ({ digest: h.digest }));
vi.mock("../settings", () => h.settings);
vi.mock("../ai/gateway", async (orig) => ({ ...(await orig<typeof import("../ai/gateway")>()), ...h.ai }));
vi.mock("../ai/chats", () => h.chats);
vi.mock("../library", async (orig) => ({ ...(await orig<typeof import("../library")>()), ...h.lib }));
vi.mock("../entitlements", async (orig) => ({ ...(await orig<typeof import("../entitlements")>()), ...h.ent }));
vi.mock("../admin", () => h.seminars);

import { routeCallback, routeMessage, type BotUser } from "./router";
import { ApiError } from "../auth";
import { uzToday, addDays } from "../planlogic";

const calls: { method: string; body: Record<string, any> }[] = [];
const ORIGIN = "https://site.example";
const USER: BotUser = { id: "u1", name: "Aziza Karimova", onboarded: true };
let msgNo = 100;

const out = (m: string) => calls.filter((c) => c.method === m);
const lastEdit = () => out("editMessageText").at(-1)?.body;
const lastSend = () => out("sendMessage").at(-1)?.body;
/** Eng oxirgi ko'rsatilgan ekran: yuborilgan yoki tahrirlangan xabardan qaysi biri oxirida bo'lsa. */
const lastShown = () => calls.filter((c) => c.method === "sendMessage" || c.method === "editMessageText").at(-1)?.body;
const lastText = () => String(lastShown()?.text ?? "");
const buttons = (b?: Record<string, any>) => ((b?.reply_markup?.inline_keyboard ?? []) as { text: string; callback_data?: string; url?: string }[][]).flat();
const cbs = (b?: Record<string, any>) => buttons(b).map((x) => x.callback_data).filter(Boolean) as string[];
const allText = () => calls.filter((c) => c.method === "sendMessage" || c.method === "editMessageText").map((c) => String(c.body.text)).join("\n---\n");

const press = (data: string, user: BotUser = USER) => routeCallback({ id: "cb" + ++msgNo, from: { id: 5 }, message: { message_id: 500, chat: { id: 77, type: "private" } }, data }, user, ORIGIN);
const say = (text: string, user: BotUser = USER, extra: Record<string, unknown> = {}) => routeMessage({ chat: { id: 77, type: "private" }, from: { id: 5 }, text, ...extra }, user, ORIGIN);

beforeEach(() => {
  vi.clearAllMocks(); calls.length = 0; h.state.cur = null;
  vi.stubGlobal("fetch", vi.fn(async (url: string, init: { body: string }) => {
    calls.push({ method: String(url).split("/").pop()!, body: JSON.parse(init.body) });
    return new Response(JSON.stringify({ ok: true, result: { message_id: ++msgNo } }), { status: 200 });
  }));
  h.db.botState.findUnique.mockImplementation(async () => h.state.cur);
  h.ai.freeConfigured.mockReturnValue(true);
  h.lib.storageState.mockReturnValue({ configured: true, note: null });
  h.ai.freeUsageToday.mockResolvedValue({ used: 3, limit: 50, remaining: 47 });
  h.digest.mockResolvedValue({ today: uzToday(), tomorrow: addDays(uzToday(), 1), plan: [{ id: "pi1", title: "Test yechish", done: false }], planFuture: 0, dueErrors: 2, resume: null, seminars: [], daysLeft: 20, targetExam: null, planName: "FREE", announcements: [] });
});

describe("menyu va navigatsiya", () => {
  it("menyu tugmasi bo'limni yangi xabar bilan ochadi, tugmalar bilan", async () => {
    h.practice.homeData.mockResolvedValue({ active: null, errorsOpen: 2, errorsDue: 2, approved: 40, history: [] });
    await say("📚 Testlar");
    expect(lastText()).toContain("Testlar");
    expect(cbs(lastSend())).toEqual(expect.arrayContaining(["t.q", "t.sub", "t.e", "t.r", "h"]));
  });

  it("/menyu va /bosh bosh sahifani ochadi: bugungi reja va davom tugmalari", async () => {
    await say("/menyu");
    expect(lastText()).toContain("Bosh sahifa");
    expect(lastText()).toContain("Test yechish");
    expect(lastText()).toContain("Imtihongacha");
    expect(cbs(lastSend())).toContain("h.pt.pi1.1");
  });

  it("har bir bo'lim ekranida 'Menyu' tugmasi bor (foydalanuvchi adashmaydi)", async () => {
    h.practice.homeData.mockResolvedValue({ active: null, errorsOpen: 0, errorsDue: 0, approved: 10, history: [] });
    h.sinf.listClasses.mockResolvedValue({ classes: [] });
    h.toifa.toifaState.mockResolvedValue({ today: uzToday(), goal: { targetExam: null, examDate: null, dailyMinutes: null, daysLeft: null }, roadmap: [], plan: [], checklist: [], official: [], seminars: [] });
    h.docs.listDocs.mockResolvedValue({ docs: [] });
    h.seminars.listPublicSeminars.mockResolvedValue({ seminars: [] });
    h.pay.myPurchases.mockResolvedValue({ payments: [], courses: [] });
    for (const t of ["📚 Testlar", "🧭 TOIFA reja", "👩‍🏫 Sinflarim", "📝 DARSYOR", "🛒 Kurslar", "📅 Seminarlar", "📖 Kutubxona"]) {
      calls.length = 0;
      await say(t);
      expect(cbs(lastSend()), t).toContain("h");
    }
  });

  it("menyu bosilsa kutilayotgan matn amali bekor bo'ladi", async () => {
    await press("p.add");
    expect(h.state.cur?.mode).toBe("p.title");
    h.sinf.listClasses.mockResolvedValue({ classes: [] });
    await say("👩‍🏫 Sinflarim");
    expect(h.state.cur?.mode).toBe("idle");
  });

  it("noma'lum tugma bosh sahifaga olib boradi, 'x' hech narsa qilmaydi, har doim callback javob oladi", async () => {
    await press("zzz.q");
    expect(lastText()).toContain("Bosh sahifa");
    calls.length = 0;
    await press("x");
    expect(out("editMessageText")).toHaveLength(0);
    expect(out("answerCallbackQuery")).toHaveLength(1);
  });

  it("tugma bosilganda xabar tahrirlanadi (yangi xabar yuborilmaydi)", async () => {
    await press("h");
    expect(out("editMessageText")).toHaveLength(1);
    expect(out("sendMessage")).toHaveLength(0);
    expect(lastEdit()?.message_id).toBe(500);
  });

  it("matn kutilmayotgan paytda tasodifiy xabar AI'ga ketmaydi: yo'l ko'rsatiladi va menyu qayta chiqadi", async () => {
    await say("salom, qalaysiz");
    expect(h.ai.runFreeAi).not.toHaveBeenCalled();
    expect(lastText()).toContain("Tushunmadim");
    expect(lastSend()?.reply_markup.keyboard.flat().map((k: { text: string }) => k.text)).toContain("🤖 AI yordamchi");
  });

  it("noma'lum buyruq va hujjatsiz fayl xabarlari", async () => {
    await say("/qwerty");
    expect(lastText()).toContain("Bunday buyruq yo'q");
    await say("", USER, { text: "" });
    expect(lastText()).toContain("faqat matn");
  });

  it("holat 45 daqiqadan keyin eskiradi: unutilgan so'rov yangi xabarni yutmaydi", async () => {
    h.state.cur = { mode: "p.title", data: {}, remind: true, updatedAt: new Date(Date.now() - 46 * 60_000) };
    await say("oddiy gap");
    expect(h.toifa.addPlanItem).not.toHaveBeenCalled();
    expect(lastText()).toContain("Tushunmadim");
  });
});

describe("Mini App (sayt Telegram ichida)", () => {
  const webButtons = (b?: Record<string, any>) => ((b?.reply_markup?.inline_keyboard ?? []) as { text: string; web_app?: { url: string } }[][]).flat().filter((x) => x.web_app);

  it("bosh sahifada birinchi tugma — Ilovani ochish (https manzil bilan)", async () => {
    await say("/menyu");
    const first = (lastSend()?.reply_markup.inline_keyboard as { text: string; web_app?: { url: string } }[][])[0][0];
    expect(first).toEqual({ text: "📱 Ilovani ochish", web_app: { url: ORIGIN } });
  });

  it("/ilova buyrug'i Mini App tugmasini yuboradi", async () => {
    await say("/ilova");
    expect(webButtons(lastSend())).toEqual([{ text: "📱 Ilovani ochish", web_app: { url: ORIGIN } }]);
    expect(lastText()).toContain("USTOZ 360 ilovasi");
  });

  it("doimiy menyuning birinchi qatorida Mini App tugmasi bor, bo'limlar o'z joyida", async () => {
    await say("salom");
    const kb = lastSend()?.reply_markup.keyboard as { text: string; web_app?: { url: string } }[][];
    expect(kb[0]).toEqual([{ text: "📱 Ilovani ochish", web_app: { url: ORIGIN } }]);
    expect(kb.flat().map((k) => k.text)).toEqual(expect.arrayContaining(["📚 Testlar", "🤖 AI yordamchi", "👤 Profil"]));
  });

  it("menyu tugmasi matni bo'lim sifatida ochilmaydi: 'Ilovani ochish' matn bo'lib kelsa menyuga yo'naltiriladi", async () => {
    await say("📱 Ilovani ochish");
    expect(lastText()).toContain("Tushunmadim");
  });

  it("http (xavfsiz emas) manzilda Mini App tugmasi chiqmaydi", async () => {
    await routeMessage({ chat: { id: 77, type: "private" }, from: { id: 5 }, text: "/ilova" }, USER, "http://localhost:3000");
    expect(webButtons(lastSend())).toEqual([]);
    expect(lastText()).toContain("https");
  });
});

describe("xatolar", () => {
  it("tugma bosilganda xizmat xatosi qisqa ogohlantirish (toast) bo'ladi", async () => {
    h.practice.homeData.mockResolvedValue({ active: null, errorsOpen: 0, errorsDue: 0, approved: 0, history: [] });
    h.practice.startPractice.mockRejectedValue(new ApiError(404, "Bu mavzuda hozircha tasdiqlangan savollar yo'q."));
    await press("t.q");
    const a = out("answerCallbackQuery").at(-1)!.body;
    expect(a.text).toContain("tasdiqlangan savollar yo'q");
    expect(a.show_alert).toBe(true);
  });

  it("xabarga javob berishda xato '⚠️' bilan ko'rsatiladi, kutilmagan xato tafsilotsiz", async () => {
    h.sinf.listClasses.mockRejectedValue(new Error("secret db password leaked"));
    await say("👩‍🏫 Sinflarim");
    expect(lastText()).toContain("⚠️");
    expect(lastText()).not.toContain("secret");
  });

  it("noto'g'ri kiritilgan matn (zod) o'zbekcha xabar bilan qaytadi va holat saqlanadi", async () => {
    await press("p.add");
    await say("x".repeat(200));
    expect(lastText()).toContain("⚠️");
    expect(lastText()).toMatch(/160/);
    expect(h.state.cur?.mode).toBe("p.title");
  });
});

describe("ro'yxatdan o'tishni yakunlash", () => {
  const NEW: BotUser = { id: "u2", name: "Ali", onboarded: false };
  it("ro'yxatdan o'tmagan foydalanuvchi bo'limlarga kira olmaydi: ism so'raladi", async () => {
    await say("📚 Testlar", NEW);
    expect(lastText()).toContain("Ism va familiyangizni yozing");
    expect(h.practice.homeData).not.toHaveBeenCalled();
    calls.length = 0;
    await press("t.q", NEW);
    expect(lastText()).toContain("Ism va familiyangizni yozing");
    expect(h.practice.startPractice).not.toHaveBeenCalled();
  });

  it("ism, viloyat, tuman: profil saqlanadi va doimiy menyu chiqadi", async () => {
    await say("/start", NEW);
    await say("Ali", NEW);
    expect(lastText()).toContain("harflar bilan yozing");
    await say("📚 Testlar", NEW); // menyu tugmasi ism bo'lib qolmasligi kerak
    expect(lastText()).toContain("Ism va familiyangizni yozing");
    await say("Ali 123", NEW);
    expect(lastText()).toContain("harflar bilan yozing");
    await say("Ali Valiyev", NEW);
    expect(lastText()).toContain("viloyatingizni tanlang");
    expect(cbs(lastSend())).toHaveLength(14);
    await press("o.r.0", NEW);
    expect(lastText()).toContain("Toshkent shahri");
    await say("Chilonzor tumani", NEW);
    expect(h.db.user.update).toHaveBeenCalledWith({ where: { id: "u2" }, data: { name: "Ali Valiyev" } });
    const up = h.db.profile.upsert.mock.calls[0][0];
    expect(up.update).toMatchObject({ region: "Toshkent shahri", district: "Chilonzor tumani", onboardedAt: expect.any(Date) });
    expect(lastText()).toContain("Tayyor");
    expect(lastSend()?.reply_markup.keyboard).toBeTruthy();
  });
});

describe("ro'yxatdan o'tish: bosqich yo'qolmaydi", () => {
  const NEW: BotUser = { id: "u2", name: "Ali", onboarded: false };
  it("viloyat tanlash bosqichida menyu tugmasi bosilsa, viloyat savoli qayta so'raladi", async () => {
    await say("salom", NEW); // birinchi xabar ro'yxatdan o'tishni boshlaydi
    await say("Ali Valiyev", NEW);
    expect(h.state.cur?.mode).toBe("o.region");
    await say("🧭 TOIFA reja", NEW);
    expect(lastText()).toContain("viloyatingizni tanlang");
    expect(h.state.cur?.mode).toBe("o.region");
    expect(h.db.profile.upsert).not.toHaveBeenCalled();
  });

  it("tuman bosqichida /menyu bosilsa, tuman savoli qayta so'raladi va ism-viloyat saqlanib qoladi", async () => {
    await say("salom", NEW); await say("Ali Valiyev", NEW); await press("o.r.3", NEW);
    await say("/menyu", NEW);
    expect(lastText()).toContain("Tuman yoki shahar");
    expect(lastText()).toContain("Buxoro viloyati");
    await say("Kogon tumani", NEW);
    expect(h.db.profile.upsert.mock.calls[0][0].update).toMatchObject({ region: "Buxoro viloyati", district: "Kogon tumani" });
  });

  it("noto'g'ri viloyat tugmasi yoki tuman bo'sh xabar bosqichni buzmaydi", async () => {
    await press("o.r.99", NEW);
    expect(lastText()).toContain("Ism va familiyangizni yozing");
  });
});

describe("testlar", () => {
  const item = (i: number) => ({ id: `q${i}`, topic: "Pedagogika", text: `Savol matni ${i}`, sample: false, hintOptionId: null, answer: null, options: [{ id: `o${i}a`, label: "A", text: "Birinchi" }, { id: `o${i}b`, label: "B", text: "Ikkinchi" }, { id: `o${i}c`, label: "C", text: "Uchinchi" }] });
  const view = (items: ReturnType<typeof item>[]) => ({ id: "s1", policy: "instant", kindLabel: "Tezkor mashq", status: "IN_PROGRESS", total: 2, items });

  it("tezkor mashq: savol tugmalar bilan keladi, javob darhol tekshiriladi", async () => {
    h.practice.startPractice.mockResolvedValue({ id: "s1", count: 2, short: false });
    h.practice.practiceView.mockResolvedValue(view([item(1), item(2)]));
    await press("t.q");
    expect(h.practice.startPractice).toHaveBeenCalledWith("u1", { kind: "quick", count: 5 });
    expect(lastText()).toContain("Savol 1/2");
    expect(lastText()).toContain("<b>A)</b> Birinchi");
    expect(cbs(lastEdit())).toEqual(expect.arrayContaining(["t.a.s1.0.0", "t.a.s1.0.1", "t.a.s1.0.2", "t.f.s1"]));

    h.practice.submitAnswer.mockResolvedValue({ isCorrect: false, correctOptionId: "o1b", explanation: "Chunki shunday.", finished: false });
    await press("t.a.s1.0.0");
    expect(h.practice.submitAnswer).toHaveBeenCalledWith("u1", "s1", "q1", "o1a");
    expect(lastText()).toContain("Noto'g'ri");
    expect(lastText()).toContain("To'g'ri javob: <b>B)</b> Ikkinchi");
    expect(lastText()).toContain("Chunki shunday.");
    expect(cbs(lastEdit())).toContain("t.n.s1");
  });

  it("oxirgi javobdan keyin 'Natijani ko'rish' va natija ekrani", async () => {
    h.practice.practiceView.mockResolvedValue(view([item(1)]));
    h.practice.submitAnswer.mockResolvedValue({ isCorrect: true, correctOptionId: "o1a", explanation: "", finished: true });
    await press("t.a.s1.0.0");
    expect(lastText()).toContain("To'g'ri!");
    expect(cbs(lastEdit())).toContain("t.f.s1");
    h.practice.finishPractice.mockResolvedValue({
      score: 4, total: 5, percent: 80, kindLabel: "Tezkor mashq", headline: { title: "Bugun yaxshi mashq qildingiz!", text: "Davom eting!" }, approximate: true,
      topics: [{ name: "Pedagogika", correct: 4, total: 5 }], wrong: [{ text: "Savol", correct: "Javob" }], next: { text: "Xatolarni ko'ring." },
    });
    await press("t.f.s1");
    expect(lastText()).toContain("4/5 (80%)");
    expect(lastText()).toContain("taxminiy");
    expect(lastText()).toContain("Pedagogika: 4/5");
    expect(cbs(lastEdit())).toEqual(expect.arrayContaining(["t.again.s1", "t.e", "t.r", "h"]));
  });

  it("vaqtli (yakunda tekshiriladigan) test botda ishlamaydi: saytga havola", async () => {
    h.practice.practiceView.mockResolvedValue({ ...view([item(1)]), policy: "deferred", kindLabel: "Vaqtli test" });
    await press("t.n.s1");
    expect(buttons(lastEdit()).some((x) => x.url === `${ORIGIN}/ustoz-ai/testlar/s1`)).toBe(true);
  });

  it("xatolar daftari bo'sh bo'lsa mashq boshlanmaydi", async () => {
    h.practice.errorsProgress.mockResolvedValue({ open: 0 });
    await press("t.e");
    expect(h.practice.startPractice).not.toHaveBeenCalled();
    expect(out("answerCallbackQuery").at(-1)!.body.text).toContain("bo'sh");
  });

  it("callback ma'lumoti 64 baytdan oshmaydi (uzun id bilan ham)", async () => {
    const longId = "c".repeat(25);
    h.practice.practiceView.mockResolvedValue({ ...view([{ ...item(1), id: longId }]), id: longId });
    h.practice.startPractice.mockResolvedValue({ id: longId, count: 1, short: false });
    await press("t.q");
    for (const d of cbs(lastEdit())) expect(Buffer.byteLength(d)).toBeLessThanOrEqual(64);
  });
});

describe("TOIFA reja", () => {
  it("band qo'shish: nom, keyin sana tugmasi, reja ro'yxati yangilanadi", async () => {
    const today = uzToday();
    h.toifa.addPlanItem.mockResolvedValue({ id: "pi9" });
    h.toifa.toifaState.mockResolvedValue({ today, goal: {}, roadmap: [], plan: [{ id: "pi9", date: addDays(today, 1), title: "20 ta test", done: false }], checklist: [], official: [], seminars: [] });
    await press("p.add");
    expect(h.state.cur?.mode).toBe("p.title");
    await say("20 ta test");
    expect(lastText()).toContain("Qaysi kunga");
    expect(h.state.cur?.mode).toBe("p.date");
    await press("p.ad.1");
    expect(h.toifa.addPlanItem).toHaveBeenCalledWith("u1", { date: addDays(today, 1), title: "20 ta test", kind: "TASK" });
    expect(h.state.cur?.mode).toBe("idle");
    expect(lastText()).toContain("20 ta test");
  });

  it("sanani matn bilan yozish: 'ertaga' va noto'g'ri sana", async () => {
    const today = uzToday();
    h.toifa.addPlanItem.mockResolvedValue({ id: "x" });
    await press("p.add"); await say("Hujjat topshirish");
    await say("kelasi hafta");
    expect(lastText()).toContain("tushunarsiz");
    expect(h.toifa.addPlanItem).not.toHaveBeenCalled();
    await say("ertaga");
    expect(h.toifa.addPlanItem).toHaveBeenCalledWith("u1", { date: addDays(today, 1), title: "Hujjat topshirish", kind: "TASK" });
  });

  it("reja bandini bosish bajarilgan deb belgilaydi", async () => {
    h.toifa.toifaState.mockResolvedValue({ today: uzToday(), goal: {}, roadmap: [], plan: [], checklist: [], official: [], seminars: [] });
    await press("p.t.pi1.1");
    expect(h.toifa.patchPlanItem).toHaveBeenCalledWith("u1", "pi1", { done: true });
  });

  it("maqsad: imtihon, sana, kunlik vaqt profilga yoziladi", async () => {
    await press("p.ge.A");
    expect(h.db.profile.upsert.mock.calls[0][0].update).toMatchObject({ targetExam: "ATTESTATSIYA" });
    expect(h.state.cur?.mode).toBe("p.gdate");
    await say("1.1.2020");
    expect(lastText()).toContain("o'tib ketgan");
    await say(`15.03.${new Date().getFullYear() + 2}`);
    expect(h.db.profile.upsert.mock.calls.at(-1)![0].update).toMatchObject({ examDate: expect.any(Date) });
    await press("p.gm.90");
    expect(h.db.profile.upsert.mock.calls.at(-1)![0].update).toMatchObject({ dailyMinutes: 90 });
  });
});

describe("SINF", () => {
  it("yangi sinf yaratish: nom, fan", async () => {
    h.sinf.createClass.mockResolvedValue({ id: "c1" });
    await press("s.new");
    await say("7-A");
    expect(h.state.cur?.mode).toBe("s.n2");
    await say("Matematika");
    expect(h.sinf.createClass).toHaveBeenCalledWith("u1", { name: "7-A", subject: "Matematika" });
    expect(cbs(lastSend())).toContain("s.sa.c1");
  });

  it("o'quvchi taxalluslari qo'shiladi, ism-familiya rad etiladi", async () => {
    h.sinf.addStudents.mockResolvedValue({ added: 3, skipped: 0 });
    await press("s.sa.c1");
    await say("Aziz Karimov Valiyevich");
    expect(h.sinf.addStudents).not.toHaveBeenCalled();
    expect(lastText()).toContain("taxallus");
    await say("O-1, O-2\nOybek");
    expect(h.sinf.addStudents).toHaveBeenCalledWith("u1", "c1", ["O-1", "O-2", "Oybek"]);
    expect(lastText()).toContain("Qo'shildi: <b>3</b>");
  });

  it("baholash qo'shish: nom, mavzu, tur, eng yuqori ball", async () => {
    h.sinf.saveAssessment.mockResolvedValue({ id: "a1" });
    await press("s.as.c1");
    await say("Kasrlar nazorat ishi");
    await say("Oddiy kasrlar");
    expect(cbs(lastSend())).toEqual(expect.arrayContaining(["s.ak.B", "s.ak.A", "s.ak.C"]));
    await press("s.ak.B");
    expect(h.state.cur?.mode).toBe("s.am");
    await press("s.am.20");
    expect(h.sinf.saveAssessment).toHaveBeenCalledWith("u1", "c1", { title: "Kasrlar nazorat ishi", topic: "Oddiy kasrlar", kind: "BEFORE", maxScore: 20, date: uzToday() });
    expect(cbs(lastEdit())).toContain("s.sq.c1.a1");
  });

  it("ball kiritish: matn qatorlari o'quvchilarga biriktiriladi, o'qilmagan qator aytiladi", async () => {
    h.sinf.classDetail.mockResolvedValue({
      name: "7-A", subject: "Mat", grade: null, students: [{ id: "s1", alias: "Oybek" }, { id: "s2", alias: "O-2" }],
      assessments: [{ id: "a1", title: "Nazorat", topic: "Kasr", kind: "CURRENT", maxScore: 20, date: uzToday() }], scores: [], analysis: {}, insights: [],
    });
    h.sinf.saveScores.mockResolvedValue({ saved: 2, cleared: 0 });
    await press("s.sq.c1.a1");
    expect(lastText()).toContain("1. Oybek");
    expect(h.state.cur?.mode).toBe("s.scores");
    await say("1 18\n2 15,5\nAziz 7");
    expect(h.sinf.saveScores).toHaveBeenCalledWith("u1", "c1", "a1", { s1: 18, s2: 15.5 });
    expect(lastText()).toContain("Saqlandi: <b>2</b>");
    expect(lastText()).toContain("Aziz 7");
  });

  it("sinfni o'chirish tasdiq so'raydi", async () => {
    await press("s.del.c1");
    expect(h.sinf.deleteClass).not.toHaveBeenCalled();
    expect(cbs(lastEdit())).toContain("s.dy.c1");
    h.sinf.listClasses.mockResolvedValue({ classes: [] });
    await press("s.dy.c1");
    expect(h.sinf.deleteClass).toHaveBeenCalledWith("u1", "c1");
  });
});

describe("DARSYOR", () => {
  it("dars ishlanmasi: 4 bosqich, AI chaqiriladi, hujjat qoralama sifatida saqlanadi, matn bo'laklab yuboriladi", async () => {
    h.gen.generateLesson.mockResolvedValue({ model: "m", sections: { "Maqsad va kutiladigan natijalar": "Kasrlarni qo'shishni o'rganadilar.", "Yangi mavzu": "<b>Tushuntirish</b> & misollar" } });
    h.docs.saveDoc.mockResolvedValue({ id: "d1" });
    await press("d.l");
    await say("Matematika");
    expect(cbs(lastSend())).toContain("d.lg.6");
    await press("d.lg.6");
    await say("Oddiy kasrlarni qo'shish");
    await press("d.ld.45");
    expect(h.gen.generateLesson).toHaveBeenCalledWith("u1", expect.objectContaining({ subject: "Matematika", grade: 6, topic: "Oddiy kasrlarni qo'shish", duration: 45 }));
    expect(h.docs.saveDoc).toHaveBeenCalledWith("u1", expect.objectContaining({ kind: "lesson_plan", status: "DRAFT" }));
    expect(allText()).toContain("<b>Tushuntirish</b> & misollar"); // AI matni oddiy matn sifatida yuboriladi
    const plain = out("sendMessage").filter((c) => String(c.body.text).includes("Tushuntirish"));
    expect(plain.every((c) => c.body.parse_mode === undefined)).toBe(true);
    expect(allText()).toContain("qoralama");
    expect(h.state.cur?.mode).toBe("idle");
  });

  it("AI ulanmagan bo'lsa tushunarli xabar, holat tozalanadi", async () => {
    h.gen.generateLesson.mockRejectedValue(new ApiError(503, "AI xizmati hali ulanmagan. Qo'lda to'ldirishingiz mumkin.", "ai_unconfigured"));
    await press("d.l"); await say("Fizika"); await press("d.lg.7"); await say("Nyuton qonunlari");
    await press("d.ld.45");
    expect(lastText()).toContain("AI xizmati hali ulanmagan");
    expect(lastText()).toContain("⚠️");
  });

  it("test topshiriqlari: sozlamalar bilan AI chaqiriladi va savollar chiqadi", async () => {
    h.gen.generateTasks.mockResolvedValue({ model: "m", problems: 0, note: null, items: [{ type: "single", text: "2+2?", options: ["3", "4"], correct: [1], pairs: [], answer: "", explanation: "Oddiy qo'shish", approved: false, source: "ai" }] });
    h.docs.saveDoc.mockResolvedValue({ id: "d2" });
    await press("d.t"); await say("Matematika"); await press("d.tg.5"); await say("Qo'shish");
    await press("d.tl.easy"); await press("d.tc.5"); await press("d.ty.0");
    expect(h.gen.generateTasks).toHaveBeenCalledWith("u1", expect.objectContaining({ subject: "Matematika", grade: "5", level: "easy", count: 5, types: ["single"] }));
    expect(allText()).toContain("1) 2+2?");
    expect(allText()).toContain("To'g'ri: B");
  });

  it("hujjatlar ro'yxati va ochish", async () => {
    h.docs.listDocs.mockResolvedValue({ docs: [{ id: "d1", kind: "lesson_plan", title: "Kasrlar, 6-sinf" }] });
    await press("d.docs.0");
    expect(cbs(lastEdit())).toContain("d.o.d1");
    h.docs.getDoc.mockResolvedValue({ id: "d1", kind: "lesson_plan", title: "Kasrlar", subject: "Mat", grade: "6", status: "DRAFT", updatedAt: "2026-11-05T00:00:00Z", data: { sections: { "Yangi mavzu": "Matn" } } });
    await press("d.o.d1");
    expect(allText()).toContain("YANGI MAVZU");
  });
});

describe("AI yordamchi", () => {
  it("tugma bilan yoqiladi, shundan keyingina matn AI'ga ketadi, javob tugmalar bilan", async () => {
    h.db.aiChat.findFirst.mockResolvedValue(null);
    h.ai.runFreeAi.mockResolvedValue({ text: "Dars rejasi: <1> kirish", model: "m" });
    await say("🤖 AI yordamchi");
    expect(h.state.cur?.mode).toBe("ai");
    expect(lastText()).toContain("47/50");
    await say("Dars rejasi tuz");
    expect(h.ai.runFreeAi).toHaveBeenCalledWith("u1", [{ role: "user", content: "Dars rejasi tuz" }]);
    expect(h.chats.saveExchange).toHaveBeenCalledWith("u1", undefined, "telegram", "Dars rejasi tuz", "Dars rejasi: <1> kirish");
    expect(lastSend()?.text).toBe("Dars rejasi: <1> kirish");
    expect(lastSend()?.parse_mode).toBeUndefined();
    expect(cbs(lastSend())).toEqual(expect.arrayContaining(["a.new", "a.lim", "h"]));
  });

  it("AI rejimidan boshqa bo'limga o'tilsa, matn yana AI'ga ketmaydi", async () => {
    await say("🤖 AI yordamchi");
    h.seminars.listPublicSeminars.mockResolvedValue({ seminars: [] });
    await say("📅 Seminarlar");
    expect(h.state.cur?.mode).toBe("idle");
    await say("savol");
    expect(h.ai.runFreeAi).not.toHaveBeenCalled();
  });

  it("limit tugagan bo'lsa AI xabari ko'rsatiladi; /limit va /yangi buyruqlari", async () => {
    await say("🤖 AI yordamchi");
    h.ai.runFreeAi.mockRejectedValue(new ApiError(429, "Bugungi bepul AI limiti tugadi (50 ta). Ertaga qayta urinib ko'ring.", "daily_limit"));
    await say("savol");
    expect(lastSend()?.text).toContain("limiti tugadi");
    await say("/limit");
    expect(lastText()).toContain("47 / 50");
    h.db.aiChat.findFirst.mockResolvedValue({ id: "C1", messages: [] });
    await say("/yangi");
    expect(h.db.aiChat.update).toHaveBeenCalled();
    expect(lastText()).toContain("Yangi suhbat");
  });

  it("AI ulanmagan bo'lsa halol xabar", async () => {
    h.ai.freeConfigured.mockReturnValue(false);
    await say("🤖 AI yordamchi");
    expect(lastText()).toContain("ulanmagan");
    expect(h.state.cur?.mode ?? "idle").not.toBe("ai");
  });
});

describe("MARKET", () => {
  it("kursni sotib olish: buyurtma, summa, to'lov kodi va bekor qilish tugmasi", async () => {
    h.pay.createOrder.mockResolvedValue({ free: false, title: "Metodika kursi", instructions: "Karta: 8600 ...", checkoutUrl: null, payment: { id: "p1", amount: 189000, reference: "U360-ABC123" } });
    await press("m.b.c1");
    expect(h.pay.createOrder).toHaveBeenCalledWith("u1", { kind: "COURSE", courseId: "c1" });
    expect(lastText()).toContain("189 000 so'm");
    expect(lastText()).toContain("U360-ABC123");
    expect(lastText()).toContain("Karta: 8600");
    expect(cbs(lastEdit())).toContain("m.cx.p1");
  });

  it("to'lov tizimi ulanmagan bo'lsa buyurtma yaratilmaydi: xabar ko'rsatiladi", async () => {
    h.pay.createOrder.mockRejectedValue(new ApiError(503, "To'lov tizimi hali ulanmagan.", "payments_off"));
    await press("m.bp.PRO");
    expect(out("answerCallbackQuery").at(-1)!.body.text).toContain("hali ulanmagan");
  });

  it("katalog va kurs kartochkasi", async () => {
    h.market.catalog.mockResolvedValue({ courses: [{ id: "c1", title: "Metodika", description: "Tavsif", subject: "Pedagogika", kind: "VIDEO", priceUzs: 50000, lessonCount: 8, author: "Aziza", owned: false }], subjects: [] });
    await press("m.k.0");
    expect(cbs(lastEdit())).toContain("m.c.c1");
    await press("m.c.c1");
    expect(lastText()).toContain("50 000 so'm");
    expect(cbs(lastEdit())).toContain("m.b.c1");
  });
});

describe("Kutubxona", () => {
  it("qidirish: so'z yoziladi, natija ro'yxati, keyingi so'z yangi qidiruv", async () => {
    h.lib.listLibrary.mockResolvedValue({ total: 1, pages: 1, page: 1, docs: [{ id: "L1", title: "Metodik qo'llanma", type: "PDF", favorite: false }], subjects: [], storage: {} });
    h.db.userRole.findMany.mockResolvedValue([{ role: "TEACHER" }]);
    await press("l.s");
    await say("metod");
    expect(h.lib.listLibrary).toHaveBeenCalledWith({ id: "u1", roles: [{ role: "TEACHER" }] }, { page: 1, q: "metod" });
    expect(cbs(lastSend())).toContain("l.o.L1");
    await say("boshqa");
    expect(h.lib.listLibrary).toHaveBeenLastCalledWith(expect.anything(), { page: 1, q: "boshqa" });
  });

  it("fayl yuborilganda saqlash ulanmagan bo'lsa halol xabar", async () => {
    h.lib.storageState.mockReturnValue({ configured: false });
    await say("", USER, { text: undefined, document: { file_id: "F1", file_name: "a.pdf", file_size: 1000 } });
    expect(lastText()).toContain("ulanmagan");
    expect(h.lib.uploadDoc).not.toHaveBeenCalled();
  });

  it("hujjatdan so'rash: javob va manbalar", async () => {
    h.lib.askDoc.mockResolvedValue({ answer: "Javob matni", grounded: true, sources: [{ n: 1, text: "Parcha" }], note: null });
    h.db.userRole.findMany.mockResolvedValue([]);
    await press("l.ask.L1");
    await say("Nima haqida?");
    expect(h.lib.askDoc).toHaveBeenCalledWith({ id: "u1", roles: [] }, "L1", "Nima haqida?");
    expect(lastSend()?.text).toContain("Javob matni");
    expect(lastSend()?.text).toContain("Manbalar");
  });
});

describe("Profil", () => {
  it("eslatmani o'chirish/yoqish holatga yoziladi", async () => {
    h.db.user.findUnique.mockResolvedValue({ name: "Aziza", phone: "+998901234567", email: null, profile: { region: "Toshkent shahri", district: "Chilonzor", targetExam: null, examDate: null } });
    h.db.botState.findUnique.mockResolvedValue({ mode: "idle", data: null, remind: true, updatedAt: new Date() });
    h.ent.getEntitlements.mockResolvedValue({ planName: "FREE" });
    h.db.subscription.findFirst.mockResolvedValue(null);
    h.db.courseAccess.count.mockResolvedValue(0);
    h.db.payment.count.mockResolvedValue(0);
    await press("u.rm");
    expect(h.db.botState.upsert).toHaveBeenCalledWith(expect.objectContaining({ update: { remind: false } }));
    expect(lastText()).toContain("o'chirilgan");
  });
});
