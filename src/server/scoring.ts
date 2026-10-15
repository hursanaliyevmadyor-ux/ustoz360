/** Sof funksiyalar: bazaga bog'liq emas, unit test bilan tekshiriladi. */

export type Confidence = "LOW" | "MEDIUM" | "HIGH";

/** 2–3 ta savol asosida mavzu o'zlashtirilgan deb xulosa chiqarilmaydi. */
export function confidenceFor(totalAnswered: number): Confidence {
  if (totalAnswered < 4) return "LOW";
  if (totalAnswered < 8) return "MEDIUM";
  return "HIGH";
}

export type TopicResult = { topicId: string; correct: number; total: number };

export function groupByTopic(rows: { topicId: string; isCorrect: boolean }[]): TopicResult[] {
  const m = new Map<string, TopicResult>();
  for (const r of rows) {
    const e = m.get(r.topicId) ?? { topicId: r.topicId, correct: 0, total: 0 };
    e.total++;
    if (r.isCorrect) e.correct++;
    m.set(r.topicId, e);
  }
  return [...m.values()];
}

/** Oraliqli takrorlash (soddalashtirilgan SM-2): xato → 1 kun; to'g'ri takrorlash → interval ikki baravar. */
export function nextReview(now: Date, prevInterval: number, wasCorrect: boolean) {
  const intervalDays = wasCorrect ? Math.min(prevInterval * 2, 64) : 1;
  const nextReviewAt = new Date(now.getTime() + intervalDays * 86_400_000);
  return { intervalDays, nextReviewAt, mastered: wasCorrect && intervalDays >= 8 };
}

export function shuffle<T>(arr: T[], rnd: () => number = Math.random): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
