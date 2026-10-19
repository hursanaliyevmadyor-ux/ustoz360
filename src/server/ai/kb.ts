import { httpsUrl } from "../../lib/websources";
import { db } from "../db";
import { entrySources, scoreEntry } from "../hub/knowledgelogic";
import { hubLookup, hubMode } from "../hub/lookup";
import { tokens } from "../rag";

/**
 * Tekshirilgan bilim bazasi: administrator manba bilan kiritgan rasmiy ma'lumotlar (OfficialInfo), admin tasdiqlagan ommaviy kutubxona hujjatlari
 * va AI Bilim markazidagi tasdiqlangan bilimlar (hubMode=on bo'lsa: bilim bitta joyda, internet qidiruvi ham shuni ishlatadi).
 * Internetga chiqishdan oldin shu yerdan qidiriladi: topilsa kredit sarflanmaydi.
 */
export type KbHit = {
  kind: "official" | "library" | "hub"; title: string; text: string; url: string | null; verified: boolean; ratio: number; matched: number;
  /** Tekshirilgan va yaqinda (45 kun ichida) yangilangan: yangilik muhim savolda ham internetga chiqmasdan ishonish mumkin. */
  fresh: boolean;
};

const FRESH_DAYS = 45;

const stem = (t: string) => (t.length > 5 ? t.slice(0, 5) : t);
const stems = (s: string) => Array.from(new Set(tokens(s).map(stem)));

/** Savol so'zlarining qanchasi matnda uchraydi: soni va ulushi. Toza funksiya. */
export function kbScore(question: string, text: string): { matched: number; ratio: number } {
  const q = stems(question);
  if (!q.length) return { matched: 0, ratio: 0 };
  const have = new Set(stems(text));
  const matched = q.filter((t) => have.has(t)).length;
  return { matched, ratio: matched / q.length };
}

/** Javob berishga yetarli darajada mosmi: kamida 2 ta (savol qisqa bo'lsa 1 ta) so'z va 60% moslik. */
export function kbStrong(h: { matched: number; ratio: number }, questionTokens: number): boolean {
  return h.matched >= Math.min(2, Math.max(1, questionTokens)) && h.ratio >= 0.6;
}

export const questionTokenCount = (q: string) => stems(q).length;

export async function searchKnowledge(question: string, origin = ""): Promise<KbHit[]> {
  const q = stems(question);
  if (!q.length) return [];
  const out: KbHit[] = [];

  try {
    const rows = await db.officialInfo.findMany({ where: { active: true }, take: 200 });
    for (const r of rows) {
      const text = [r.title, r.note, r.sourceName].filter(Boolean).join(". ");
      const s = kbScore(question, text);
      const stamp = (r.verifiedAt ?? r.updatedAt)?.getTime();
      const fresh = r.verified && typeof stamp === "number" && Date.now() - stamp <= FRESH_DAYS * 86_400_000;
      if (s.matched) out.push({ kind: "official", title: r.title, text: text.slice(0, 700), url: httpsUrl(r.url), verified: r.verified, fresh, ...s });
    }
  } catch (e) { console.error("KB rasmiy ma'lumot:", (e as Error).message); }

  try {
    const words = Array.from(new Set(tokens(question).filter((t) => t.length >= 4))).slice(0, 4);
    if (words.length) {
      const docs = await db.libraryDoc.findMany({
        where: { visibility: "PUBLIC", status: "READY", OR: words.flatMap((w) => [{ title: { contains: w, mode: "insensitive" as const } }, { subject: { contains: w, mode: "insensitive" as const } }, { tags: { has: w } }]) },
        select: { id: true, title: true }, take: 8,
      });
      if (docs.length) {
        const title = new Map(docs.map((d) => [d.id, d.title]));
        const chunks = await db.libraryChunk.findMany({ where: { docId: { in: docs.map((d) => d.id) } }, select: { docId: true, text: true }, take: 500 });
        const lib: KbHit[] = [];
        for (const c of chunks) {
          const s = kbScore(question, c.text);
          if (s.matched) lib.push({ kind: "library", title: title.get(c.docId) ?? "Kutubxona hujjati", text: c.text.slice(0, 700), url: httpsUrl(origin ? `${origin}/bilimxona` : null), verified: true, fresh: false, ...s });
        }
        out.push(...lib.sort((a, b) => b.matched - a.matched || b.ratio - a.ratio).slice(0, 3));
      }
    }
  } catch (e) { console.error("KB kutubxona:", (e as Error).message); }

  // AI Bilim markazi: faqat tasdiqlangan, muddati o'tmagan yozuvlar (hubLookup shuni kafolatlaydi). Bazadagi muddat belgilangan yoki yaqinda ko'rilgan yozuv «yangi».
  try {
    if ((await hubMode()) === "on") {
      const hub = await hubLookup(question, { topic: false });
      const hits = !hub || hub.decision.kind === "none" ? [] : hub.decision.kind === "direct" ? [hub.decision.hit] : hub.decision.hits;
      for (const h of hits) {
        const e = h.entry;
        const s = scoreEntry(question, e);
        const stamp = e.reviewedAt.getTime();
        out.push({
          kind: "hub", title: e.questionCanonical, text: e.answer.slice(0, 700), url: entrySources(e.sourceReferences)[0]?.url ?? null, verified: true,
          fresh: !!e.expiresAt || Date.now() - stamp <= FRESH_DAYS * 86_400_000, matched: Math.max(s.matched, h.matched), ratio: Math.max(s.ratio, h.ratio),
        });
      }
    }
  } catch (e) { console.error("KB bilim markazi:", (e as Error).message); }

  return out.sort((a, b) => b.matched - a.matched || b.ratio - a.ratio).slice(0, 4);
}
