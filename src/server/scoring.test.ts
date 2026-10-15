import { describe, expect, it } from "vitest";
import { confidenceFor, groupByTopic, nextReview, shuffle } from "./scoring";

describe("confidenceFor", () => {
  it("2–3 ta savol uchun ishonchlilik past", () => {
    expect(confidenceFor(1)).toBe("LOW");
    expect(confidenceFor(3)).toBe("LOW");
    expect(confidenceFor(4)).toBe("MEDIUM");
    expect(confidenceFor(8)).toBe("HIGH");
  });
});

describe("groupByTopic", () => {
  it("mavzu bo'yicha hisoblaydi", () => {
    const r = groupByTopic([{ topicId: "a", isCorrect: true }, { topicId: "a", isCorrect: false }, { topicId: "b", isCorrect: true }]);
    expect(r).toEqual([{ topicId: "a", correct: 1, total: 2 }, { topicId: "b", correct: 1, total: 1 }]);
  });
});

describe("nextReview", () => {
  const now = new Date("2026-01-01T00:00:00Z");
  it("xato bo'lsa 1 kun", () => {
    const r = nextReview(now, 16, false);
    expect(r.intervalDays).toBe(1);
    expect(r.mastered).toBe(false);
    expect(r.nextReviewAt.toISOString()).toBe("2026-01-02T00:00:00.000Z");
  });
  it("to'g'ri takrorlashda interval ikki baravar, 8 kundan keyin o'zlashtirilgan", () => {
    expect(nextReview(now, 2, true).intervalDays).toBe(4);
    expect(nextReview(now, 4, true).mastered).toBe(true);
    expect(nextReview(now, 64, true).intervalDays).toBe(64);
  });
});

describe("shuffle", () => {
  it("elementlarni yo'qotmaydi va asl massivni o'zgartirmaydi", () => {
    const a = [1, 2, 3, 4, 5];
    const s = shuffle(a);
    expect([...s].sort()).toEqual(a);
    expect(a).toEqual([1, 2, 3, 4, 5]);
  });
});
