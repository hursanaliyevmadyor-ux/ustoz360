import { describe, expect, it } from "vitest";
import {
  aiQuestionSchema, allocate, checkAiQuestion, extractJson, headline, localVariantsAnalysis, masteryState, nextStep, parseConfig, policyOf, rationaleReply, skillStats,
  startInput, summarizeTopics, textReply, timeOptions, variantsReply, weakWeight,
} from "./practicelogic";

describe("rejimlar va taymer", () => {
  it("vaqtli va aralash test yakunda tekshiriladi, qolganlari darhol", () => {
    expect(policyOf("timed")).toBe("deferred");
    expect(policyOf("mixed")).toBe("deferred");
    for (const k of ["quick", "topic", "ai", "errors", "topictest", "situational"] as const) expect(policyOf(k)).toBe("instant");
  });
  it("start so'rovi yangi maydonlarni qabul qiladi va noto'g'rilarini rad etadi", () => {
    expect(startInput.safeParse({ kind: "timed", count: 15, durationMin: 20 }).success).toBe(true);
    expect(startInput.safeParse({ kind: "mixed", topicIds: ["a", "b"], distribution: "weak" }).success).toBe(true);
    expect(startInput.safeParse({ kind: "errors", variant: "new" }).success).toBe(true);
    expect(startInput.safeParse({ kind: "timed", durationMin: 0 }).success).toBe(false);
    expect(startInput.safeParse({ kind: "timed", durationMin: 181 }).success).toBe(false);
    expect(startInput.safeParse({ kind: "errors", variant: "other" }).success).toBe(false);
    expect(startInput.safeParse({ kind: "quick", count: 7 }).success).toBe(false);
  });
  it("savollar soniga mos vaqt taklif qilinadi", () => {
    expect(timeOptions(10)).toEqual([10, 15, 20]);
    expect(timeOptions(5)).toEqual([5, 10]);
    expect(timeOptions(30)).toEqual([30, 45, 60]);
  });
  it("yakunda tekshiriladigan sessiya javoblari va belgilari config'da saqlanadi", () => {
    const c = parseConfig({ v: 1, kind: "timed", policy: "deferred", durationSec: 600, answers: { q1: { o: "a", t: 1 } }, flags: { q1: true } });
    expect(c.answers.q1.o).toBe("a");
    expect(c.flags.q1).toBe(true);
    expect(parseConfig({ v: 1, kind: "quick" }).policy).toBe("instant");
    expect(parseConfig({ v: 1, kind: "quick" }).durationSec).toBeNull();
  });
});

describe("aralash test taqsimoti", () => {
  const sum = (o: Record<string, number>) => Object.values(o).reduce((a, b) => a + b, 0);
  it("teng og'irlikda savollar mavzular o'rtasida teng bo'linadi", () => {
    const r = allocate(20, [{ id: "a", weight: 1, cap: 50 }, { id: "b", weight: 1, cap: 50 }, { id: "c", weight: 1, cap: 50 }, { id: "d", weight: 1, cap: 50 }]);
    expect(r).toEqual({ a: 5, b: 5, c: 5, d: 5 });
  });
  it("jami son bo'linmasa, farq bittadan oshmaydi", () => {
    const r = allocate(10, [{ id: "a", weight: 1, cap: 50 }, { id: "b", weight: 1, cap: 50 }, { id: "c", weight: 1, cap: 50 }]);
    expect(sum(r)).toBe(10);
    expect(Math.max(...Object.values(r)) - Math.min(...Object.values(r))).toBeLessThanOrEqual(1);
  });
  it("mavzuda savol yetmasa, qolgani boshqa mavzulardan olinadi va bazadagidan ko'p berilmaydi", () => {
    const r = allocate(12, [{ id: "a", weight: 1, cap: 2 }, { id: "b", weight: 1, cap: 50 }, { id: "c", weight: 1, cap: 50 }]);
    expect(r.a).toBe(2);
    expect(sum(r)).toBe(12);
    expect(sum(allocate(100, [{ id: "a", weight: 1, cap: 3 }, { id: "b", weight: 1, cap: 4 }]))).toBe(7);
  });
  it("zaif mavzu ko'proq savol oladi", () => {
    const r = allocate(12, [{ id: "weak", weight: weakWeight({ correct: 1, total: 10 }), cap: 50 }, { id: "strong", weight: weakWeight({ correct: 9, total: 10 }), cap: 50 }]);
    expect(r.weak).toBeGreaterThan(r.strong);
    expect(weakWeight(undefined)).toBeGreaterThan(weakWeight({ correct: 9, total: 10 }));
  });
});

