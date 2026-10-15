import { describe, expect, it } from "vitest";
import { buildTasks, daysUntil, overallPercent } from "./dashboard";

const now = new Date("2026-01-01T00:00:00Z");
describe("daysUntil", () => {
  it("sana yo'q yoki o'tgan bo'lsa null", () => {
    expect(daysUntil(null, now)).toBeNull();
    expect(daysUntil(new Date("2025-12-31T00:00:00Z"), now)).toBeNull();
  });
  it("kunlarni yuqoriga yaxlitlaydi", () => {
    expect(daysUntil(new Date("2026-01-31T00:00:00Z"), now)).toBe(30);
    expect(daysUntil(new Date("2026-01-01T06:00:00Z"), now)).toBe(1);
  });
});
describe("overallPercent", () => {
  it("ishonchi past mavzularni hisobga olmaydi", () => {
    expect(overallPercent([{ name: "a", correct: 1, total: 1, confidence: "LOW" }])).toBeNull();
    expect(overallPercent([{ name: "a", correct: 6, total: 8, confidence: "HIGH" }, { name: "b", correct: 0, total: 2, confidence: "LOW" }])).toBe(75);
  });
});
describe("buildTasks", () => {
  it("diagnostika yo'q: diagnostika va sana vazifasi", () => {
    const t = buildTasks({ hasDiagnostic: false, dueErrors: 0, mastery: [], hasExamDate: false });
    expect(t.map((x) => x.id)).toEqual(["diag", "exam"]);
  });
  it("muddati kelgan xato, zaif va yetarli bo'lmagan mavzular", () => {
    const t = buildTasks({ hasDiagnostic: true, dueErrors: 3, hasExamDate: true, mastery: [
      { name: "Bo'lish", correct: 1, total: 5, confidence: "MEDIUM" }, { name: "Kasr", correct: 0, total: 1, confidence: "LOW" }] });
    expect(t.map((x) => x.id)).toEqual(["review", "weak", "thin"]);
    expect(t[0].title).toContain("3 ta");
  });
});
