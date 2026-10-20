/**
 * Ustozlar reytingi: toza hisoblash funksiyalari (docs/REYTING.md).
 *
 * Reyting xom foizlarni taqqoslamaydi: har bir imtihon (va diagnostika) natijasi shu imtihonni topshirganlarning o'rtachasiga nisbatan
 * standartlashtiriladi (z-ball), shuning uchun turli qiyinlik va savollar sonidagi sinovlar adolatli taqqoslanadi. Sinov kamida
 * `minParticipants` ta ishtirokchi to'plagandan keyingina «kalibrlangan» bo'ladi; aks holda foydalanuvchining shaxsiy natijasi ko'rsatiladi,
 * lekin umumiy o'rin hisoblanmaydi. Indeks = 50 + 10 × (vaznli o'rtacha z-ball), 0..100 oralig'ida. Vaznlar admin tomonidan o'zgartiriladi.
 */
export type RankCfg = {
  examWeight: number; diagWeight: number; minParticipants: number; minDiagnostics: number;
  directions: { key: string; label: string }[];
};
export type ExamMeta = { id: string; title: string; directionKey: string | null };
/** pct: eng yaxshi (hisoblanadigan urinishlar ichidan) natija, 0..1. */
export type ExamResult = { userId: string; examId: string; pct: number };
export type DiagResult = { userId: string; pct: number; count: number };
export type Participant = { userId: string; nickname: string; avatar: string; direction: string | null };
export type Stat = { mean: number; std: number; n: number; calibrated: boolean };
export type Calibration = { exams: Map<string, Stat>; diag: Stat };
export type Standing = {
  userId: string; nickname: string; avatar: string; direction: string | null; directionLabel: string | null;
  index: number; exams: number; diagnostics: number; rank: number;
};

const STD_FLOOR = 0.05; // hamma bir xil natija olganda z-ball portlab ketmasligi uchun

export const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
export const std = (xs: number[]) => { if (xs.length < 2) return 0; const m = mean(xs); return Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / xs.length); };
const stat = (xs: number[], minN: number): Stat => ({ mean: mean(xs), std: std(xs), n: xs.length, calibrated: xs.length >= minN });
export const zOf = (x: number, s: Stat) => (x - s.mean) / Math.max(s.std, STD_FLOOR);

/** Har bir imtihon va diagnostika uchun standartlash ko'rsatkichlari. */
export function calibrate(exams: ExamResult[], diag: DiagResult[], cfg: Pick<RankCfg, "minParticipants" | "minDiagnostics">): Calibration {
  const byExam = new Map<string, number[]>();
  for (const r of exams) (byExam.get(r.examId) ?? byExam.set(r.examId, []).get(r.examId)!).push(r.pct);
  const examStats = new Map<string, Stat>();
  for (const [id, xs] of byExam) examStats.set(id, stat(xs, cfg.minParticipants));
  return { exams: examStats, diag: stat(diag.filter((d) => d.count >= Math.max(1, cfg.minDiagnostics)).map((d) => d.pct), cfg.minParticipants) };
}

/** Imtihon shu yo'nalish uchun hisoblanadimi: yo'nalishsiz imtihon hamma yo'nalishga, aks holda faqat o'z yo'nalishiga. `null` yo'nalish — umumiy reyting (hammasi). */
export const examInScope = (e: ExamMeta | undefined, direction: string | null) => !!e && (direction === null || e.directionKey === null || e.directionKey === direction);

export type Breakdown = { examZ: number | null; examsUsed: number; examsTaken: number; diagZ: number | null; diagnostics: number };

/** Hisoblash uchun tayyorlangan ma'lumot: foydalanuvchi bo'yicha indekslar (katta jadvalda har safar butun ro'yxatni aylanmaslik uchun) va kalibrlash. */
export type RankData = { meta: Map<string, ExamMeta>; cal: Calibration; examsByUser: Map<string, ExamResult[]>; diagByUser: Map<string, DiagResult> };

export function prepare(exams: ExamResult[], diag: DiagResult[], meta: Map<string, ExamMeta>, cfg: Pick<RankCfg, "minParticipants" | "minDiagnostics">): RankData {
  const examsByUser = new Map<string, ExamResult[]>();
  for (const r of exams) (examsByUser.get(r.userId) ?? examsByUser.set(r.userId, []).get(r.userId)!).push(r);
  return { meta, cal: calibrate(exams, diag, cfg), examsByUser, diagByUser: new Map(diag.map((d) => [d.userId, d])) };
}

