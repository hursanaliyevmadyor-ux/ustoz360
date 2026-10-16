import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => {
  const tx = {
    userAnswer: { create: vi.fn(), createMany: vi.fn() },
    topicMastery: { findUnique: vi.fn(), upsert: vi.fn() },
    errorCard: { findUnique: vi.fn(), findMany: vi.fn(), upsert: vi.fn(), update: vi.fn() },
    testSession: { updateMany: vi.fn(), update: vi.fn() },
  };
  const db = {
    testSession: { findFirst: vi.fn(), findMany: vi.fn(), findUnique: vi.fn(), findUniqueOrThrow: vi.fn(), update: vi.fn(), updateMany: vi.fn(), create: vi.fn() },
    userAnswer: { findUnique: vi.fn(), findMany: vi.fn(), count: vi.fn() },
    question: { findUnique: vi.fn(), findMany: vi.fn() },
    answerOption: { findMany: vi.fn(), findFirst: vi.fn() },
    errorCard: { findMany: vi.fn() },
    topicMastery: { findMany: vi.fn() },
    $executeRaw: vi.fn(),
    $transaction: vi.fn(async (fn: (t: typeof tx) => unknown) => fn(tx)),
  };
  const gw = { aiConfigured: vi.fn(() => false), freeConfigured: vi.fn(() => false) };
  return { db, tx, gw };
});
vi.mock("./db", () => ({ db: h.db }));
vi.mock("./ai/gateway", () => h.gw);
vi.mock("./auth", () => ({ ApiError: class extends Error { constructor(public status: number, message: string, public code?: string) { super(message); } } }));

import { finishPractice, giveHint, practiceView, saveSelection, setFlag, startPractice, submitAnswer } from "./practice";

const mk = (over: Record<string, unknown> = {}) => ({
  id: "q1", topicId: "t1", text: "Savol?", explanation: "Izoh.", superKey: "Kalit", skill: null, kind: "CLASSIC", status: "APPROVED", source: "MANUAL", isDemo: false, topic: { name: "Mavzu" },
  options: [{ id: "o1", isCorrect: false, text: "A", position: 0 }, { id: "o2", isCorrect: true, text: "B", position: 1 }, { id: "o3", isCorrect: false, text: "C", position: 2 }], ...over,
});
const session = (over: Record<string, unknown> = {}) => ({
  id: "s1", userId: "u1", mode: "PRACTICE", status: "IN_PROGRESS", questionIds: ["q1", "q2"], startedAt: new Date(), submittedAt: null,
  config: { kind: "topic", hints: {}, order: {} }, ...over,
});
const deferredSession = (over: Record<string, unknown> = {}) => session({
  mode: "TIMED", config: { kind: "timed", policy: "deferred", durationSec: 600, answers: {}, flags: {}, order: {}, hints: {} }, ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  h.db.$transaction.mockImplementation(async (fn: (t: typeof h.tx) => unknown) => fn(h.tx));
  h.db.testSession.findFirst.mockResolvedValue(session());
  h.db.testSession.findMany.mockResolvedValue([]);
  h.db.question.findUnique.mockResolvedValue(mk());
  h.db.userAnswer.findUnique.mockResolvedValue(null);
  h.db.userAnswer.count.mockResolvedValue(1);
  h.tx.topicMastery.findUnique.mockResolvedValue(null);
  h.tx.errorCard.findUnique.mockResolvedValue(null);
  h.tx.errorCard.findMany.mockResolvedValue([]);
  h.tx.testSession.updateMany.mockResolvedValue({ count: 1 });
});

