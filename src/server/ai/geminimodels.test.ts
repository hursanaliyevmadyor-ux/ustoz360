import { describe, expect, it } from "vitest";
import { pickGeminiModel } from "./geminimodels";

const gen = ["generateContent", "countTokens"];
const m = (name: string, methods = gen) => ({ name: `models/${name}`, supportedGenerationMethods: methods });

describe("Gemini modelini tanlash", () => {
  const list = [
    m("gemini-2.5-flash"), m("gemini-2.5-flash-lite"), m("gemini-2.5-pro"), m("gemini-3-flash-preview"), m("gemini-3.1-pro-preview"),
    m("gemini-3-flash"), m("gemini-2.5-flash-image"), m("gemini-embedding-001", ["embedContent"]), m("gemini-2.5-flash-preview-tts"), m("gemma-3-27b-it"),
  ];
  it("tezkor ish: eng yangi barqaror flash (lite, tts, rasm, embedding emas)", () => {
    expect(pickGeminiModel(list, false)).toBe("gemini-3-flash");
  });
  it("murakkab ish: pro tanlanadi; barqaror bo'lmasa preview", () => {
    expect(pickGeminiModel(list, true)).toBe("gemini-2.5-pro");
    expect(pickGeminiModel([m("gemini-3.1-pro-preview"), m("gemini-3-flash")], true)).toBe("gemini-3.1-pro-preview");
  });
  it("barqaror eskisi o'rniga yangi preview emas, barqaror yangi afzal; faqat preview bo'lsa o'sha", () => {
    expect(pickGeminiModel([m("gemini-2.5-flash"), m("gemini-3-flash-preview")], false)).toBe("gemini-2.5-flash");
    expect(pickGeminiModel([m("gemini-3-flash-preview")], false)).toBe("gemini-3-flash-preview");
  });
  it("flash bo'lmasa lite, hech narsa mos bo'lmasa null; generateContent'siz model o'tmaydi", () => {
    expect(pickGeminiModel([m("gemini-2.5-flash-lite")], false)).toBe("gemini-2.5-flash-lite");
    expect(pickGeminiModel([m("gemini-2.5-flash", ["embedContent"])], false)).toBeNull();
    expect(pickGeminiModel([], false)).toBeNull();
    expect(pickGeminiModel([m("gemma-3-27b-it")], false)).toBeNull();
  });
});
