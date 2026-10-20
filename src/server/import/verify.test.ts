import { describe, expect, it } from "vitest";
import { normalizeAiKey, normalizeAiQuestions, labelsOf, normalizeDifficulty, normalizeType } from "./aischema";
import { buildTextChunks, pageRanges, pdfPageCountGuess, questionRanges } from "./chunking";
import { checkArithmetic, evalArithmetic, findExpression, optionNumber } from "./mathcheck";
import { contentHash, decide, matchKeys, matchTopic, NOT_VERIFIED_TEXT, similarity, type DecideInput } from "./verifylogic";

const opts = (n = 4) => ["A", "B", "C", "D", "E"].slice(0, n).map((label) => ({ label, text: `variant ${label}` }));
const base: DecideInput = { qtype: "SINGLE", incomplete: false, options: opts(), ocrUncertain: false, key: null, keySource: null, ai: null, aiTried: false, computed: null, support: null };
const d = (o: Partial<DecideInput>) => decide({ ...base, ...o });

describe("javobni tekshirish qarori", () => {
  it("kalit + mustaqil AI mos: tasdiqlangan, tayyor", () => {
    expect(d({ key: ["B"], keySource: "INLINE", ai: { answer: ["B"], confidence: "high" } })).toMatchObject({ verificationStatus: "CONFIRMED", reviewStatus: "READY", origin: "FILE_KEY", proposed: ["B"] });
  });
  it("kalit va AI farq qilsa: ziddiyat (kalit tasdiq emas)", () => {
    const r = d({ key: ["B"], keySource: "SEPARATE_FILE", ai: { answer: ["C"], confidence: "high" } });
    expect(r).toMatchObject({ verificationStatus: "CONFLICT", reviewStatus: "CONFLICT", origin: "SEPARATE_KEY" });
    expect(r.note).toMatch(/farq qiladi/);
  });
  it("AI ishonchi past bo'lsa ziddiyat emas, tekshirish kerak", () => {
    expect(d({ key: ["B"], keySource: "INLINE", ai: { answer: ["C"], confidence: "low" } })).toMatchObject({ verificationStatus: "PROPOSED", reviewStatus: "NEEDS_REVIEW" });
  });
  it("kalit bor, AI yo'q: fayldagi kalit mustaqil tekshirilmagan (tayyor emas)", () => {
    expect(d({ key: ["A"], keySource: "INLINE" })).toMatchObject({ verificationStatus: "PROPOSED", reviewStatus: "NEEDS_REVIEW", origin: "FILE_KEY" });
  });
  it("kalit yo'q, AI taklifi manbasiz: tekshirish kerak; manba bilan va ishonch yuqori: tayyor", () => {
    expect(d({ ai: { answer: ["D"], confidence: "high" } })).toMatchObject({ verificationStatus: "PROPOSED", reviewStatus: "NEEDS_REVIEW", origin: "AI" });
    expect(d({ ai: { answer: ["D"], confidence: "high" }, support: "WEB" })).toMatchObject({ reviewStatus: "READY", origin: "WEB" });
  });
  it("javob topilmasa: «Javob tasdiqlanmadi — qo'lda tekshirish kerak.»", () => {
    expect(d({})).toMatchObject({ verificationStatus: "NOT_FOUND", reviewStatus: "NO_ANSWER", note: NOT_VERIFIED_TEXT });
    expect(d({ ai: { answer: ["A"], confidence: "low" } })).toMatchObject({ reviewStatus: "NO_ANSWER" });
  });
  it("deterministik hisob: tasdiqlaydi yoki kalit bilan ziddiyatni ochadi", () => {
    expect(d({ computed: ["B"] })).toMatchObject({ verificationStatus: "CONFIRMED", reviewStatus: "READY", origin: "COMPUTED" });
    expect(d({ computed: ["B"], key: ["C"], keySource: "INLINE" })).toMatchObject({ reviewStatus: "CONFLICT", proposed: ["B"] });
    expect(d({ computed: ["B"], key: ["B"], keySource: "INLINE" })).toMatchObject({ reviewStatus: "READY" });
  });
  it("kalitda bir nechta javob yoki mavjud bo'lmagan variant: ziddiyat", () => {
    expect(d({ key: ["A", "B"], keySource: "INLINE" })).toMatchObject({ reviewStatus: "CONFLICT" });
    expect(d({ key: ["E"], keySource: "INLINE" })).toMatchObject({ reviewStatus: "CONFLICT" });
  });
  it("AI bir nechta javob ko'rsatsa, majburan bittasi tanlanmaydi", () => {
    expect(d({ ai: { answer: ["A", "B"], confidence: "high" } })).toMatchObject({ reviewStatus: "NO_ANSWER", proposed: null });
  });
  it("to'liq bo'lmagan, mos kelmaydigan tur va noaniq OCR", () => {
    expect(d({ incomplete: true })).toMatchObject({ reviewStatus: "INCOMPLETE" });
    expect(d({ qtype: "MATCHING" })).toMatchObject({ reviewStatus: "UNSUPPORTED" });
    expect(d({ qtype: "MULTI", key: ["A", "C"], keySource: "INLINE" })).toMatchObject({ reviewStatus: "UNSUPPORTED", proposed: ["A", "C"] });
    expect(d({ key: ["B"], keySource: "INLINE", ai: { answer: ["B"], confidence: "high" }, ocrUncertain: true })).toMatchObject({ verificationStatus: "CONFIRMED", reviewStatus: "NEEDS_REVIEW" });
  });
});

