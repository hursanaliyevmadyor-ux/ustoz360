import { describe, expect, it } from "vitest";
import { assignRanks, buildStandings, breakdownFor, calibrate, examInScope, indexOf, prepare, readiness, zOf, type DiagResult, type ExamMeta, type ExamResult, type Participant, type RankCfg } from "./logic";

const cfg: RankCfg = { examWeight: 70, diagWeight: 30, minParticipants: 3, minDiagnostics: 1, directions: [{ key: "ATT", label: "Attestatsiya" }, { key: "MS", label: "Milliy sertifikat" }] };
const meta = new Map<string, ExamMeta>([["e1", { id: "e1", title: "Attestatsiya sinovi", directionKey: "ATT" }], ["e2", { id: "e2", title: "Umumiy sinov", directionKey: null }], ["e3", { id: "e3", title: "MS sinovi", directionKey: "MS" }]]);
const P = (id: string, direction: string | null): Participant => ({ userId: id, nickname: id.toUpperCase(), avatar: `/avatars/p1.svg`, direction });

describe("standartlash va indeks", () => {
  it("imtihon faqat kamida minParticipants ishtirokchi bo'lganda kalibrlanadi", () => {
    const exams: ExamResult[] = [{ userId: "a", examId: "e1", pct: 0.9 }, { userId: "b", examId: "e1", pct: 0.5 }, { userId: "a", examId: "e2", pct: 0.7 }];
    const cal = calibrate(exams, [], cfg);
    expect(cal.exams.get("e1")).toMatchObject({ n: 2, calibrated: false });
    expect(cal.diag.calibrated).toBe(false);
  });
  it("z-ball: o'rtachadan yuqori musbat; barcha natija teng bo'lsa portlamaydi", () => {
    const cal = calibrate([{ userId: "a", examId: "e1", pct: 0.8 }, { userId: "b", examId: "e1", pct: 0.6 }, { userId: "c", examId: "e1", pct: 0.4 }], [], cfg);
    const s = cal.exams.get("e1")!;
    expect(zOf(0.8, s)).toBeGreaterThan(0); expect(zOf(0.4, s)).toBeLessThan(0); expect(zOf(0.6, s)).toBeCloseTo(0, 6);
    const flat = calibrate([{ userId: "a", examId: "e1", pct: 0.5 }, { userId: "b", examId: "e1", pct: 0.5 }, { userId: "c", examId: "e1", pct: 0.5 }], [], cfg).exams.get("e1")!;
    expect(zOf(0.5, flat)).toBe(0);
  });
  it("indeks: vaznli o'rtacha, 0..100; qismlardan biri yo'q bo'lsa null", () => {
    expect(indexOf({ examZ: 1, examsUsed: 1, examsTaken: 1, diagZ: 0, diagnostics: 1 }, cfg)).toBe(57);
    expect(indexOf({ examZ: 0, examsUsed: 1, examsTaken: 1, diagZ: 1, diagnostics: 1 }, cfg)).toBe(53);
    expect(indexOf({ examZ: 100, examsUsed: 1, examsTaken: 1, diagZ: 100, diagnostics: 1 }, cfg)).toBe(100);
    expect(indexOf({ examZ: null, examsUsed: 0, examsTaken: 1, diagZ: 0, diagnostics: 1 }, cfg)).toBeNull();
    expect(indexOf({ examZ: 1, examsUsed: 1, examsTaken: 1, diagZ: null, diagnostics: 0 }, cfg)).toBeNull();
    expect(indexOf({ examZ: 2, examsUsed: 1, examsTaken: 1, diagZ: 0, diagnostics: 1 }, { examWeight: 0, diagWeight: 0 })).toBe(60);
  });
  it("yo'nalish doirasi: yo'nalishsiz imtihon hammaga, yo'nalishlisi faqat o'ziga; umumiy reytingda hammasi", () => {
    expect(examInScope(meta.get("e1"), "ATT")).toBe(true);
    expect(examInScope(meta.get("e1"), "MS")).toBe(false);
    expect(examInScope(meta.get("e2"), "MS")).toBe(true);
    expect(examInScope(meta.get("e3"), null)).toBe(true);
    expect(examInScope(undefined, null)).toBe(false);
  });
});

