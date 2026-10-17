/** SINF ANALITIKA: tahlil hisob-kitoblari (toza funksiyalar, bazaga tegmaydi, test qilinadi). */

export type AssessmentKind = "BEFORE" | "AFTER" | "CURRENT";
export type A = { id: string; title: string; topic: string; kind: AssessmentKind; maxScore: number; date: string };
export type St = { id: string; alias: string };
export type Sc = { assessmentId: string; studentId: string; score: number };

/** Kam ma'lumot: shundan kam natija bo'lsa xulosa chiqarilmaydi (kichik namunada tasodifiy tebranish katta). */
export const MIN_SCORES = 5;
export const WEAK = 60, STRONG = 80;

const pct = (score: number, max: number) => (max > 0 ? (score / max) * 100 : 0);
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
const r1 = (x: number | null) => (x === null ? null : Math.round(x * 10) / 10);

export type Level = "weak" | "ok" | "strong";
export const levelOf = (avg: number): Level => (avg < WEAK ? "weak" : avg >= STRONG ? "strong" : "ok");

export function analyze(students: St[], assessments: A[], scores: Sc[]) {
  const aById = new Map(assessments.map((a) => [a.id, a]));
  const alias = new Map(students.map((s) => [s.id, s.alias]));
  const valid = scores.filter((s) => aById.has(s.assessmentId) && alias.has(s.studentId));
  const pctOf = (s: Sc) => pct(s.score, aById.get(s.assessmentId)!.maxScore);
  const sorted = assessments.slice().sort((a, b) => a.date.localeCompare(b.date) || a.title.localeCompare(b.title));

  // Vaqt bo'yicha o'zgarish: har baholashning sinf o'rtachasi.
  const trend = sorted.map((a) => {
    const xs = valid.filter((s) => s.assessmentId === a.id).map(pctOf);
    return { assessmentId: a.id, title: a.title, topic: a.topic, kind: a.kind, date: a.date, avg: r1(mean(xs)), n: xs.length };
  });
  const classAvg = r1(mean(valid.map(pctOf)));

  // Mavzu bo'yicha: eng so'nggi (BEFORE bo'lmagan, aks holda BEFORE) baholash natijasi.
  const topics = Array.from(new Set(assessments.map((a) => a.topic))).map((topic) => {
    const list = sorted.filter((a) => a.topic === topic).reverse();
    const latest = list.find((a) => a.kind !== "BEFORE") ?? list[0];
    const xs = valid.filter((s) => s.assessmentId === latest.id).map(pctOf);
    const avg = r1(mean(xs));
    return { topic, avg, n: xs.length, assessments: list.length, level: avg === null ? null : levelOf(avg), lowData: xs.length < MIN_SCORES, basedOn: latest.title };
  }).sort((a, b) => (a.avg ?? 101) - (b.avg ?? 101));

  // O'quvchilar: umumiy o'rtacha va qiynalayotgan mavzular.
  const weakTopics = new Set(topics.filter((t) => t.level === "weak" && !t.lowData).map((t) => t.topic));
  const studs = students.map((s) => {
    const mine = valid.filter((x) => x.studentId === s.id);
    const avg = r1(mean(mine.map(pctOf)));
    const weak = Array.from(new Set(mine.filter((x) => pctOf(x) < WEAK).map((x) => aById.get(x.assessmentId)!.topic))).sort();
    return { studentId: s.id, alias: s.alias, avg, n: mine.length, needsHelp: avg !== null && mine.length >= 2 && avg < 50, weakTopics: weak, inWeakTopic: weak.some((t) => weakTopics.has(t)) };
  }).sort((a, b) => (a.avg ?? 101) - (b.avg ?? 101));

  // Oldin/keyin: bir xil mavzu bo'yicha BEFORE va undan keyingi AFTER.
  const comparisons: { topic: string; before: number; after: number; delta: number; common: number; lowData: boolean; students: { alias: string; before: number; after: number; delta: number }[] }[] = [];
  for (const topic of Array.from(new Set(assessments.map((a) => a.topic)))) {
    const before = sorted.filter((a) => a.topic === topic && a.kind === "BEFORE").pop();
    const after = sorted.filter((a) => a.topic === topic && a.kind === "AFTER" && (!before || a.date >= before.date)).pop();
    if (!before || !after) continue;
    const b = new Map(valid.filter((s) => s.assessmentId === before.id).map((s) => [s.studentId, pctOf(s)]));
    const f = new Map(valid.filter((s) => s.assessmentId === after.id).map((s) => [s.studentId, pctOf(s)]));
    // Faqat ikkala marta ham ishtirok etgan o'quvchilar taqqoslanadi (aks holda sinf tarkibi farqi natijani buzadi).
    const both = students.filter((s) => b.has(s.id) && f.has(s.id));
    if (!both.length) continue;
    const rows = both.map((s) => ({ alias: s.alias, before: r1(b.get(s.id)!)!, after: r1(f.get(s.id)!)!, delta: r1(f.get(s.id)! - b.get(s.id)!)! }));
    const mb = mean(both.map((s) => b.get(s.id)!))!, ma = mean(both.map((s) => f.get(s.id)!))!;
    comparisons.push({ topic, before: r1(mb)!, after: r1(ma)!, delta: r1(ma - mb)!, common: both.length, lowData: both.length < MIN_SCORES, students: rows.sort((x, y) => y.delta - x.delta) });
  }
  return { classAvg, trend, topics, students: studs, comparisons };
}

/** Qisqa matnli xulosalar (qoidalar bilan; AI emas). Kam ma'lumotda xulosa chiqarmaydi. */
export function insights(a: ReturnType<typeof analyze>): string[] {
  const out: string[] = [];
  const weak = a.topics.filter((t) => t.level === "weak" && !t.lowData);
  if (weak.length) out.push(`Eng qiyin mavzu: «${weak[0].topic}» (${weak[0].avg}%). Shu mavzuda qo'shimcha topshiriq bering.`);
  const low = a.topics.filter((t) => t.lowData && t.avg !== null);
  if (low.length) out.push(`${low.length} ta mavzuda natija kam (${MIN_SCORES} tadan kam): xulosa chiqarish uchun ko'proq o'quvchi natijasini kiriting.`);
  const help = a.students.filter((s) => s.needsHelp);
  if (help.length) out.push(`${help.length} ta o'quvchi o'rtacha 50% dan past: ${help.slice(0, 5).map((s) => s.alias).join(", ")}${help.length > 5 ? " va boshqalar" : ""}. Individual yordam kerak.`);
  for (const c of a.comparisons.filter((x) => !x.lowData)) out.push(`«${c.topic}»: ${c.before}% → ${c.after}% (${c.delta >= 0 ? "+" : ""}${c.delta} punkt).`);
  return out;
}

/** O'quvchi taxalluslari: ism-familiya, telefon yoki email emas. Xato matni yoki null. */
export function aliasProblem(raw: string): string | null {
  const s = raw.trim();
  if (!s) return "Taxallus bo'sh.";
  if (s.length > 24) return "Taxallus 24 belgidan oshmasin.";
  if (/@|https?:|\d{6,}/i.test(s)) return "Taxallusda email, havola yoki telefon bo'lmasin.";
  if (s.split(/\s+/).length >= 3) return "Ism-familiya o'rniga qisqa taxallus yozing (masalan: O-1 yoki Oybek).";
  return null;
}
