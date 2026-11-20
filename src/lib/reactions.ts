/** Jonli reaksiyalar: o'quvchi emoji bosadi, hamma ekranida ko'tarilib yo'qoladi. Saqlanmaydi. */
export const REACTIONS = ["👏", "❤️", "😂", "🤔", "👍", "🎉"] as const;
export const REACTION_GAP_MS = 1200;

/** Kelgan xabardan reaksiyani tekshirib oladi (faqat ruxsat etilgan emoji); yaroqsiz bo'lsa null. */
export function parseReaction(v: unknown): string | null {
  if (!v || typeof v !== "object") return null;
  const e = (v as { e?: unknown }).e;
  return typeof e === "string" && (REACTIONS as readonly string[]).includes(e) ? e : null;
}

/** Har bir yuboruvchidan tez-tez kelgan reaksiyalarni tashlaydi (ekran to'lib ketmasligi uchun). */
export class ReactionLimiter {
  private last = new Map<string, number>();
  constructor(private now: () => number = () => Date.now(), private gap = REACTION_GAP_MS) {}
  allow(from: string): boolean {
    const t = this.now(), prev = this.last.get(from);
    if (prev !== undefined && t - prev < this.gap) return false;
    this.last.set(from, t);
    if (this.last.size > 300) this.last.clear();
    return true;
  }
}