describe("tushunchalar tahlili va aniq tavsiya", () => {
  const rows = [
    { skill: "refleksiya", isCorrect: false }, { skill: "refleksiya", isCorrect: false }, { skill: "differensiatsiya", isCorrect: false },
    { skill: "sinf boshqaruvi", isCorrect: true }, { skill: null, isCorrect: false },
  ];
  it("faqat ko'nikmasi bor savollar sanaladi", () => {
    const s = skillStats(rows);
    expect(s.find((x) => x.skill === "refleksiya")).toEqual({ skill: "refleksiya", correct: 0, total: 2 });
    expect(s.length).toBe(3);
  });
  it("tavsiya qaysi tushunchada necha marta adashilganini aytadi", () => {
    const n = nextStep([{ topicId: "t", name: "T", correct: 1, total: 5 }], 4, skillStats(rows));
    expect(n.action).toBe("skills");
    expect(n.skills).toEqual(["refleksiya", "differensiatsiya"]);
    expect(n.text).toContain("«refleksiya»");
    expect(n.text).toMatch(/marta adashdingiz/);
  });
  it("xato bo'lmasa tavsiya xaritaga yo'naltiradi", () => {
    expect(nextStep([], 0, [{ skill: "x", correct: 2, total: 2 }]).action).toBe("map");
  });
  it("asoslash tahlili sxemasi: ko'pi bilan 3 ta band va noaniqlik matni", () => {
    expect(rationaleReply.safeParse({ strengths: ["a"], improve: ["b"], uncertainty: "Asoslash qisqa." }).success).toBe(true);
    expect(rationaleReply.safeParse({ strengths: ["1", "2", "3", "4"] }).success).toBe(false);
    expect(rationaleReply.safeParse({}).success).toBe(true);
  });
});

describe("mashq boshlash so'rovi", () => {
  it("savollar soni faqat 5/10/20/30/50 bo'lishi mumkin", () => {
    for (const n of [5, 10, 20, 30, 50]) expect(startInput.safeParse({ kind: "topic", count: n }).success).toBe(true);
    for (const n of [0, 3, 7, 100]) expect(startInput.safeParse({ kind: "topic", count: n }).success).toBe(false);
  });
  it("noma'lum tur va qiyinlik rad etiladi", () => {
    expect(startInput.safeParse({ kind: "exam" }).success).toBe(false);
    expect(startInput.safeParse({ kind: "quick", difficulty: "IMPOSSIBLE" }).success).toBe(false);
    expect(startInput.safeParse({ kind: "quick", difficulty: "MIXED" }).success).toBe(true);
  });
});

describe("mashq sozlamalari (config)", () => {
  it("buzilgan yoki bo'sh config xavfsiz standart qiymatga qaytadi", () => {
    expect(parseConfig(null).kind).toBe("topic");
    expect(parseConfig({ kind: 5 }).hints).toEqual({});
    const c = parseConfig({ v: 1, kind: "quick", order: { q1: ["a", "b"] } });
    expect(c.order.q1).toEqual(["a", "b"]);
    expect(c.reinforce).toEqual({});
  });
});

describe("bilim xaritasi holatlari", () => {
  const base = { total: 0, correct: 0, openErrors: 0, nonEasyCorrect: 0 };
  it("hali savol yechilmagan mavzu: «mashq qilinmagan»", () => expect(masteryState(base)).toBe("NEW"));
  it("kam savol bo'lsa, hammasi to'g'ri bo'lsa ham «o'rganilmoqda»", () => {
    expect(masteryState({ ...base, total: 3, correct: 3 })).toBe("LEARNING");
  });
  it("past aniqlik: «o'rganilmoqda»", () => expect(masteryState({ ...base, total: 10, correct: 4 })).toBe("LEARNING"));
  it("yetarli savol va yaxshi natija, lekin ochiq xato bor: «mustahkamlanmoqda»", () => {
    expect(masteryState({ total: 10, correct: 9, openErrors: 1, nonEasyCorrect: 5 })).toBe("REINFORCING");
  });
  it("faqat oson savollar to'g'ri bo'lsa, eng yuqori holat berilmaydi", () => {
    expect(masteryState({ total: 12, correct: 12, openErrors: 0, nonEasyCorrect: 0 })).toBe("REINFORCING");
  });
  it("barqaror natija: ko'p savol, yuqori aniqlik, ochiq xato yo'q, murakkab savollar ham to'g'ri", () => {
    expect(masteryState({ total: 12, correct: 11, openErrors: 0, nonEasyCorrect: 4 })).toBe("STABLE");
  });
});

