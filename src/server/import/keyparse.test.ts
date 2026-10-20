import { describe, expect, it } from "vitest";
import { canonLabel, detectLabelStyle, isKeyLine, keySections, parseAnswerKey } from "./keyparse";

const flat = (t: string) => parseAnswerKey(t).entries.map((e) => `${e.number}${e.answers.join("")}`);

describe("javoblar kalitini o'qish", () => {
  it("1-A 2-C 3-B ko'rinishi", () => { expect(flat("1-A 2-C 3-B 4-D")).toEqual(["1A", "2C", "3B", "4D"]); });
  it("nuqta, qavs, ikki nuqta va kichik harflar", () => {
    expect(flat("1. a\n2) b\n3: c\n4=d")).toEqual(["1A", "2B", "3C", "4D"]);
  });
  it("oraliq: 1-5: ABCDA", () => { expect(flat("1-5: ABCDA")).toEqual(["1A", "2B", "3C", "4D", "5A"]); });
  it("bir nechta to'g'ri javob", () => { expect(flat("3-AB")).toEqual(["3AB"]); });
  it("jadval ko'rinishi: 1 | A | 2 | B", () => { expect(flat("1 | A | 2 | B")).toEqual(["1A", "2B"]); });
  it("kirill harflari (А Б В Г) lotin A B C D ga aylanadi", () => {
    expect(parseAnswerKey("1-А 2-Б 3-В 4-Г").style).toBe("ru");
    expect(flat("1-А 2-Б 3-В 4-Г")).toEqual(["1A", "2B", "3C", "4D"]);
  });
  it("raqamlash qayta boshlansa yangi bo'lim", () => {
    const r = parseAnswerKey("1-A 2-B 3-C\n1-D 2-A");
    expect(r.entries.map((e) => e.section)).toEqual([0, 0, 0, 1, 1]);
    const s = keySections(r.entries);
    expect(s).toHaveLength(2);
    expect(s[1].get(1)).toEqual(["D"]);
  });
  it("kalit qatorini oddiy matndan ajratadi", () => {
    expect(isKeyLine("1-A 2-B 3-C")).toBe(true);
    expect(isKeyLine("Bu oddiy matn qatori")).toBe(false);
    expect(isKeyLine("")).toBe(false);
  });
  it("harf uslubi va yorliq", () => {
    expect(detectLabelStyle("А) Б) В) Г)")).toBe("ru");
    expect(detectLabelStyle("A) B) C)")).toBe("latin");
    expect(canonLabel("c")).toBe("C");
    expect(canonLabel("Г", "ru")).toBe("D");
    expect(canonLabel("1")).toBeNull();
  });
});