describe("javobni server tekshiradi (darhol tekshiriladigan rejimlar)", () => {
  it("to'g'ri javob: natija kalit bilan qaytadi, mavzu bilimi yangilanadi", async () => {
    const r = await submitAnswer("u1", "s1", "q1", "o2");
    expect(r).toMatchObject({ isCorrect: true, correctOptionId: "o2", explanation: "Izoh.", superKey: "Kalit", answered: 1, total: 2, finished: false });
    expect(h.tx.userAnswer.create).toHaveBeenCalledWith({ data: expect.objectContaining({ sessionId: "s1", questionId: "q1", optionId: "o2", isCorrect: true }) });
    expect(h.tx.topicMastery.upsert).toHaveBeenCalledWith(expect.objectContaining({ create: expect.objectContaining({ correct: 1, total: 1 }) }));
    expect(h.tx.errorCard.upsert).not.toHaveBeenCalled();
  });
  it("noto'g'ri javob: xatolar daftariga tushadi (1 kundan keyin takrorlash)", async () => {
    const r = await submitAnswer("u1", "s1", "q1", "o1");
    expect(r).toMatchObject({ isCorrect: false, chosenOptionId: "o1", correctOptionId: "o2" });
    expect(h.tx.errorCard.upsert).toHaveBeenCalledWith(expect.objectContaining({ create: expect.objectContaining({ intervalDays: 1 }) }));
  });
  it("mijoz «to'g'ri» deb yuborgan ma'lumotga ishonilmaydi: faqat variant id qabul qilinadi", async () => {
    await expect(submitAnswer("u1", "s1", "q1", "yo'q-variant")).rejects.toMatchObject({ status: 400 });
    expect(h.tx.userAnswer.create).not.toHaveBeenCalled();
  });
  it("mashqda yo'q savolga javob berib bo'lmaydi", async () => {
    await expect(submitAnswer("u1", "s1", "boshqa", "o1")).rejects.toMatchObject({ status: 404 });
  });
  it("boshqa foydalanuvchining mashqi topilmaydi (so'rov egasi bo'yicha filtrlanadi)", async () => {
    h.db.testSession.findFirst.mockResolvedValue(null);
    await expect(submitAnswer("u2", "s1", "q1", "o1")).rejects.toMatchObject({ status: 404 });
    expect(h.db.testSession.findFirst).toHaveBeenCalledWith({ where: expect.objectContaining({ id: "s1", userId: "u2" }) });
  });
  it("takroriy so'rov: oldingi natija qaytadi, hisob-kitob qayta bajarilmaydi", async () => {
    h.db.userAnswer.findUnique.mockResolvedValue({ optionId: "o1", isCorrect: false, hintUsed: false });
    const r = await submitAnswer("u1", "s1", "q1", "o2");
    expect(r).toMatchObject({ isCorrect: false, chosenOptionId: "o1" });
    expect(h.db.$transaction).not.toHaveBeenCalled();
  });
  it("AI yaratgan (tasdiqlanmagan) savol mavzu bilimiga ta'sir qilmaydi", async () => {
    h.db.question.findUnique.mockResolvedValue(mk({ status: "DRAFT", source: "AI" }));
    await submitAnswer("u1", "s1", "q1", "o1");
    expect(h.tx.userAnswer.create).toHaveBeenCalled();
    expect(h.tx.topicMastery.upsert).not.toHaveBeenCalled();
    expect(h.tx.errorCard.upsert).not.toHaveBeenCalled();
  });
  it("oxirgi savolga javob berilganda mashq avtomatik yakunlanadi", async () => {
    h.db.userAnswer.count.mockResolvedValue(2);
    h.db.userAnswer.findMany.mockResolvedValue([{ isCorrect: true }, { isCorrect: false }]);
    const r = await submitAnswer("u1", "s1", "q1", "o2");
    expect(r.finished).toBe(true);
    expect(h.db.testSession.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: "SUBMITTED", score: 1, total: 2 }) }));
  });
  it("yakunlangan mashqqa yangi javob qabul qilinmaydi", async () => {
    h.db.testSession.findFirst.mockResolvedValue(session({ status: "SUBMITTED" }));
    await expect(submitAnswer("u1", "s1", "q1", "o2")).rejects.toMatchObject({ status: 409 });
  });
  it("xatolar testida (yangi vaziyat) to'g'ri javob shu ko'nikmadagi ochiq xatolarni oldinga siljitadi", async () => {
    h.db.testSession.findFirst.mockResolvedValue(session({ mode: "ERRORS", config: { kind: "errors", variant: "new", hints: {}, order: {} } }));
    h.db.question.findUnique.mockResolvedValue(mk({ skill: "refleksiya" }));
    h.tx.errorCard.findMany.mockResolvedValue([{ id: "c1", intervalDays: 1 }, { id: "c2", intervalDays: 2 }]);
    await submitAnswer("u1", "s1", "q1", "o2");
    expect(h.tx.errorCard.update).toHaveBeenCalledTimes(2);
    expect(h.tx.errorCard.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "c1" }, data: expect.objectContaining({ intervalDays: 2 }) }));
  });
});