describe("natija xulosasi", () => {
  const stats = [{ topicId: "a", name: "A", correct: 4, total: 4 }, { topicId: "b", name: "B", correct: 1, total: 4 }, { topicId: "c", name: "C", correct: 3, total: 4 }];
  it("kuchli va mustahkamlash kerak mavzular ajratiladi", () => {
    const s = summarizeTopics(stats);
    expect(s.strengths).toEqual(["A", "C"]);
    expect(s.toReinforce).toEqual(["B"]);
  });
  it("keyingi qadam eng zaif mavzuni tavsiya qiladi", () => {
    expect(nextStep(stats, 4)).toMatchObject({ action: "topic", topicId: "b" });
    expect(nextStep([{ topicId: "a", name: "A", correct: 4, total: 4 }], 0).action).toBe("map");
  });
  it("sarlavha natijaga mos, past natijada ham ayblamaydi", () => {
    expect(headline(90).title).toMatch(/yaxshi/i);
    expect(headline(20).title).not.toMatch(/yomon|fail|natija past/i);
  });
});

describe("AI javobini tekshirish", () => {
  it("JSON ```json bloki ichida yoki matn orasida bo'lsa ham ajratib olinadi", () => {
    expect(extractJson('```json\n{"text":"salom"}\n```')).toEqual({ text: "salom" });
    expect(extractJson('Mana javob: {"text":"x"} rahmat')).toEqual({ text: "x" });
    expect(extractJson("oddiy matn")).toBeNull();
    expect(extractJson("{buzuq json")).toBeNull();
  });
  it("matnli va variantlar javobi sxemadan o'tadi/o'tmaydi", () => {
    expect(textReply.safeParse({ text: "izoh" }).success).toBe(true);
    expect(textReply.safeParse({ text: "" }).success).toBe(false);
    expect(textReply.safeParse({ nimadir: 1 }).success).toBe(false);
    expect(variantsReply.safeParse({ items: [{ label: "A", correct: true, why: "to'g'ri" }, { label: "B", correct: false, why: "noto'g'ri" }] }).success).toBe(true);
    expect(variantsReply.safeParse({ items: [{ label: "A", correct: "ha", why: "x" }] }).success).toBe(false);
  });
  const orig = { text: "Formativ baholash qachon o'tkaziladi va nima uchun?", options: ["A variant", "B variant", "C variant", "D variant"] };
  const good = { text: "Dars oxirida o'qituvchi o'quvchilar javoblarini ko'rib, keyingi darsni o'zgartirdi. Bu qaysi baholash?", options: ["Formativ", "Summativ", "Diagnostik", "Rasmiy"], correctIndex: 0, explanation: "Natija o'qitishni moslashtirish uchun ishlatilgan." };
  it("yaxshi AI savoli qabul qilinadi", () => {
    expect(aiQuestionSchema.safeParse(good).success).toBe(true);
    expect(checkAiQuestion(good, orig)).toBeNull();
  });
  it("savol soni 4 ta variant bo'lmasa, to'g'ri indeks chegaradan chiqsa rad etiladi", () => {
    expect(aiQuestionSchema.safeParse({ ...good, options: ["a", "b", "c"] }).success).toBe(false);
    expect(aiQuestionSchema.safeParse({ ...good, correctIndex: 4 }).success).toBe(false);
  });
  it("asl savol nusxasi, takroriy variantlar va «barchasi» turidagi variantlar rad etiladi", () => {
    expect(checkAiQuestion({ ...good, text: orig.text.toUpperCase() }, orig)).toMatch(/nusxa/);
    expect(checkAiQuestion({ ...good, options: ["Bir", "bir", "Ikki", "Uch"] }, orig)).toMatch(/takrorlan/);
    expect(checkAiQuestion({ ...good, options: ["Bir", "Ikki", "Uch", "Barcha javoblar to'g'ri"] }, orig)).toMatch(/barchasi/);
    expect(checkAiQuestion({ ...good, options: orig.options }, orig)).toMatch(/ko'chirilgan/);
  });
  it("AI ishlamaganda variantlar tahlili faqat saqlangan kalitga tayanadi", () => {
    const r = localVariantsAnalysis([{ label: "A", text: "x", isCorrect: false }, { label: "B", text: "y", isCorrect: true }], "Izoh matni.");
    expect(r.find((i) => i.correct)?.label).toBe("B");
    expect(r.find((i) => i.correct)?.why).toContain("Izoh matni.");
    expect(r.find((i) => !i.correct)?.why).not.toContain("Izoh matni.");
  });
});
