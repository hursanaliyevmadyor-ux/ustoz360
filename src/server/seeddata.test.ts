import { describe, expect, it } from "vitest";
import { SITUATIONAL } from "../../prisma/situational-data";

/** Vaziyatli savollar sifat shartlari: to'g'ri javobni faqat uzunligidan topib bo'lmasligi kerak. */
describe("vaziyatli namunaviy savollar sifati", () => {
  it("har savolda 4 ta farqli variant, to'g'ri indeks chegarada, izoh va ko'nikma bor", () => {
    for (const [, , text, opts, a, why, key, skill] of SITUATIONAL) {
      expect(opts).toHaveLength(4);
      expect(new Set(opts.map((o) => o.toLowerCase())).size).toBe(4);
      expect(a).toBeGreaterThanOrEqual(0);
      expect(a).toBeLessThan(4);
      expect(text.length).toBeGreaterThan(60);
      expect(why.length).toBeGreaterThan(40);
      expect(key.length).toBeGreaterThan(5);
      expect(skill.length).toBeGreaterThan(3);
    }
  });
  it("variantlar hajmi muvozanatli: to'g'ri javob noto'g'rilar o'rtachasidan 20% dan ko'p farq qilmaydi", () => {
    for (const [, , text, opts, a] of SITUATIONAL) {
      const wrong = opts.filter((_, i) => i !== a);
      const mean = wrong.reduce((n, o) => n + o.length, 0) / wrong.length;
      const ratio = opts[a].length / mean;
      expect(ratio, text.slice(0, 50)).toBeGreaterThan(0.8);
      expect(ratio, text.slice(0, 50)).toBeLessThan(1.2);
    }
  });
  it("to'g'ri javob hamma savolda eng uzun variant emas", () => {
    const longest = SITUATIONAL.filter(([, , , opts, a]) => opts.every((o, i) => i === a || o.length < opts[a].length)).length;
    expect(longest).toBeLessThan(SITUATIONAL.length * 0.5);
  });
});