describe("yakunda tekshiriladigan testlar (vaqtli, aralash)", () => {
  beforeEach(() => { h.db.testSession.findFirst.mockResolvedValue(deferredSession()); h.db.answerOption.findFirst.mockResolvedValue({ id: "o2" }); });

  it("test davomida javob tekshirilmaydi: kalit so'ralsa 409", async () => {
    await expect(submitAnswer("u1", "s1", "q1", "o2")).rejects.toMatchObject({ status: 409 });
    expect(h.tx.userAnswer.create).not.toHaveBeenCalled();
  });
  it("tanlov atomik saqlanadi, javob kaliti qaytmaydi", async () => {
    const r = await saveSelection("u1", "s1", "q1", "o2");
    expect(r).toEqual({ ok: true });
    expect(h.db.$executeRaw).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(r)).not.toMatch(/isCorrect|correct/);
  });
  it("noto'g'ri variant, boshqa savol yoki darhol tekshiriladigan rejimda saqlab bo'lmaydi", async () => {
    h.db.answerOption.findFirst.mockResolvedValue(null);
    await expect(saveSelection("u1", "s1", "q1", "yo'q")).rejects.toMatchObject({ status: 400 });
    await expect(saveSelection("u1", "s1", "boshqa", "o2")).rejects.toMatchObject({ status: 404 });
    h.db.testSession.findFirst.mockResolvedValue(session());
    await expect(saveSelection("u1", "s1", "q1", "o2")).rejects.toMatchObject({ status: 409 });
  });
  it("tanlovni bekor qilish va savolni belgilash/olib tashlash ishlaydi", async () => {
    await saveSelection("u1", "s1", "q1", null);
    await setFlag("u1", "s1", "q1", true);
    await setFlag("u1", "s1", "q1", false);
    expect(h.db.$executeRaw).toHaveBeenCalledTimes(3);
  });
  it("yakunlangan testda tanlovni o'zgartirib bo'lmaydi", async () => {
    h.db.testSession.findFirst.mockResolvedValue(deferredSession({ status: "SUBMITTED" }));
    await expect(saveSelection("u1", "s1", "q1", "o2")).rejects.toMatchObject({ status: 409 });
  });
  it("ishora bu rejimlarda berilmaydi", async () => {
    await expect(giveHint("u1", "s1", "q1")).rejects.toMatchObject({ status: 409 });
  });
  it("test davomida ko'rinishda to'g'ri javob, izoh va super kalit yo'q; tanlov va taymer bor", async () => {
    h.db.testSession.findFirst.mockResolvedValue(deferredSession({ config: { kind: "timed", policy: "deferred", durationSec: 600, answers: { q1: { o: "o1", t: 1 } }, flags: { q1: true }, order: {}, hints: {} } }));
    h.db.question.findMany.mockResolvedValue([mk(), mk({ id: "q2" })]);
    h.db.userAnswer.findMany.mockResolvedValue([]);
    const v = await practiceView("u1", "s1");
    expect(v.policy).toBe("deferred");
    expect(v.items[0]).toMatchObject({ selectedOptionId: "o1", flagged: true, answer: null });
    expect(JSON.stringify(v.items)).not.toMatch(/correctOptionId|Izoh\.|Kalit/);
    expect(v.answered).toBe(1);
    expect(v.timer!.remainingSec).toBeGreaterThan(590);
  });

  it("yakunlash: faqat javob berilgan savollar baholanadi, xato daftarga tushadi, ball serverda hisoblanadi", async () => {
    h.db.testSession.findFirst.mockResolvedValue(deferredSession({ config: { kind: "timed", policy: "deferred", durationSec: 600, answers: { q1: { o: "o1", t: 5 } }, flags: {}, order: {}, hints: {} } }));
    h.db.question.findMany.mockResolvedValue([mk(), mk({ id: "q2", topicId: "t2" })]);
    h.db.userAnswer.findMany.mockResolvedValue([]);
    await finishPractice("u1", "s1").catch(() => {});
    expect(h.tx.userAnswer.createMany).toHaveBeenCalledWith({ data: [expect.objectContaining({ questionId: "q1", optionId: "o1", isCorrect: false })] });
    expect(h.tx.testSession.update).toHaveBeenCalledWith(expect.objectContaining({ data: { score: 0 } }));
    expect(h.tx.errorCard.upsert).toHaveBeenCalledTimes(1);
    expect(h.tx.topicMastery.upsert).toHaveBeenCalledTimes(1);
  });
  it("takroriy yakunlash balni ikki marta hisoblamaydi (holat allaqachon egallangan)", async () => {
    h.tx.testSession.updateMany.mockResolvedValue({ count: 0 });
    h.db.testSession.findFirst.mockResolvedValue(deferredSession({ config: { kind: "timed", policy: "deferred", durationSec: 600, answers: { q1: { o: "o2", t: 5 } }, flags: {}, order: {}, hints: {} } }));
    h.db.question.findMany.mockResolvedValue([mk()]);
    h.db.userAnswer.findMany.mockResolvedValue([]);
    await finishPractice("u1", "s1").catch(() => {});
    expect(h.tx.userAnswer.createMany).not.toHaveBeenCalled();
    expect(h.tx.topicMastery.upsert).not.toHaveBeenCalled();
  });
  it("vaqt tugagan bo'lsa, sessiya server tomonida avtomatik yakunlanadi (sahifa yangilanganda ham)", async () => {
    const old = new Date(Date.now() - 20 * 60_000);
    h.db.testSession.findFirst.mockResolvedValue(deferredSession({ startedAt: old, config: { kind: "timed", policy: "deferred", durationSec: 600, answers: { q1: { o: "o2", t: 5 } }, flags: {}, order: {}, hints: {} } }));
    h.db.testSession.findUniqueOrThrow.mockResolvedValue(deferredSession({ status: "SUBMITTED", startedAt: old, config: { kind: "timed", policy: "deferred", durationSec: 600, answers: {}, flags: {}, order: {}, hints: {} } }));
    h.db.question.findMany.mockResolvedValue([mk()]);
    h.db.userAnswer.findMany.mockResolvedValue([]);
    const v = await practiceView("u1", "s1");
    expect(h.tx.testSession.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: "SUBMITTED" }) }));
    expect(v.status).toBe("SUBMITTED");
    await expect(saveSelection("u1", "s1", "q1", "o2")).rejects.toMatchObject({ status: 409 });
  });
});

