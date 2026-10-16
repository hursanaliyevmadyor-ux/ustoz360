/** Dashboard uchun sof hisob-kitoblar (bazaga bog'liq emas, test qilinadi). */
export function daysUntil(examDate: Date | null, now = new Date()): number | null {
  if (!examDate) return null;
  const ms = examDate.getTime() - now.getTime();
  return ms < 0 ? null : Math.ceil(ms / 86_400_000);
}

export type Mastery = { name: string; correct: number; total: number; confidence: "LOW" | "MEDIUM" | "HIGH" };

/** Umumiy daraja: faqat ishonchliligi LOW bo'lmagan mavzular hisobga olinadi; yetarli ma'lumot bo'lmasa null. */
export function overallPercent(m: Mastery[]): number | null {
  const ok = m.filter((x) => x.confidence !== "LOW");
  const total = ok.reduce((a, x) => a + x.total, 0);
  if (ok.length === 0 || total === 0) return null;
  return Math.round((ok.reduce((a, x) => a + x.correct, 0) / total) * 100);
}

export type Task = { id: string; title: string; hint: string; href: string };

/** Vazifalar real holatdan olinadi (to'qilgan reja emas). */
export function buildTasks(i: { hasDiagnostic: boolean; dueErrors: number; mastery: Mastery[]; hasExamDate: boolean }): Task[] {
  const t: Task[] = [];
  if (!i.hasDiagnostic) t.push({ id: "diag", title: "Diagnostikani topshiring", hint: "Bilim xaritasi va reja shundan tuziladi", href: "/ustoz-ai/diagnostika" });
  if (i.dueErrors > 0) t.push({ id: "review", title: `Xatolarni takrorlang (${i.dueErrors} ta)`, hint: "Muddati kelgan xatolar", href: "/ustoz-ai/testlar/sozlash?mode=errors" });
  const weak = i.mastery.filter((x) => x.confidence !== "LOW" && x.total > 0 && x.correct / x.total < 0.6).sort((a, b) => a.correct / a.total - b.correct / b.total)[0];
  if (weak) t.push({ id: "weak", title: `Zaif mavzu: ${weak.name}`, hint: `${Math.round((weak.correct / weak.total) * 100)}%, qayta o'rganing`, href: "/ustoz-ai/bilim-xaritasi" });
  const thin = i.mastery.find((x) => x.confidence === "LOW");
  if (thin) t.push({ id: "thin", title: `Qo'shimcha diagnostika: ${thin.name}`, hint: "Savollar kam, xulosa chiqarib bo'lmaydi", href: "/ustoz-ai/diagnostika" });
  if (!i.hasExamDate) t.push({ id: "exam", title: "Imtihon sanasini belgilang", hint: "Profilda", href: "/profil" });
  return t;
}
