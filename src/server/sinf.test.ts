import { describe, expect, it } from "vitest";
import { aliasProblem, analyze, insights, levelOf, type A, type Sc, type St } from "./sinflogic";
import { aliasesInput, assessmentInput, scoresInput } from "./sinfvalid";

const students: St[] = ["O1", "O2", "O3", "O4", "O5", "O6"].map((alias, i) => ({ id: `s${i + 1}`, alias }));
const A1: A = { id: "a1", title: "Bo'lish: kirish", topic: "Bo'lish", kind: "BEFORE", maxScore: 10, date: "2026-10-01" };
const A2: A = { id: "a2", title: "Bo'lish: yakun", topic: "Bo'lish", kind: "AFTER", maxScore: 10, date: "2026-10-15" };
const A3: A = { id: "a3", title: "Kasrlar", topic: "Kasrlar", kind: "CURRENT", maxScore: 20, date: "2026-10-10" };
const sc = (a: string, vals: number[]): Sc[] => vals.map((score, i) => ({ assessmentId: a, studentId: `s${i + 1}`, score }));

describe("SINF tahlili", () => {
  const scores = [...sc("a1", [3, 4, 5, 2, 6, 4]), ...sc("a2", [7, 8, 8, 5, 9, 6]), ...sc("a3", [18, 17, 12])];
  const r = analyze(students, [A1, A2, A3], scores);

  it("foiz hisoblash: ball eng yuqori ballga nisbatan", () => {
    const k = r.trend.find((t) => t.assessmentId === "a3")!;
    expect(k.avg).toBe(78.3); // (90 + 85 + 60) / 3
    expect(k.n).toBe(3);
  });
  it("mavzu bahosi eng so'nggi (oldin emas) baholashdan olinadi", () => {
    const t = r.topics.find((x) => x.topic === "Bo'lish")!;
    expect(t.basedOn).toBe("Bo'lish: yakun");
    expect(t.avg).toBe(71.7); // (7+8+8+5+9+6) / 6 = 7.17 -> 71.7%
    expect(t.level).toBe("ok");
  });
  it("natijasi kam mavzu (5 tadan kam) 'kam ma'lumot' deb belgilanadi", () => {
    expect(r.topics.find((x) => x.topic === "Kasrlar")!.lowData).toBe(true);
    expect(r.topics.find((x) => x.topic === "Bo'lish")!.lowData).toBe(false);
  });
  it("oldin/keyin taqqoslash faqat ikkala marta qatnashganlar bo'yicha, o'sish ko'rsatiladi", () => {
    expect(r.comparisons).toHaveLength(1);
    const c = r.comparisons[0];
    expect(c).toMatchObject({ topic: "Bo'lish", common: 6, lowData: false });
    expect(c.before).toBe(40.0);
    expect(c.after).toBe(71.7);
    expect(c.delta).toBe(31.7);
    expect(c.students[0].delta).toBeGreaterThanOrEqual(c.students.at(-1)!.delta);
  });
  it("faqat bir marta qatnashgan o'quvchi taqqoslashga kirmaydi", () => {
    const only = analyze(students, [A1, A2], [...sc("a1", [3, 4, 5]), ...sc("a2", [7, 8])]);
    expect(only.comparisons[0].common).toBe(2);
    expect(only.comparisons[0].lowData).toBe(true);
  });
  it("AFTER baholash BEFORE dan oldingi sanada bo'lsa taqqoslanmaydi", () => {
    const early = analyze(students, [A1, { ...A2, date: "2026-09-01" }], [...sc("a1", [3, 4]), ...sc("a2", [7, 8])]);
    expect(early.comparisons).toHaveLength(0);
  });
  it("yordam kerak o'quvchi: kamida 2 ta natija va o'rtacha 50% dan past", () => {
    const weak = analyze(students, [A1, A2], [{ assessmentId: "a1", studentId: "s4", score: 2 }, { assessmentId: "a2", studentId: "s4", score: 4 }, { assessmentId: "a1", studentId: "s5", score: 1 }]);
    expect(weak.students.find((s) => s.alias === "O4")!.needsHelp).toBe(true);
    expect(weak.students.find((s) => s.alias === "O5")!.needsHelp).toBe(false); // bitta natija: xulosa yo'q
  });
  it("natijasi yo'q o'quvchi va bo'sh sinf xatosiz ishlaydi", () => {
    const e = analyze(students, [], []);
    expect(e.classAvg).toBeNull();
    expect(e.students.every((s) => s.avg === null && !s.needsHelp)).toBe(true);
    expect(insights(e)).toEqual([]);
  });
  it("noma'lum o'quvchi yoki baholashga tegishli natijalar e'tiborga olinmaydi", () => {
    const x = analyze(students, [A1], [{ assessmentId: "yoq", studentId: "s1", score: 5 }, { assessmentId: "a1", studentId: "yoq", score: 5 }, { assessmentId: "a1", studentId: "s1", score: 5 }]);
    expect(x.classAvg).toBe(50);
  });
  it("xulosalar kam ma'lumotda zaif mavzu haqida xulosa chiqarmaydi", () => {
    const few = analyze(students, [A3], sc("a3", [2, 3]));
    expect(few.topics[0].level).toBe("weak");
    const txt = insights(few).join(" ");
    expect(txt).not.toContain("Eng qiyin mavzu");
    expect(txt).toContain("natija kam");
  });
  it("daraja chegaralari", () => { expect([levelOf(59.9), levelOf(60), levelOf(79.9), levelOf(80)]).toEqual(["weak", "ok", "ok", "strong"]); });
});

describe("taxallus va kiritish tekshiruvi (shaxsiy ma'lumotni kamaytirish)", () => {
  it("ism-familiya, email, telefon yoki uzun matn rad etiladi", () => {
    expect(aliasProblem("Oybek")).toBeNull();
    expect(aliasProblem("O-12")).toBeNull();
    expect(aliasProblem("Ali Valiyev Karimovich")).toMatch(/taxallus/i);
    expect(aliasProblem("ali@mail.uz")).toMatch(/email/);
    expect(aliasProblem("998901234567")).toMatch(/telefon/);
    expect(aliasProblem("x".repeat(25))).toMatch(/24/);
    expect(aliasProblem("   ")).toMatch(/bo'sh/);
  });
  it("taxalluslar ro'yxatida bitta xato hammasini rad etadi", () => {
    expect(aliasesInput.safeParse({ aliases: ["O1", "O2"] }).success).toBe(true);
    expect(aliasesInput.safeParse({ aliases: ["O1", "a@b.c"] }).success).toBe(false);
    expect(aliasesInput.safeParse({ aliases: [] }).success).toBe(false);
  });
  it("baholash va ball tekshiruvi", () => {
    expect(assessmentInput.safeParse({ title: "T", topic: "M", kind: "BEFORE", maxScore: 10, date: "2026-10-17" }).success).toBe(true);
    expect(assessmentInput.safeParse({ title: "T", topic: "M", kind: "BEFORE", maxScore: 0, date: "2026-10-17" }).success).toBe(false);
    expect(assessmentInput.safeParse({ title: "T", topic: "M", kind: "X", maxScore: 10, date: "2026-10-17" }).success).toBe(false);
    expect(scoresInput.safeParse({ scores: { s1: 5, s2: null } }).success).toBe(true);
    expect(scoresInput.safeParse({ scores: { s1: -1 } }).success).toBe(false);
  });
});