describe("kalitni savollarga bog'lash", () => {
  const e = (number: number, a: string, section = 0) => ({ number, answers: [a], section });
  it("raqam bo'yicha, savol yonidagi javob ustun va farq bo'lsa ziddiyat qaydi", () => {
    const m = matchKeys([{ number: 1, section: 0, inlineAnswer: null }, { number: 2, section: 0, inlineAnswer: ["C"] }, { number: 3, section: 0, inlineAnswer: ["A"] }, { number: 9, section: 0, inlineAnswer: null }], [e(1, "B"), e(2, "C"), e(3, "D")]);
    expect(m[0]).toEqual({ key: ["B"], keySource: "SEPARATE_FILE" });
    expect(m[1]).toEqual({ key: ["C"], keySource: "INLINE" });
    expect(m[2]).toMatchObject({ key: ["A"], keySource: "INLINE" });
    expect(m[2].conflict).toMatch(/farq qiladi/);
    expect(m[3]).toEqual({ key: null, keySource: null });
  });
  it("bo'limlar soni mos bo'lsa bo'limma-bo'lim, bitta kalit bo'lsa faqat birinchi bo'limga", () => {
    const qs = [{ number: 1, section: 0, inlineAnswer: null }, { number: 1, section: 1, inlineAnswer: null }];
    expect(matchKeys(qs, [e(1, "A", 0), e(1, "B", 1)]).map((x) => x.key)).toEqual([["A"], ["B"]]);
    expect(matchKeys(qs, [e(1, "A", 0)]).map((x) => x.key)).toEqual([["A"], null]);
  });
});

describe("arifmetik hisob", () => {
  it("ifodalarni hisoblaydi", () => {
    expect(evalArithmetic("12*8+4")).toBe(100);
    expect(evalArithmetic("(15-3)/4")).toBe(3);
    expect(evalArithmetic("2^10")).toBe(1024);
    expect(evalArithmetic("12 × 3 − 4 ÷ 2")).toBe(34);
    expect(evalArithmetic("50%")).toBe(0.5);
    expect(evalArithmetic("-3+5")).toBe(2);
    expect(evalArithmetic("0,5+1,5")).toBe(2);
  });
  it("xavfli yoki noto'g'ri ifodalar rad etiladi", () => {
    for (const bad of ["1/0", "2+", "(1+2", "abc", "process.exit(1)", "2**99999", "1+1; 2", ""]) expect(evalArithmetic(bad)).toBeNull();
  });
  it("savol matnidan ifodani topadi va variant bilan solishtiradi", () => {
    expect(findExpression("12*8+4 = ?")).toBe("12*8+4");
    expect(findExpression("Hisoblang: (15-3)/4")).toBe("(15-3)/4");
    expect(findExpression("12 + 8 nechaga teng?")).toBe("12 + 8");
    expect(findExpression("7 * 6 necha?")).toBe("7 * 6");
    expect(findExpression("Toshkent qaysi davlatning poytaxti?")).toBeNull();
    expect(findExpression("2020")).toBeNull();
    const r = checkArithmetic("12*8+4 = ?", [{ label: "A", text: "96" }, { label: "B", text: "100" }, { label: "C", text: "104" }]);
    expect(r).toMatchObject({ value: 100, match: [1] });
    expect(checkArithmetic("Bu qanday savol", [{ label: "A", text: "1" }])).toBeNull();
  });
  it("variantdagi sonlarni o'qiydi", () => {
    expect(optionNumber("1 250")).toBe(1250);
    expect(optionNumber("3,5")).toBe(3.5);
    expect(optionNumber("-4")).toBe(-4);
    expect(optionNumber("12 sm")).toBe(12);
    expect(optionNumber("o'n ikki")).toBeNull();
  });
});

