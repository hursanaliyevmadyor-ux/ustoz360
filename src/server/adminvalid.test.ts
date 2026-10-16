import { describe, expect, it } from "vitest";
import { bankQuestionInput, deriveKind, examInput, questionInput, seminarInput, slugify } from "./adminvalid";

describe("savol kiritish (admin)", () => {
  it("variantli savol: 2 dan 8 gacha variant, to'g'ri variant ichkarida bo'lishi shart", () => {
    const base = { type: "CHOICE" as const, text: "2+2?", options: ["3", "4"], correct: 1 };
    expect(questionInput.safeParse(base).success).toBe(true);
    expect(questionInput.safeParse({ ...base, options: ["3"] }).success).toBe(false);
    expect(questionInput.safeParse({ ...base, options: Array(9).fill("x") }).success).toBe(false);
    expect(questionInput.safeParse({ ...base, correct: 2 }).success).toBe(false);
    expect(questionInput.safeParse({ ...base, options: ["3", " "] }).success).toBe(false);
  });
  it("variant soni cheklanmagan emas: 5, 6, 8 ta ham bo'ladi (admin xohlaganicha)", () => {
    for (const n of [2, 3, 5, 6, 8]) expect(questionInput.safeParse({ type: "CHOICE", text: "?", options: Array.from({ length: n }, (_, i) => `v${i}`), correct: 0 }).success).toBe(true);
  });
  it("yozma savol: kamida bitta qabul qilinadigan javob kerak, variantlar bo'lmaydi", () => {
    expect(questionInput.safeParse({ type: "WRITTEN", text: "Poytaxt?", accepted: ["Toshkent"] }).success).toBe(true);
    expect(questionInput.safeParse({ type: "WRITTEN", text: "Poytaxt?", accepted: [] }).success).toBe(false);
    expect(questionInput.safeParse({ type: "WRITTEN", text: "Poytaxt?", accepted: ["  "] }).success).toBe(false);
  });
  it("bo'sh savol matni va noma'lum tur rad etiladi", () => {
    expect(questionInput.safeParse({ type: "CHOICE", text: "  ", options: ["a", "b"], correct: 0 }).success).toBe(false);
    expect(questionInput.safeParse({ type: "ESSE", text: "x" }).success).toBe(false);
  });
});

describe("imtihon va seminar maydonlari", () => {
  it("imtihon: vaqt 1–300 daqiqa", () => {
    const ok = { title: "Mat", subject: "Matematika", durationMin: 30 };
    expect(examInput.safeParse(ok).success).toBe(true);
    expect(examInput.safeParse({ ...ok, durationMin: 0 }).success).toBe(false);
    expect(examInput.safeParse({ ...ok, durationMin: 301 }).success).toBe(false);
    expect(examInput.safeParse({ ...ok, pickCount: null }).success).toBe(true);
  });
  it("seminar: sana majburiy, havola faqat http(s)", () => {
    const ok = { title: "Seminar", startsAt: "2026-11-01T10:00:00.000Z" };
    expect(seminarInput.safeParse(ok).success).toBe(true);
    expect(seminarInput.safeParse({ ...ok, startsAt: "ertaga" }).success).toBe(false);
    expect(seminarInput.safeParse({ ...ok, link: "javascript:alert(1)" }).success).toBe(false);
    expect(seminarInput.safeParse({ ...ok, link: "https://zoom.us/j/123" }).success).toBe(true);
    expect(seminarInput.safeParse({ ...ok, link: "" }).success).toBe(true);
  });
});

describe("savollar banki (mashq)", () => {
  const ok = { topicId: "t1", text: "Savol?", options: ["A", "B", "C"], correct: 1, explanation: "Izoh", difficulty: "MEDIUM" as const, status: "DRAFT" as const };
  it("to'g'ri savol qabul qilinadi, super kalit va manba ixtiyoriy", () => {
    expect(bankQuestionInput.safeParse(ok).success).toBe(true);
    expect(bankQuestionInput.safeParse({ ...ok, superKey: "Qoida", sourceRef: "" }).success).toBe(true);
  });
  it("izoh majburiy, variantlar 2–6 ta, to'g'ri variant ichkarida va variantlar takrorlanmaydi", () => {
    expect(bankQuestionInput.safeParse({ ...ok, explanation: " " }).success).toBe(false);
    expect(bankQuestionInput.safeParse({ ...ok, options: ["A"] }).success).toBe(false);
    expect(bankQuestionInput.safeParse({ ...ok, options: Array.from({ length: 7 }, (_, i) => `v${i}`) }).success).toBe(false);
    expect(bankQuestionInput.safeParse({ ...ok, correct: 3 }).success).toBe(false);
    expect(bankQuestionInput.safeParse({ ...ok, options: ["A", "a", "B"] }).success).toBe(false);
  });
  it("noma'lum holat va qiyinlik rad etiladi", () => {
    expect(bankQuestionInput.safeParse({ ...ok, status: "PUBLISHED" }).success).toBe(false);
    expect(bankQuestionInput.safeParse({ ...ok, difficulty: "EXTREME" }).success).toBe(false);
  });
});

describe("deriveKind va slugify", () => {
  it("imtihon turi savollar turidan aniqlanadi", () => {
    expect(deriveKind(["CHOICE", "CHOICE"])).toBe("TEST");
    expect(deriveKind(["WRITTEN"])).toBe("WRITTEN");
    expect(deriveKind(["CHOICE", "WRITTEN"])).toBe("MIXED");
    expect(deriveKind([])).toBe("TEST");
  });
  it("manzil uchun nom: lotin harf, raqam va chiziqcha", () => {
    expect(slugify("O'zbek tili: 5-sinf!")).toBe("ozbek-tili-5-sinf");
    expect(slugify("  ")).toBe("nom");
    expect(slugify("Matematika  (2-qism)")).toBe("matematika-2-qism");
  });
});
