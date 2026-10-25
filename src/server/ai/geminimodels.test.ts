import { describe, expect, it } from "vitest";
import { geminiCooldown, pickGeminiModel, rankGeminiModels } from "./geminimodels";

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
  it("zaxira tartibi: eng yangi flash, so'ng eskiroq flash, so'ng lite (kvotasi tugagan modeldan keyin keyingisi sinanadi)", () => {
    const l = [m("gemini-3.8-flash"), m("gemini-3.8-flash-lite"), m("gemini-3-flash"), m("gemini-2.5-flash-lite"), m("gemini-3.8-pro"), m("gemini-3.8-flash")];
    expect(rankGeminiModels(l, false)).toEqual(["gemini-3.8-flash", "gemini-3-flash", "gemini-3.8-flash-lite", "gemini-2.5-flash-lite"]);
    expect(rankGeminiModels(l, true)[0]).toBe("gemini-3.8-pro");
    expect(rankGeminiModels(l, true)).toContain("gemini-3.8-flash");
    expect(rankGeminiModels([], false)).toEqual([]);
  });
  it("xatodan keyin chetga qo'yish: 404 uzoq, kvota (429) va band (503) qisqa, boshqa xatolarda almashtirilmaydi", () => {
    expect(geminiCooldown(404, "This model models/gemini-2.5-flash is no longer available to new users")).toMatchObject({ reason: "gone", ms: 6 * 3_600_000 });
    expect(geminiCooldown(429, "You exceeded your current quota, please check your plan and billing details.")).toMatchObject({ reason: "quota", ms: 30 * 60_000 });
    expect(geminiCooldown(429, "Resource has been exhausted (e.g. check quota).")).toMatchObject({ reason: "quota", ms: 90_000 });
    expect(geminiCooldown(503, "This model is currently experiencing high demand.")).toMatchObject({ reason: "busy", ms: 45_000 });
    expect(geminiCooldown(400, "bad request")).toBeNull();
    expect(geminiCooldown(403, "")).toBeNull();
  });
  it("flash bo'lmasa lite, hech narsa mos bo'lmasa null; generateContent'siz model o'tmaydi", () => {
    expect(pickGeminiModel([m("gemini-2.5-flash-lite")], false)).toBe("gemini-2.5-flash-lite");
    expect(pickGeminiModel([m("gemini-2.5-flash", ["embedContent"])], false)).toBeNull();
    expect(pickGeminiModel([], false)).toBeNull();
    expect(pickGeminiModel([m("gemma-3-27b-it")], false)).toBeNull();
  });
});