describe("ishora", () => {
  it("ishora to'g'ri javobni emas, faqat noto'g'ri variantni chiqarib tashlaydi", async () => {
    h.db.answerOption.findMany.mockResolvedValue([{ id: "o1" }, { id: "o3" }]);
    h.db.testSession.findUnique.mockResolvedValue({ config: { kind: "topic" } });
    const r = await giveHint("u1", "s1", "q1");
    expect(["o1", "o3"]).toContain(r.hintOptionId);
    expect(h.db.answerOption.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { questionId: "q1", isCorrect: false } }));
  });
  it("ishora allaqachon berilgan bo'lsa, o'sha qaytadi (takroriy so'rov)", async () => {
    h.db.testSession.findFirst.mockResolvedValue(session({ config: { kind: "topic", hints: { q1: "o3" } } }));
    expect(await giveHint("u1", "s1", "q1")).toEqual({ hintOptionId: "o3" });
    expect(h.db.testSession.update).not.toHaveBeenCalled();
  });
});

describe("testni boshlash", () => {
  it("vaqtli testda vaqt, aralash testda kamida 2 mavzu, mavzuli testda aynan 1 mavzu majburiy", async () => {
    await expect(startPractice("u1", { kind: "timed" })).rejects.toMatchObject({ status: 400 });
    await expect(startPractice("u1", { kind: "mixed", topicIds: ["t1"] })).rejects.toMatchObject({ status: 400 });
    await expect(startPractice("u1", { kind: "topictest", topicIds: ["t1", "t2"] })).rejects.toMatchObject({ status: 400 });
  });
  it("tasdiqlangan savollar bo'lmasa, tushunarli xabar bilan 404", async () => {
    h.db.question.findMany.mockResolvedValue([]);
    h.db.userAnswer.findMany.mockResolvedValue([]);
    await expect(startPractice("u1", { kind: "topic", topicIds: ["t1"] })).rejects.toMatchObject({ status: 404, code: "NO_QUESTIONS", message: "Bu mavzuda hozircha tasdiqlangan savollar yo'q." });
  });
  it("faqat APPROVED savollar tanlanadi; ko'rilmaganlari avval; variantlar tartibi saqlanadi", async () => {
    h.db.question.findMany.mockResolvedValue([{ id: "q1" }, { id: "q2" }, { id: "q3" }]);
    h.db.userAnswer.findMany.mockResolvedValue([{ questionId: "q1" }]);
    h.db.answerOption.findMany.mockResolvedValue([{ id: "a", questionId: "q1" }, { id: "b", questionId: "q1" }, { id: "c", questionId: "q2" }, { id: "d", questionId: "q3" }]);
    h.db.testSession.create.mockResolvedValue({ id: "new1" });
    const r = await startPractice("u1", { kind: "quick", count: 5 });
    expect(h.db.question.findMany).toHaveBeenCalledWith({ where: { status: "APPROVED" }, select: { id: true } });
    expect(r).toMatchObject({ id: "new1", count: 3, requested: 5, short: true });
    const data = h.db.testSession.create.mock.calls[0][0].data;
    expect(data.questionIds[2]).toBe("q1");
    expect(data.config.order.q1.sort()).toEqual(["a", "b"]);
    expect(data.mode).toBe("PRACTICE");
    expect(data.config.policy).toBe("instant");
  });
  it("vaqtli test: yakunda tekshiriladi, taymer saqlanadi, sessiya vaqti taymerga mos", async () => {
    h.db.question.findMany.mockResolvedValue([{ id: "q1" }, { id: "q2" }]);
    h.db.userAnswer.findMany.mockResolvedValue([]);
    h.db.answerOption.findMany.mockResolvedValue([]);
    h.db.testSession.create.mockResolvedValue({ id: "t1" });
    await startPractice("u1", { kind: "timed", count: 5, durationMin: 10 });
    const data = h.db.testSession.create.mock.calls[0][0].data;
    expect(data.mode).toBe("TIMED");
    expect(data.config).toMatchObject({ policy: "deferred", durationSec: 600 });
    expect(data.expiresAt.getTime() - Date.now()).toBeLessThan(11 * 60_000);
  });
  it("aralash test: savollar tanlangan mavzular o'rtasida teng taqsimlanadi", async () => {
    const pool = [...["a1", "a2", "a3", "a4", "a5", "a6"].map((id) => ({ id, topicId: "ta" })), ...["b1", "b2", "b3", "b4", "b5", "b6"].map((id) => ({ id, topicId: "tb" }))];
    h.db.question.findMany.mockResolvedValue(pool);
    h.db.userAnswer.findMany.mockResolvedValue([]);
    h.db.answerOption.findMany.mockResolvedValue([]);
    h.db.testSession.create.mockResolvedValue({ id: "m1" });
    await startPractice("u1", { kind: "mixed", topicIds: ["ta", "tb"], count: 10, distribution: "equal" });
    const ids: string[] = h.db.testSession.create.mock.calls[0][0].data.questionIds;
    expect(ids.length).toBe(10);
    expect(ids.filter((i) => i.startsWith("a")).length).toBe(5);
    expect(ids.filter((i) => i.startsWith("b")).length).toBe(5);
  });
  it("xatolar testi: xato bo'lmasa xabar; yangi vaziyatda eski savollar kiritilmaydi", async () => {
    h.db.errorCard.findMany.mockResolvedValue([]);
    await expect(startPractice("u1", { kind: "errors" })).rejects.toMatchObject({ code: "NO_ERRORS" });
    h.db.errorCard.findMany.mockResolvedValue([{ questionId: "e1", question: { skill: "refleksiya", topicId: "t1" } }]);
    h.db.question.findMany.mockResolvedValue([]);
    h.db.userAnswer.findMany.mockResolvedValue([]);
    await expect(startPractice("u1", { kind: "errors", variant: "new" })).rejects.toMatchObject({ code: "NO_NEW_QUESTIONS" });
    expect(h.db.question.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ id: { notIn: ["e1"] }, source: { not: "AI" } }) }));
  });
  it("yangi test boshlanganda eski yakunlanmagan yakunda tekshiriladigan testning saqlangan javoblari baholanadi", async () => {
    h.db.testSession.findMany.mockResolvedValue([deferredSession({ config: { kind: "timed", policy: "deferred", durationSec: 600, answers: { q1: { o: "o2", t: 1 } }, flags: {}, order: {}, hints: {} } })]);
    h.db.question.findMany.mockResolvedValueOnce([{ id: "q1" }]).mockResolvedValue([mk()]);
    h.db.userAnswer.findMany.mockResolvedValue([]);
    h.db.answerOption.findMany.mockResolvedValue([]);
    h.db.testSession.create.mockResolvedValue({ id: "n1" });
    await startPractice("u1", { kind: "quick", count: 5 });
    expect(h.tx.userAnswer.createMany).toHaveBeenCalled();
  });
});