/** Bitta foydalanuvchining ko'rsatkichlari (faqat kalibrlangan sinovlar hisoblanadi). */
export function breakdownFor(userId: string, direction: string | null, data: RankData): Breakdown {
  const mine = (data.examsByUser.get(userId) ?? []).filter((r) => examInScope(data.meta.get(r.examId), direction));
  const zs = mine.flatMap((r) => { const s = data.cal.exams.get(r.examId); return s?.calibrated ? [zOf(r.pct, s)] : []; });
  const d = data.diagByUser.get(userId);
  return {
    examZ: zs.length ? mean(zs) : null, examsUsed: zs.length, examsTaken: mine.length,
    diagZ: d && d.count >= 1 && data.cal.diag.calibrated ? zOf(d.pct, data.cal.diag) : null, diagnostics: d?.count ?? 0,
  };
}

/** Indeks: 50 + 10 × vaznli o'rtacha z-ball, 0..100, bir o'nlik aniqlikda. Ikkala qism ham bo'lmasa null. */
export function indexOf(b: Breakdown, cfg: Pick<RankCfg, "examWeight" | "diagWeight">): number | null {
  if (b.examZ === null || b.diagZ === null) return null;
  const sum = cfg.examWeight + cfg.diagWeight;
  const we = sum > 0 ? cfg.examWeight / sum : 0.5, wd = sum > 0 ? cfg.diagWeight / sum : 0.5;
  const v = 50 + 10 * (we * b.examZ + wd * b.diagZ);
  return Math.round(Math.max(0, Math.min(100, v)) * 10) / 10;
}

/** Teng indeksli foydalanuvchilar bir xil o'rin oladi (1, 1, 3); tartib: indeks, ko'proq sinov, nik. */
export function assignRanks<T extends { index: number; exams: number; nickname: string }>(rows: T[]): (T & { rank: number })[] {
  const sorted = [...rows].sort((a, b) => b.index - a.index || b.exams - a.exams || a.nickname.localeCompare(b.nickname, "en"));
  let rank = 0, prev: number | null = null;
  return sorted.map((r, i) => { if (prev === null || r.index !== prev) rank = i + 1; prev = r.index; return { ...r, rank }; });
}

/** Yo'nalish bo'yicha (yoki `null`: umumiy) reyting jadvali. Faqat reytingga kirish shartlarini bajarganlar. */
export function buildStandings(participants: Participant[], data: RankData, cfg: RankCfg, direction: string | null): Standing[] {
  const label = (k: string | null) => cfg.directions.find((d) => d.key === k)?.label ?? null;
  const rows = participants.flatMap((p) => {
    if (direction !== null && p.direction !== direction) return [];
    const b = breakdownFor(p.userId, direction, data);
    if (b.diagnostics < cfg.minDiagnostics) return [];
    const index = indexOf(b, cfg);
    if (index === null) return [];
    return [{ userId: p.userId, nickname: p.nickname, avatar: p.avatar, direction: p.direction, directionLabel: label(p.direction), index, exams: b.examsUsed, diagnostics: b.diagnostics }];
  });
  return assignRanks(rows);
}

export type Readiness = { ready: boolean; reasons: string[] };
/** Foydalanuvchi nima uchun reytingda yo'qligini tushuntiradi (aniq sabab va keyingi qadam uchun). */
export function readiness(o: { optIn: boolean; hasNickname: boolean; hidden: boolean; b: Breakdown; cfg: RankCfg; calibratedExamExists: boolean }): Readiness {
  const r: string[] = [];
  if (o.hidden) r.push("Profilingiz administrator tomonidan reytingdan yashirilgan.");
  if (!o.hasNickname) r.push("Reytingda ko'rinadigan nik tanlang.");
  if (!o.optIn) r.push("Reytingda qatnashishga rozilik bering.");
  if (o.b.diagnostics < o.cfg.minDiagnostics) r.push("Diagnostikani yakunlang.");
  if (o.b.examsTaken === 0) r.push(o.calibratedExamExists ? "Reytingga hisoblanadigan imtihon simulyatorini yakunlang." : "Hozircha reytingga hisoblanadigan imtihon yo'q.");
  else if (o.b.examsUsed === 0) r.push("Imtihon natijangiz saqlangan; yetarli ishtirokchi to'planguncha taqqoslanmaydi.");
  if (o.b.diagnostics >= o.cfg.minDiagnostics && o.b.diagZ === null) r.push("Diagnostika bo'yicha taqqoslash uchun hali yetarli ishtirokchi yo'q.");
  return { ready: r.length === 0, reasons: r };
}
