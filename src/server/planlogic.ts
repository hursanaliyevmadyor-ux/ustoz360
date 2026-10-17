/** TOIFA: qoidalar asosidagi tayyorgarlik rejasi (toza funksiyalar, AI ishlatilmaydi, test qilinadi). Sanalar "YYYY-MM-DD". */

const DAY = 86_400_000;
/** O'zbekiston vaqti (UTC+5) bo'yicha bugungi sana. */
export const uzToday = (now = new Date()) => new Date(now.getTime() + 5 * 3_600_000).toISOString().slice(0, 10);
export const addDays = (iso: string, n: number) => new Date(Date.parse(iso + "T00:00:00Z") + n * DAY).toISOString().slice(0, 10);
export const daysBetween = (a: string, b: string) => Math.round((Date.parse(b + "T00:00:00Z") - Date.parse(a + "T00:00:00Z")) / DAY);
export const isIsoDate = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v + "T00:00:00Z")) && new Date(v + "T00:00:00Z").toISOString().startsWith(v);

export type PlanKind = "TASK" | "TEST" | "REVIEW" | "DIAG" | "SIM" | "EXAM";
export type PlanDraft = { date: string; title: string; kind: PlanKind; href?: string; position: number };
export type Weak = { topicId: string; name: string; percent: number };
export type PlanInput = {
  today: string; examDate: string | null; dailyMinutes: number | null;
  hasDiagnostic: boolean; dueErrors: number; weak: Weak[]; thin: { topicId: string; name: string }[];
};

/** Kunlik vaqtga qarab kuniga nechta vazifa: 30 daqiqagacha 1 ta, 90 daqiqagacha 2 ta, undan ko'p bo'lsa 3 ta. */
export const slotsPerDay = (minutes: number | null) => ((minutes ?? 60) < 45 ? 1 : (minutes ?? 60) < 90 ? 2 : 3);

const topicUrl = (id: string) => `/ustoz-ai/testlar/sozlash?mode=topic&topic=${encodeURIComponent(id)}`;
const FALLBACK = [
  { title: "Aralash test", href: "/ustoz-ai/testlar/sozlash?mode=mixed" },
  { title: "Oddiy mashq (tezkor)", href: "/ustoz-ai/mashq" },
  { title: "Murakkab vaziyatli test", href: "/ustoz-ai/testlar/sozlash?mode=situational" },
];

export function buildPlan(i: PlanInput): PlanDraft[] {
  const exam = i.examDate && daysBetween(i.today, i.examDate) >= 0 ? i.examDate : null;
  const horizon = exam ? Math.min(daysBetween(i.today, exam), 30) : 6;
  const slots = slotsPerDay(i.dailyMinutes);
  const weak = i.weak.slice().sort((a, b) => a.percent - b.percent);
  const out: PlanDraft[] = [];
  let wi = 0, ti = 0, fi = 0;

  for (let d = 0; d <= horizon; d++) {
    const date = addDays(i.today, d);
    const left = exam ? daysBetween(date, exam) : null;
    if (exam && date === exam) { out.push({ date, title: "Imtihon kuni", kind: "EXAM", position: 0 }); continue; }
    const day: Omit<PlanDraft, "date" | "position">[] = [];

    if (left === 2) day.push({ title: "Imtihon simulyatsiyasi (vaqt bilan)", kind: "SIM", href: "/imtihon" });
    if (left === 1) day.push({ title: "Yakuniy takrorlash: xatolar testi", kind: "REVIEW", href: "/ustoz-ai/testlar/sozlash?mode=errors" });
    if (d === 0 && !i.hasDiagnostic) day.push({ title: "Diagnostika testini topshiring", kind: "DIAG", href: "/ustoz-ai/diagnostika" });
    if (i.dueErrors > 0 && d % 2 === 0 && day.length < slots) day.push({ title: "Xatolar testi: takrorlashga tayyor xatolar", kind: "REVIEW", href: "/ustoz-ai/testlar/sozlash?mode=errors" });
    while (day.length < slots) {
      if (weak.length) { const w = weak[wi++ % weak.length]; day.push({ title: `Mavzuli test: ${w.name} (hozir ${w.percent}%)`, kind: "TEST", href: topicUrl(w.topicId) }); }
      else if (i.thin.length) { const t = i.thin[ti++ % i.thin.length]; day.push({ title: `Qo'shimcha test: ${t.name} (natija kam)`, kind: "TEST", href: topicUrl(t.topicId) }); }
      else {
        // Natija ma'lumoti yo'q: uydirma mavzu emas, umumiy va bir kunda takrorlanmaydigan mashqlar aylanadi.
        const f = FALLBACK[fi++ % FALLBACK.length];
        day.push({ title: f.title, kind: "TEST", href: f.href });
      }
    }
    day.forEach((x, k) => out.push({ date, position: k, ...x }));
  }
  return out;
}