describe("o'rinlar va teng ballar", () => {
  it("teng indeks bir xil o'rin oladi (1, 1, 3); tartib: indeks, ko'proq sinov, nik", () => {
    const r = assignRanks([
      { index: 60, exams: 1, nickname: "Bobur" }, { index: 70, exams: 1, nickname: "Zamira" }, { index: 70, exams: 2, nickname: "Yusuf" }, { index: 55, exams: 3, nickname: "Ali" },
    ]);
    expect(r.map((x) => [x.nickname, x.rank])).toEqual([["Yusuf", 1], ["Zamira", 1], ["Bobur", 3], ["Ali", 4]]);
  });
});

describe("reyting jadvali", () => {
  // 4 ta foydalanuvchi: e1 (ATT) va e2 (umumiy) imtihonlarini topshirgan, diagnostika bor.
  const exams: ExamResult[] = [
    { userId: "a", examId: "e1", pct: 0.9 }, { userId: "b", examId: "e1", pct: 0.7 }, { userId: "c", examId: "e1", pct: 0.5 }, { userId: "d", examId: "e1", pct: 0.3 },
    { userId: "a", examId: "e2", pct: 0.8 }, { userId: "b", examId: "e2", pct: 0.6 }, { userId: "c", examId: "e2", pct: 0.7 },
  ];
  const diag: DiagResult[] = [{ userId: "a", pct: 0.8, count: 2 }, { userId: "b", pct: 0.6, count: 1 }, { userId: "c", pct: 0.7, count: 1 }, { userId: "d", pct: 0.4, count: 1 }];
  const data = prepare(exams, diag, meta, cfg);
  const ps = [P("a", "ATT"), P("b", "ATT"), P("c", "MS"), P("d", "ATT")];

  it("umumiy reyting: yuqori natija yuqori o'rinda, indeks 0..100", () => {
    const s = buildStandings(ps, data, cfg, null);
    // c: e1 da past, lekin e2 va diagnostikada b dan yuqori; standartlashtirilgan indeks bo'yicha c > b
    expect(s.map((x) => x.userId)).toEqual(["a", "c", "b", "d"]);
    expect(s[0].rank).toBe(1); expect(s[3].rank).toBe(4);
    expect(s.every((x) => x.index >= 0 && x.index <= 100)).toBe(true);
    expect(s[0].index).toBeGreaterThan(s[1].index);
  });
  it("yo'nalish reytingi faqat shu yo'nalish foydalanuvchilari va shu yo'nalish imtihonlari bilan", () => {
    const att = buildStandings(ps, data, cfg, "ATT");
    expect(att.map((x) => x.userId)).toEqual(["a", "b", "d"]);
    expect(att[0].directionLabel).toBe("Attestatsiya");
    const ms = buildStandings(ps, data, cfg, "MS");
    expect(ms.map((x) => x.userId)).toEqual(["c"]); // c faqat umumiy imtihon (e2) bo'yicha: e1 unga hisoblanmaydi
  });
  it("kalibrlanmagan imtihon yoki diagnostika yo'q bo'lsa foydalanuvchi reytingga kirmaydi", () => {
    const small = prepare(exams.slice(0, 2), diag, meta, cfg); // e1: 2 ishtirokchi < 3
    expect(buildStandings(ps, small, cfg, "ATT")).toEqual([]);
    expect(buildStandings(ps, prepare(exams, [], meta, cfg), cfg, null)).toEqual([]);
    expect(buildStandings(ps, data, { ...cfg, minDiagnostics: 2 }, null).map((x) => x.userId)).toEqual(["a"]);
  });
  it("tushuntirish: aniq sabab va keyingi qadam", () => {
    const none = breakdownFor("z", null, data);
    const r = readiness({ optIn: false, hasNickname: false, hidden: false, b: none, cfg, calibratedExamExists: true });
    expect(r.ready).toBe(false);
    expect(r.reasons.join(" ")).toMatch(/nik/); expect(r.reasons.join(" ")).toMatch(/rozilik/); expect(r.reasons.join(" ")).toMatch(/Diagnostika/); expect(r.reasons.join(" ")).toMatch(/imtihon/);
    expect(readiness({ optIn: true, hasNickname: true, hidden: false, b: breakdownFor("a", null, data), cfg, calibratedExamExists: true })).toEqual({ ready: true, reasons: [] });
    expect(readiness({ optIn: true, hasNickname: true, hidden: true, b: breakdownFor("a", null, data), cfg, calibratedExamExists: true }).ready).toBe(false);
  });
});
