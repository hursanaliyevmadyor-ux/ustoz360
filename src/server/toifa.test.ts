import { describe, expect, it } from "vitest";
import { addDays, buildPlan, daysBetween, monthGrid, roadmap, slotsPerDay, splitMastery, uzToday, type PlanInput } from "./planlogic";
import { officialInput, planItemInput } from "./toifavalid";

const base: PlanInput = { today: "2026-10-17", examDate: null, dailyMinutes: 60, hasDiagnostic: true, dueErrors: 0, weak: [], thin: [] };

describe("sana yordamchilari", () => {
  it("O'zbekiston vaqti UTC+5: 19:00 UTC dan keyin keyingi kun", () => {
    expect(uzToday(new Date("2026-10-17T18:59:00Z"))).toBe("2026-10-17");
    expect(uzToday(new Date("2026-10-17T19:00:00Z"))).toBe("2026-10-18");
  });
  it("kun qo'shish va farq", () => {
    expect(addDays("2026-10-31", 1)).toBe("2026-11-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
    expect(daysBetween("2026-10-17", "2026-10-27")).toBe(10);
  });
  it("oy kalendari dushanbadan boshlanadi va qatorlar 7 ga karrali", () => {
    const g = monthGrid(2026, 9); // oktabr 2026: 1-oktabr payshanba (dushanbadan 4-kun)
    expect(g.length % 7).toBe(0);
    expect(g.indexOf("2026-10-01")).toBe(3);
    expect(g.filter(Boolean).length).toBe(31);
  });
});

describe("reja qoidalari", () => {
  it("vaqt kam bo'lsa kuniga 1 ta, ko'p bo'lsa 3 tagacha vazifa", () => {
    expect([slotsPerDay(30), slotsPerDay(60), slotsPerDay(120), slotsPerDay(null)]).toEqual([1, 2, 3, 2]);
  });
  it("sana yo'q bo'lsa 7 kunlik reja", () => {
    const p = buildPlan(base);
    expect(new Set(p.map((x) => x.date)).size).toBe(7);
  });
  it("diagnostika topshirilmagan bo'lsa birinchi kunning birinchi vazifasi diagnostika", () => {
    const p = buildPlan({ ...base, hasDiagnostic: false });
    expect(p[0]).toMatchObject({ date: "2026-10-17", kind: "DIAG", href: "/ustoz-ai/diagnostika" });
    expect(p.filter((x) => x.kind === "DIAG").length).toBe(1);
  });
  it("zaif mavzular eng pastidan boshlab aylanadi va mavzuga havola bor", () => {
    const p = buildPlan({ ...base, weak: [{ topicId: "t2", name: "Bo'lish", percent: 45 }, { topicId: "t1", name: "Kasrlar", percent: 30 }] });
    const tests = p.filter((x) => x.kind === "TEST");
    expect(tests[0].title).toContain("Kasrlar");
    expect(tests[1].title).toContain("Bo'lish");
    expect(tests[0].href).toBe("/ustoz-ai/testlar/sozlash?mode=topic&topic=t1");
  });
  it("takrorlashga tayyor xato bo'lsa har ikkinchi kuni xatolar testi", () => {
    const p = buildPlan({ ...base, dueErrors: 4 });
    const days = p.filter((x) => x.kind === "REVIEW").map((x) => daysBetween(base.today, x.date));
    expect(days).toEqual([0, 2, 4, 6]);
  });
  it("hech qanday ma'lumot bo'lmasa umumiy mashqlar aylanadi (uydirma mavzu yo'q, bir kunda takror yo'q)", () => {
    const p = buildPlan({ ...base, dailyMinutes: 120 });
    expect(p.every((x) => x.kind === "TEST" && !x.title.includes("hozir"))).toBe(true);
    const byDay = new Map<string, string[]>();
    for (const x of p) byDay.set(x.date, [...(byDay.get(x.date) ?? []), x.title]);
    for (const t of byDay.values()) expect(new Set(t).size).toBe(t.length);
    expect(p[0].title).toBe("Aralash test");
  });
  it("imtihon sanasi bor: oxirgi kun imtihon, undan 2 kun oldin simulyatsiya, 1 kun oldin yakuniy takrorlash", () => {
    const p = buildPlan({ ...base, examDate: "2026-10-27" });
    expect(p.at(-1)).toMatchObject({ date: "2026-10-27", kind: "EXAM" });
    expect(p.find((x) => x.date === "2026-10-25")?.kind).toBe("SIM");
    expect(p.find((x) => x.date === "2026-10-26")?.kind).toBe("REVIEW");
    expect(Math.max(...p.map((x) => daysBetween(base.today, x.date)))).toBe(10);
  });
  it("o'tib ketgan imtihon sanasi e'tiborga olinmaydi, juda uzoq sana 30 kun bilan cheklanadi", () => {
    expect(new Set(buildPlan({ ...base, examDate: "2026-09-01" }).map((x) => x.date)).size).toBe(7);
    expect(new Set(buildPlan({ ...base, examDate: "2027-06-01" }).map((x) => x.date)).size).toBe(31);
  });
  it("kunlik vazifalar soni vaqtga mos va bir kunda takror bo'lmaydi", () => {
    const p = buildPlan({ ...base, dailyMinutes: 120, weak: [{ topicId: "a", name: "A", percent: 40 }, { topicId: "b", name: "B", percent: 50 }, { topicId: "c", name: "C", percent: 55 }] });
    const perDay = new Map<string, string[]>();
    for (const x of p) perDay.set(x.date, [...(perDay.get(x.date) ?? []), x.title]);
    for (const titles of perDay.values()) { expect(titles.length).toBe(3); expect(new Set(titles).size).toBe(3); }
  });
});

describe("o'zlashtirish tahlili va yo'l xaritasi", () => {
  it("ishonchi past yoki savoli kam mavzu 'zaif' emas, 'natijasi kam' deb ajratiladi", () => {
    const r = splitMastery([
      { topicId: "1", name: "A", correct: 2, total: 10, confidence: "MEDIUM" },
      { topicId: "2", name: "B", correct: 9, total: 10, confidence: "HIGH" },
      { topicId: "3", name: "C", correct: 0, total: 2, confidence: "LOW" },
    ]);
    expect(r.weak).toEqual([{ topicId: "1", name: "A", percent: 20 }]);
    expect(r.thin).toEqual([{ topicId: "3", name: "C" }]);
  });
  it("yo'l xaritasi bosqichlari faqat haqiqiy holatdan hisoblanadi", () => {
    const r = roadmap({ hasGoal: true, hasDiagnostic: true, weakCount: 2, hasMastery: true, checklistTotal: 5, checklistDone: 5, hasSimulation: false });
    expect(r.map((s) => s.done)).toEqual([true, true, false, true, false]);
    const empty = roadmap({ hasGoal: false, hasDiagnostic: false, weakCount: 0, hasMastery: false, checklistTotal: 0, checklistDone: 0, hasSimulation: false });
    expect(empty.every((s) => !s.done)).toBe(true);
  });
});

describe("tekshiruv sxemalari", () => {
  it("reja bandi sanasi to'g'ri bo'lishi kerak", () => {
    expect(planItemInput.safeParse({ date: "2026-10-17", title: "Test" }).success).toBe(true);
    expect(planItemInput.safeParse({ date: "2026-02-31", title: "Test" }).success).toBe(false);
    expect(planItemInput.safeParse({ date: "17.10.2026", title: "Test" }).success).toBe(false);
  });
  it("rasmiy ma'lumot: sana/havola majburiy, tekshirilgan uchun manba nomi kerak, havola faqat https", () => {
    const link = { kind: "LINK", title: "Yo'riqnoma", url: "https://example.uz/x" };
    expect(officialInput.safeParse(link).success).toBe(true);
    expect(officialInput.safeParse({ ...link, url: "http://example.uz" }).success).toBe(false);
    expect(officialInput.safeParse({ kind: "LINK", title: "X" }).success).toBe(false);
    expect(officialInput.safeParse({ kind: "DATE", title: "Imtihon" }).success).toBe(false);
    expect(officialInput.safeParse({ kind: "DATE", title: "Imtihon", date: "2026-11-01" }).success).toBe(true);
    expect(officialInput.safeParse({ ...link, verified: true }).success).toBe(false);
    expect(officialInput.safeParse({ ...link, verified: true, sourceName: "Vazirlik sayti" }).success).toBe(true);
  });
});