/** Zaif mavzular: ishonchi yetarli (LOW emas) va natija 70% dan past. Ma'lumoti kam mavzular alohida ("qo'shimcha test"). */
export function splitMastery(m: { topicId: string; name: string; correct: number; total: number; confidence: string }[]): { weak: Weak[]; thin: { topicId: string; name: string }[] } {
  const weak: Weak[] = [], thin: { topicId: string; name: string }[] = [];
  for (const x of m) {
    if (x.confidence === "LOW" || x.total < 3) { thin.push({ topicId: x.topicId, name: x.name }); continue; }
    const percent = Math.round((x.correct / x.total) * 100);
    if (percent < 70) weak.push({ topicId: x.topicId, name: x.name, percent });
  }
  return { weak, thin };
}

/** Yo'l xaritasi bosqichlari: faqat haqiqiy holatdan hisoblanadi (qo'lda "bajarildi" belgisi yo'q). */
export type Step = { key: string; title: string; desc: string; done: boolean; href: string };
export function roadmap(s: { hasGoal: boolean; hasDiagnostic: boolean; weakCount: number; hasMastery: boolean; checklistTotal: number; checklistDone: number; hasSimulation: boolean }): Step[] {
  return [
    { key: "goal", title: "Maqsadni belgilash", desc: "Imtihon turi, sana va kunlik vaqt", done: s.hasGoal, href: "/profil" },
    { key: "diag", title: "Diagnostika", desc: "Boshlang'ich bilim darajasi", done: s.hasDiagnostic, href: "/ustoz-ai/diagnostika" },
    { key: "weak", title: "Zaif mavzular ustida ishlash", desc: s.hasMastery ? (s.weakCount ? `${s.weakCount} ta mavzu 70% dan past` : "Zaif mavzu qolmadi") : "Avval test ishlang", done: s.hasMastery && s.weakCount === 0, href: "/ustoz-ai/bilim-xaritasi" },
    { key: "docs", title: "Hujjatlarni tayyorlash", desc: s.checklistTotal ? `${s.checklistDone}/${s.checklistTotal} tayyor` : "Shaxsiy cheklist tuzing", done: s.checklistTotal > 0 && s.checklistDone === s.checklistTotal, href: "/toifa/hujjatlar" },
    { key: "sim", title: "Imtihon simulyatsiyasi", desc: "Vaqt bilan to'liq test", done: s.hasSimulation, href: "/imtihon" },
  ];
}

export const DEFAULT_CHECKLIST = ["Pasport nusxasi", "Diplom nusxasi", "Mehnat daftarchasi ko'chirmasi", "Oxirgi malaka oshirish guvohnomasi", "Dars tahlili (portfolio)"];

/** Oy kalendari: dushanbadan boshlanadigan hafta, oldingi/keyingi oy kunlari bo'sh (null). */
export function monthGrid(year: number, month0: number): (string | null)[] {
  const first = new Date(Date.UTC(year, month0, 1));
  const lead = (first.getUTCDay() + 6) % 7;
  const days = new Date(Date.UTC(year, month0 + 1, 0)).getUTCDate();
  const cells: (string | null)[] = Array(lead).fill(null);
  for (let d = 1; d <= days; d++) cells.push(new Date(Date.UTC(year, month0, d)).toISOString().slice(0, 10));
  while (cells.length % 7) cells.push(null);
  return cells;
}
