import { describe, expect, it } from "vitest";
import { normalizeAiKey, normalizeAiQuestions } from "./aischema";
import { isKeyNoteLine, parseAnswerKey } from "./keyparse";
import { parseQuestions } from "./qparse";
import { matchKeys } from "./verifylogic";

const parse = (text: string) => parseQuestions([{ label: "Hujjat", text }]);

describe("javoblar kalitidagi izoh", () => {
  it("«1-B. Izoh: ...», «2) C — ...», «Yechim: ...» qatori, jadval katagi va izoh davomi o'qiladi", () => {
    const text = [
      "1-B. Izoh: Navoiy 1441-yilda tug'ilgan.", "Davomi shu yerda.",
      "2) C — Chunki uchburchak burchaklari yig'indisi 180 daraja.",
      "3-A", "Yechim: 2+2 = 4",
      "", "4 | D | Jadvaldagi izoh matni",
      "5-10: ABCDAB",
    ].join("\n");
    const r = parseAnswerKey(text);
    const by = (n: number) => r.entries.find((e) => e.number === n)!;
    expect(by(1)).toMatchObject({ answers: ["B"], explanation: "Navoiy 1441-yilda tug'ilgan. Davomi shu yerda." });
    expect(by(2)).toMatchObject({ answers: ["C"], explanation: "Chunki uchburchak burchaklari yig'indisi 180 daraja." });
    expect(by(3)).toMatchObject({ answers: ["A"], explanation: "2+2 = 4" });
    expect(by(4)).toMatchObject({ answers: ["D"], explanation: "Jadvaldagi izoh matni" });
    expect(by(5).explanation).toBeUndefined();
    expect(r.entries.map((e) => e.number)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });

  it("oddiy kalit qatorlari izoh deb olinmaydi", () => {
    const r = parseAnswerKey("1-A  2-C  3-B\n4.D 5.A\n1 | A | 2 | B\n6-10: ABCDA");
    expect(r.entries.every((e) => e.explanation === undefined)).toBe(true);
    expect(r.entries).toHaveLength(12); // 3 + 2 + 2 (jadval) + 5 (oraliq)
    expect(isKeyNoteLine("1-A 2-B 3-C 4-D")).toBe(false);
    expect(isKeyNoteLine("1-B. Izoh: bu to'g'ri chunki...")).toBe(true);
  });

  it("matchKeys izohni kalit yozuvidan qaytaradi; savol yonidagi javob kalitdan farq qilsa izoh olinmaydi", () => {
    const entries = [{ number: 1, answers: ["B"], section: 0, explanation: "Birinchi izoh" }, { number: 2, answers: ["C"], section: 0, explanation: "Ikkinchi izoh" }, { number: 3, answers: ["A"], section: 0 }];
    const m = matchKeys([
      { number: 1, section: 0, inlineAnswer: null },
      { number: 2, section: 0, inlineAnswer: ["D"] },
      { number: 3, section: 0, inlineAnswer: null },
    ], entries);
    expect(m[0]).toMatchObject({ key: ["B"], keySource: "SEPARATE_FILE", explanation: "Birinchi izoh" });
    expect(m[1].conflict).toBeTruthy();
    expect(m[1].explanation).toBeUndefined();
    expect(m[2].explanation).toBeUndefined();
  });

  it("test sarlavhasi (group) bo'yicha kalitda ham izoh topiladi", () => {
    const entries = [{ number: 5, answers: ["D"], section: 0, group: "Test No: 2", explanation: "Beshinchi izoh" }];
    const m = matchKeys([{ number: 5, section: 0, inlineAnswer: null, group: "test no 2" }], entries);
    expect(m[0]).toMatchObject({ key: ["D"], explanation: "Beshinchi izoh" });
  });
});

describe("savol yonidagi izoh (Javob: B ... Izoh: ...)", () => {
  it("alohida «Izoh:» qatori va uning davomi savolga izoh bo'ladi, keyingi savol alohida", () => {
    const r = parse(["1. Poytaxt qaysi?", "A) Toshkent", "B) Samarqand", "Javob: A", "Izoh: Toshkent 1930-yildan", "poytaxt.", "2. Ikkinchi?", "A) x", "B) y"].join("\n"));
    expect(r.questions).toHaveLength(2);
    expect(r.questions[0].inlineAnswer).toEqual(["A"]);
    expect(r.questions[0].explanation).toBe("Toshkent 1930-yildan poytaxt.");
    expect(r.questions[1].explanation).toBeUndefined();
  });

  it("«Javob: B. Izoh: ...» bir qatorda", () => {
    const r = parse("1. 2+2?\nA) 3\nB) 4\nJavob: B. Izoh: ikkini ikkiga qo'shamiz.");
    expect(r.questions[0].inlineAnswer).toEqual(["B"]);
    expect(r.questions[0].explanation).toBe("ikkini ikkiga qo'shamiz.");
  });

  it("«Javoblar» bo'limidagi izohli qatorlar savol bo'lib ketmaydi va kalitga o'tadi", () => {
    const r = parse(["1. Bir?", "A) a", "B) b", "2. Ikki?", "A) a", "B) b", "Javoblar", "1-B. Izoh: birinchi savolning izohi.", "2-A. Izoh: ikkinchi savolning izohi."].join("\n"));
    expect(r.questions).toHaveLength(2);
    expect(r.keyEntries.map((e) => `${e.number}${e.answers.join("")}:${e.explanation}`)).toEqual(["1B:birinchi savolning izohi.", "2A:ikkinchi savolning izohi."]);
  });
});

describe("AI natijasidagi izoh", () => {
  it("kalit va savol izohi me'yorlanadi (ortiqcha bo'sh joy olib tashlanadi, bo'sh izoh tashlanadi)", () => {
    const k = normalizeAiKey([{ number: 1, answer: "B", explanation: "  Izoh   matni \n davomi " }, { number: 2, answer: ["C"], explanation: "   " }, { number: 3, answer: "A" }]);
    expect(k).toEqual([{ number: 1, answers: ["B"], group: null, explanation: "Izoh matni davomi" }, { number: 2, answers: ["C"], group: null }, { number: 3, answers: ["A"], group: null }]);
    const q = normalizeAiQuestions([{ number: 1, text: "Savol?", options: [{ label: "A", text: "x" }, { label: "B", text: "y" }], explanation: "Yechim:  qisqa" }]);
    expect(q[0].explanation).toBe("Yechim: qisqa");
  });
});