describe("yordamchilar: xesh, o'xshashlik, mavzu, bo'laklar", () => {
  it("contentHash bo'sh joy va katta-kichik harfga bog'liq emas", () => {
    expect(contentHash("Savol  matni?", opts(2))).toBe(contentHash("savol matni ?", opts(2)));
    expect(contentHash("Boshqa", opts(2))).not.toBe(contentHash("Savol matni?", opts(2)));
  });
  it("similarity", () => {
    expect(similarity("kasrlarni qo'shish qoidasi nima", "kasrlarni qo'shish qoidasi")).toBeGreaterThan(0.6);
    expect(similarity("alpha beta gamma", "delta epsilon zeta")).toBe(0);
  });
  it("matchTopic ishonchli bo'lsa topadi, bo'lmasa null", () => {
    const topics = [{ id: "1", name: "Formativ baholash", subject: "Pedagogika" }, { id: "2", name: "Kasrlar", subject: "Matematika" }];
    expect(matchTopic({ subject: "Matematika", topic: "Kasrlar" }, topics)?.id).toBe("2");
    expect(matchTopic({ topic: "Formativ baholash usullari" }, topics)?.id).toBe("1");
    expect(matchTopic({ topic: "Kosmik kemalar" }, topics)).toBeNull();
    expect(matchTopic({}, topics)).toBeNull();
  });
  it("matn bo'laklari sahifa chegarasida; uzun sahifa bo'linadi", () => {
    const c = buildTextChunks([{ label: "Sahifa 1", text: "a".repeat(30) }, { label: "Sahifa 2", text: "b".repeat(30) }, { label: "Sahifa 3", text: "c".repeat(30) }], 100);
    expect(c.map((x) => x.labels)).toEqual([["Sahifa 1", "Sahifa 2"], ["Sahifa 3"]]);
    expect(c[0].text).toContain("[Sahifa 1]");
    const long = buildTextChunks([{ label: "S", text: Array.from({ length: 30 }, (_, i) => `qator ${i} `.repeat(3)).join("\n") }], 200);
    expect(long.length).toBeGreaterThan(2);
    expect(long.every((x) => x.text.length <= 260)).toBe(true);
  });
  it("PDF sahifa oraliqlari", () => {
    expect(pageRanges(20, 8)).toEqual([{ from: 1, to: 8 }, { from: 9, to: 16 }, { from: 17, to: 20 }]);
    expect(questionRanges([{ kind: "THEORY", fromPage: 1, toPage: 5 }, { kind: "QUESTIONS", fromPage: 6, toPage: 10 }], 12)).toEqual([{ from: 6, to: 8 }, { from: 9, to: 10 }]);
    expect(questionRanges([], 5)).toEqual([{ from: 1, to: 5 }]);
    expect(pdfPageCountGuess(new Uint8Array(Buffer.from("/Type /Pages /Count 3 /Type /Page /Type/Page /Type /Page")))).toBe(3);
  });
});

describe("AI javobini me'yorlashtirish", () => {
  it("yorliqlar tartib bo'yicha qayta yoziladi, savol matni saqlanadi, to'qilmaydi", () => {
    const r = normalizeAiQuestions([
      { number: "3", text: " Savol   matni? ", options: [{ label: "a", text: "bir" }, { label: "b", text: "" }, { label: "c", text: "uch" }], type: "multiple choice", answer: "c)", difficulty: "Qiyin", uncertain: true },
      { text: "", options: [] },
      { text: "Variantsiz savol?", options: [], type: "SHORT" },
    ], { pageFallback: "2" });
    expect(r).toHaveLength(2);
    expect(r[0]).toMatchObject({ number: 3, text: "Savol matni?", qtype: "SINGLE", inlineAnswer: ["B"], difficulty: "HARD", uncertain: true, page: "2" });
    expect(r[0].options).toEqual([{ label: "A", text: "bir" }, { label: "B", text: "uch" }]);
    expect(r[1]).toMatchObject({ qtype: "SHORT", incomplete: false });
  });
  it("kalit yozuvlari va turlar", () => {
    expect(normalizeAiKey([{ number: "1", answer: ["b"] }, { number: 2, answer: "AC" }, { number: "x", answer: "A" }])).toEqual([{ number: 1, answers: ["B"] }, { number: 2, answers: ["A", "C"] }]);
    expect(labelsOf("B) 5")).toEqual(["B"]);
    expect(labelsOf(["a", "C"])).toEqual(["A", "C"]);
    expect(normalizeType("single-choice")).toBe("SINGLE");
    expect(normalizeType("nimadir")).toBe("UNKNOWN");
    expect(normalizeDifficulty("easy")).toBe("EASY");
    expect(normalizeDifficulty(null)).toBe("MEDIUM");
  });
});
