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

describe("ikki ustunli variantlar bitta variantga qo'shilib ketmaydi", () => {
  it("«A) .. B) ..» va keyingi qatorda «C) .. D) ..»", () => {
    const r = parse("1. BC ni toping.\nA) 30 cm\tB) 40 cm\nC) 40,2 cm\tD) 42 cm\n2. Keyingi?\nA) x\nB) y");
    expect(r.questions).toHaveLength(2);
    expect(r.questions[0].options.map((o) => `${o.label}:${o.text}`)).toEqual(["A:30 cm", "B:40 cm", "C:40,2 cm", "D:42 cm"]);
    expect(r.questions[0].incomplete).toBe(false);
  });

  it("variantlar qator o'rtasidan boshlansa ham (B C yoki C D) ajraladi; bir variant ichidagi o'ralgan matn buzilmaydi", () => {
    const r = parse("1. Savol?\nA) birinchi\nB) ikkinchi C) uchinchi\nD) to'rtinchi\n2. Boshqa?\nA) bir\nB) ikki variant matni\nuzun davomi\nC) uch");
    expect(r.questions[0].options.map((o) => `${o.label}:${o.text}`)).toEqual(["A:birinchi", "B:ikkinchi", "C:uchinchi", "D:to'rtinchi"]);
    expect(r.questions[1].options.map((o) => o.text)).toEqual(["bir", "ikki variant matni uzun davomi", "uch"]);
  });

  it("variant matni ichidagi «C) ...» o'ralgan davom qatori oldingi variantga qo'shiladi (qator variant yorlig'idan boshlanmasa)", () => {
    expect(splitInlineOptions("matn davomi C) x D) y", "latin", 2)).toBeNull();
    expect(splitInlineOptions("C) x D) y", "latin", 2)?.opts.map((o) => o.label + o.text)).toEqual(["Cx", "Dy"]);
  });

  it("A-D to'rt ustunli bitta qator va Kirill yorliqlar", () => {
    const a = parse("1. Q?\nA) 1  B) 2  C) 3  D) 4");
    expect(a.questions[0].options).toHaveLength(4);
    const b = parse("1. Столица?\nА) Москва\tБ) Ташкент\nВ) Минск\tГ) Киев");
    expect(b.questions[0].options.map((o) => o.label + o.text)).toEqual(["AМосква", "BТашкент", "CМинск", "DКиев"]);
  });
});

describe("savol chegarasi: savol variantlar tugaguncha davom etadi (qat'iy qoida)", () => {
  const STEM = [
    "3. Qaysi javobdagi gapda vergul uch o'rinda tushirib qoldirilgan?",
    "1. Bozor oyoqqa turdi shovqin-suron yer-u ko'kni tutdi.",
    "2. Odamda tasavvur bor: xayoliga nimaningdir yoki kimningdir suratini keltira oladi.",
    "3. Yo'ldan adashsang orqaga qaytishing mumkin ammo so'zdan adashsang hech nima qila olmaysan.",
    "4. Do'stim yo'q demang sizdan yana bir o'ylab ko'rishingizni iltimos qilaman.",
    "To'g'ri javobni aniqlang",
    "A. 1 va 3", "B. 2 va 4", "C. 3 va 4", "D. Faqat 3",
  ];

  it("savol ichidagi 1., 2., 3., 4. gaplar alohida savol bo'lmaydi: A-D variantlar shu savolniki", () => {
    const r = parse(["2. Oldingi savol?", "A) a", "B) b", "C) c", "D) d", ...STEM, "4. Keyingi savol?", "A) x", "B) y", "C) z", "D) w"].join("\n"));
    expect(r.questions.map((q) => q.number)).toEqual([2, 3, 4]);
    const q = r.questions[1];
    expect(q.options.map((o) => `${o.label}:${o.text}`)).toEqual(["A:1 va 3", "B:2 va 4", "C:3 va 4", "D:Faqat 3"]);
    expect(q.qtype).toBe("SINGLE");
    expect(q.incomplete).toBe(false);
    // gaplar o'z tartibida, har biri yangi qatorda; ko'rsatma ham savol matniga kiradi
    expect(q.text.split("\n")).toEqual([
      "Qaysi javobdagi gapda vergul uch o'rinda tushirib qoldirilgan?",
      "1. Bozor oyoqqa turdi shovqin-suron yer-u ko'kni tutdi.",
      "2. Odamda tasavvur bor: xayoliga nimaningdir yoki kimningdir suratini keltira oladi.",
      "3. Yo'ldan adashsang orqaga qaytishing mumkin ammo so'zdan adashsang hech nima qila olmaysan.",
      "4. Do'stim yo'q demang sizdan yana bir o'ylab ko'rishingizni iltimos qilaman.",
      "To'g'ri javobni aniqlang",
    ]);
    // variantlar tugagach raqam tartibida keyingi savol boshlanadi
    expect(r.questions[2].text).toBe("Keyingi savol?");
    expect(r.questions[2].options).toHaveLength(4);
  });

  it("birinchi savolning ichki gaplari ham (raqam 1 bilan to'qnashsa ham) savol matnida qoladi; oxirgi savol ham", () => {
    const r = parse(["1. Qaysi gaplar to'g'ri?", "1. Birinchi gap.", "2. Ikkinchi gap.", "A. 1", "B. 2", "2. Keyingi?", "A. x", "B. y", "3. Oxirgi, ichki gaplar bilan:", "1. gap bir", "2. gap ikki", "A. 1", "B. 2"].join("\n"));
    expect(r.questions.map((q) => q.number)).toEqual([1, 2, 3]);
    expect(r.questions[0].text).toContain("2. Ikkinchi gap.");
    expect(r.questions[0].options).toHaveLength(2);
    expect(r.questions[2].text).toContain("2. gap ikki");
    expect(r.questions[2].options.map((o) => o.text)).toEqual(["1", "2"]);
  });

  it("variantsiz savol alohida qoladi (keyingi savol uning ichki gapi hisoblanmaydi)", () => {
    const r = parse(["1. Bir?", "A) a", "B) b", "2. Variantsiz savol?", "3. Variantli savol?", "A) a", "B) b", "4. Oxirgi?", "A) a", "B) b"].join("\n"));
    expect(r.questions.map((q) => q.number)).toEqual([1, 2, 3, 4]);
    expect(r.questions[1].options).toHaveLength(0);
    expect(r.questions[2].options).toHaveLength(2);
  });

  it("bo'lim sarlavhasi (Test 2) oldidagi variantsiz savol keyingi bo'limga qo'shilib ketmaydi", () => {
    const r = parse(["1. Bir?", "A) a", "B) b", "2. Variantsiz?", "Test 2", "1. Yangi bo'lim savoli?", "A) a", "B) b"].join("\n"));
    expect(r.questions.map((q) => q.number)).toEqual([1, 2, 1]);
  });
});

