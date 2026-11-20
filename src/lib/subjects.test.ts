import { describe, expect, it } from "vitest";
import { BGS } from "./board";
import { TEMPLATES } from "./board";
import { SUBJECTS, SYMBOL_ORDER, SYMBOL_TABS, isSubject, subjectOf } from "./subjects";

describe("fanlar", () => {
  it("kalitlar takrorlanmaydi, fon va shablonlar mavjud", () => {
    expect(new Set(SUBJECTS.map((s) => s.key)).size).toBe(SUBJECTS.length);
    const tpl = new Set<string>(TEMPLATES.map((t) => t.id));
    for (const s of SUBJECTS) {
      expect(BGS.includes(s.bg), s.key).toBe(true);
      expect(SYMBOL_ORDER.includes(s.sym), s.key).toBe(true);
      for (const t of s.tpl) expect(tpl.has(t), `${s.key}: ${t}`).toBe(true);
      expect(s.label.length).toBeGreaterThan(2);
      expect(s.tip.length).toBeGreaterThan(10);
    }
  });
  it("tekshirish", () => {
    expect(isSubject("math") && isSubject("music") && !isSubject("x") && !isSubject(5) && !isSubject(undefined)).toBe(true);
    expect(subjectOf("chem")!.label).toBe("Kimyo");
    expect(subjectOf("zzz")).toBeNull();
  });
  it("belgilar to'plamlari bo'sh emas, takrorsiz", () => {
    for (const g of SYMBOL_ORDER) { const it = SYMBOL_TABS[g].items; expect(it.length).toBeGreaterThan(10); expect(new Set(it).size).toBe(it.length); }
  });
});
