import { describe, expect, it } from "vitest";
import { classifyPages, parseQuestions, parseTableRows, splitInlineOptions } from "./qparse";

const parse = (text: string) => parseQuestions([{ label: "Hujjat", text }]);

describe("savollarni qoidalar bilan ajratish", () => {
  it("oddiy format: raqam, savol, A-D variantlar, «Javob» qatori", () => {
    const r = parse("1. Qaysi biri tub son?\nA) 4\nB) 6\nC) 7\nD) 9\n2. 2+2 nechaga teng?\nA) 3\nB) 4\nC) 5\nD) 6\nJavob: B");
    expect(r.questions).toHaveLength(2);
    expect(r.questions[0]).toMatchObject({ number: 1, text: "Qaysi biri tub son?", qtype: "SINGLE", incomplete: false, inlineAnswer: null });
    expect(r.questions[0].options.map((o) => o.label + o.text)).toEqual(["A4", "B6", "C7", "D9"]);
    expect(r.questions[1].inlineAnswer).toEqual(["B"]);
  });

  it("savol matni va variantlar o'zgartirilmaydi, ko'p qatorli savol birlashadi", () => {
    const r = parse("1. Quyidagi gapni\ndavom ettiring: Ilm — bu\nA) nur\nB) zulmat\n");
    expect(r.questions[0].text).toBe("Quyidagi gapni davom ettiring: Ilm — bu");
    expect(r.questions[0].options).toHaveLength(2);
  });

  it("bir qatordagi variantlar", () => {
    const r = parse("1. 3+4 nechaga teng?\nA) 5 B) 6 C) 7 D) 8");
    expect(r.questions[0].options.map((o) => o.text)).toEqual(["5", "6", "7", "8"]);
  });

  it("variantlar savol qatorining o'zida", () => {
    const r = parse("1. Poytaxt qaysi? A) Toshkent B) Samarqand C) Buxoro");
    expect(r.questions[0].text).toBe("Poytaxt qaysi?");
    expect(r.questions[0].options).toHaveLength(3);
  });

  it("yulduzcha bilan belgilangan to'g'ri variant", () => {
    const r = parse("1. Sutemizuvchini toping.\nA) Baliq\nB) *Kit\nC) Qush");
    expect(r.questions[0].inlineAnswer).toEqual(["B"]);
    expect(r.questions[0].options[1].text).toBe("Kit");
  });

  it("variantlar yetishmasa «incomplete» deb belgilanadi, to'qilmaydi", () => {
    const r = parse("1. Bitta variantli savol?\nA) faqat shu");
    expect(r.questions[0].incomplete).toBe(true);
    expect(r.questions[0].options).toHaveLength(1);
  });

  it("javoblar kaliti bo'limi savollardan ajratiladi", () => {
    const r = parse("1. Birinchi?\nA) x\nB) y\n2. Ikkinchi?\nA) x\nB) y\nJavoblar\n1-B 2-A");
    expect(r.questions).toHaveLength(2);
    expect(r.keyEntries.map((e) => `${e.number}${e.answers.join("")}`)).toEqual(["1B", "2A"]);
  });

  it("sarlavhasiz kalit ham (3 ta ketma-ket qator) topiladi", () => {
    const r = parse("1. Bir?\nA) a\nB) b\n2. Ikki?\nA) a\nB) b\n3. Uch?\nA) a\nB) b\n1-A\n2-B\n3-A");
    expect(r.questions).toHaveLength(3);
    expect(r.keyEntries).toHaveLength(3);
  });

  it("yil yoki katta raqam bilan boshlangan matn yangi savol bo'lmaydi", () => {
    const r = parse("1. Qachon tug'ilgan?\n1990. yilda deb yozilgan\nA) 1990\nB) 1991");
    expect(r.questions).toHaveLength(1);
    expect(r.questions[0].options).toHaveLength(2);
  });

  it("kirill (А Б В Г) variantlar lotin yorliqqa o'tadi", () => {
    const r = parse("1. Столица?\nА) Москва\nБ) Ташкент\nВ) Минск\nГ) Киев");
    expect(r.questions[0].options.map((o) => o.label).join("")).toBe("ABCD");
    expect(r.questions[0].options[1].text).toBe("Ташкент");
  });

  it("raqamlash qayta boshlansa yangi bo'lim", () => {
    const r = parse("1. A?\nA) 1\nB) 2\n2. B?\nA) 1\nB) 2\n1. C?\nA) 1\nB) 2");
    expect(r.questions.map((q) => q.section)).toEqual([0, 0, 1]);
  });

  it("variantsiz savol turlari", () => {
    const r = parse("1. Quyidagilarni moslang: ...\n2. Bo'sh joyni to'ldiring: Ilm ____ .");
    expect(r.questions.map((q) => q.qtype)).toEqual(["MATCHING", "SHORT"]);
  });
});

describe("jadvaldan savollar", () => {
  it("sarlavhali jadval: № | Savol | A | B | C | D | Javob", () => {
    const rows = [["№", "Savol", "A", "B", "C", "D", "Javob"], ["1", "2+2?", "3", "4", "5", "6", "B"], ["2", "3+3?", "5", "6", "7", "8", "b"]];
    const qs = parseTableRows(rows, "latin", "Varaq «T»");
    expect(qs).toHaveLength(2);
    expect(qs![0]).toMatchObject({ number: 1, text: "2+2?", inlineAnswer: ["B"], page: "Varaq «T»" });
    expect(qs![1].inlineAnswer).toEqual(["B"]);
  });
  it("sarlavhasiz jadval: raqam, savol, variantlar", () => {
    const rows = [["1", "Savol bir", "a", "b", "c"], ["2", "Savol ikki", "d", "e", "f"]];
    const qs = parseTableRows(rows, "latin", null);
    expect(qs).toHaveLength(2);
    expect(qs![0].options).toHaveLength(3);
  });
  it("jadval savol jadvaliga o'xshamasa null", () => { expect(parseTableRows([["Ism", "Yosh"], ["Ali", "20"]], "latin", null)).toBeNull(); });
  it("matn ichidagi jadval qatorlari savol sifatida o'qiladi", () => {
    const r = parse("№ | Savol | A | B | Javob\n1 | Bir? | x | y | A\n2 | Ikki? | x | y | B");
    expect(r.questions).toHaveLength(2);
    expect(r.questions[1].inlineAnswer).toEqual(["B"]);
  });
});

describe("yordamchilar", () => {
  it("splitInlineOptions A dan boshlanib ketma-ket bo'lsa ishlaydi", () => {
    expect(splitInlineOptions("A) bir B) ikki C) uch", "latin")?.opts).toHaveLength(3);
    expect(splitInlineOptions("B) bir C) ikki", "latin")).toBeNull();
    expect(splitInlineOptions("oddiy matn", "latin")).toBeNull();
  });
  it("sahifalar mazmun turi bo'yicha oraliqlarga birlashadi", () => {
    const r = classifyPages([{ label: "1", questions: 0, keyLines: 0, chars: 900 }, { label: "2", questions: 0, keyLines: 0, chars: 800 }, { label: "3", questions: 5, keyLines: 0, chars: 700 }, { label: "4", questions: 0, keyLines: 6, chars: 80 }]);
    expect(r).toEqual([{ kind: "THEORY", from: 1, to: 2 }, { kind: "QUESTIONS", from: 3, to: 3 }, { kind: "ANSWER_KEY", from: 4, to: 4 }]);
  });
});