describe("rasm belgilari (DOCX [[IMG:k]]) savolda o'z joyida qoladi", () => {
  it("savol matni ichidagi belgi so'zdan keyingi joyida saqlanadi", () => {
    const r = parse("5. Shakldagi [[IMG:2]] burchakni toping.\nA) 30\nB) 40");
    expect(r.questions[0].text).toBe("Shakldagi [[IMG:2]] burchakni toping.");
  });

  it("faqat rasmdan iborat qator (savol va variantlar orasida) savol matniga qo'shiladi", () => {
    const r = parse("5. Rasmga qarab toping:\n[[IMG:2]]\nA) 30\nB) 40");
    expect(r.questions[0].text).toBe("Rasmga qarab toping: [[IMG:2]]");
    expect(r.questions[0].options.map((o) => o.text)).toEqual(["30", "40"]);
  });

  it("variant yonida yozuv bilan birga kelgan rasm savolga tegishli: savol matni oxiriga ko'chadi", () => {
    const r = parse("16. ABCD to'g'ri to'rtburchakning bo'yalgan sohasi 450 cm² ga teng. BC ni toping.\nA) 30 cm\nB) 40 cm [[IMG:1]]\nC) 40,2 cm\nD) 42 cm");
    const q = r.questions[0];
    expect(q.text).toBe("ABCD to'g'ri to'rtburchakning bo'yalgan sohasi 450 cm² ga teng. BC ni toping. [[IMG:1]]");
    expect(q.options.map((o) => o.text)).toEqual(["30 cm", "40 cm", "40,2 cm", "42 cm"]);
  });

  it("variantning o'zi rasm bo'lsa: rasm savol matniga variant harfi bilan qo'shiladi (variantlarda rasm ko'rsatilmaydi)", () => {
    const r = parse("7. Qaysi shakl uchburchak?\nA) [[IMG:3]]\nB) [[IMG:4]]\nC) [[IMG:5]]");
    const q = r.questions[0];
    expect(q.text).toBe("Qaysi shakl uchburchak?\nA) [[IMG:3]]\nB) [[IMG:4]]\nC) [[IMG:5]]");
    expect(q.options.map((o) => o.text)).toEqual(["(rasm)", "(rasm)", "(rasm)"]);
    expect(q.note).toMatch(/rasm/);
    expect(q.incomplete).toBe(false);
  });

  it("qator boshidagi rasm belgisi savol raqamini yashirmaydi", () => {
    const r = parse("[[IMG:4]]7. Rasmdagi uchburchak yuzi?\nA) 1\nB) 2");
    expect(r.questions[0].number).toBe(7);
    expect(r.questions[0].text).toContain("[[IMG:4]]");
    expect(r.questions[0].options).toHaveLength(2);
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
