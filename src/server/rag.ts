/**
 * Hujjat ichidan qidirish (RAG uchun tayyor interfeys). Hozirgi amalga oshirish: kalit so'zlar bo'yicha baholash (embedding yo'q).
 * Keyinroq `Retriever` boshqa (vektorli) amalga oshirish bilan almashtiriladi, chaqiruvchi kod o'zgarmaydi.
 */
export type Chunk = { idx: number; text: string };
export type Hit = { idx: number; text: string; score: number };
export interface Retriever { retrieve(question: string, chunks: Chunk[], k: number): Hit[] }

const STOP = new Set(["va", "bilan", "uchun", "bu", "shu", "bir", "ham", "yoki", "nima", "qanday", "qaysi", "kim", "qachon", "da", "ni", "ga", "dan", "ning", "the", "and"]);
/** Apostrof turlarini birlashtiradi (o', o‘, o’ → o'), kichik harfga o'tkazadi. */
export const norm = (s: string) => s.toLowerCase().replace(/[‘’ʻʼ`´]/g, "'");
export const tokens = (s: string) => (norm(s).match(/[\p{L}\p{N}']{2,}/gu) ?? []).filter((t) => !STOP.has(t));
/** O'zbek qo'shimchalari uchun oddiy qisqartirish: so'z boshidagi 5 harf bo'yicha moslik ("kasrlarni" ~ "kasrlar"). */
const stem = (t: string) => (t.length > 5 ? t.slice(0, 5) : t);

export const keywordRetriever: Retriever = {
  retrieve(question, chunks, k) {
    const q = Array.from(new Set(tokens(question).map(stem)));
    if (!q.length) return [];
    const df = new Map<string, number>();
    const docs = chunks.map((c) => { const set = new Set(tokens(c.text).map(stem)); set.forEach((t) => df.set(t, (df.get(t) ?? 0) + 1)); return { c, tf: tokens(c.text).map(stem) }; });
    const n = chunks.length || 1;
    const hits: Hit[] = [];
    for (const { c, tf } of docs) {
      let score = 0;
      for (const t of q) {
        const f = tf.filter((x) => x === t).length;
        if (f) score += (1 + Math.log(f)) * Math.log(1 + n / (df.get(t) ?? 1));
      }
      if (score > 0) hits.push({ idx: c.idx, text: c.text, score: Math.round(score * 100) / 100 });
    }
    return hits.sort((a, b) => b.score - a.score).slice(0, k);
  },
};

/** AI uchun ko'rsatma: faqat berilgan parchalarga tayanish, topilmasa shuni aytish, [n] bilan manba ko'rsatish. */
export function buildGroundedPrompt(question: string, hits: Hit[]): { system: string; user: string } {
  const system = [
    "Sen hujjat bo'yicha savolga javob beruvchi yordamchisan. Javobni FAQAT quyida berilgan parchalarga tayanib ber.",
    "Parchalarda javob bo'lmasa, aniq «Hujjatda bu haqda ma'lumot topilmadi» deb yoz va o'ylab topma.",
    "Har bir fikr oxirida manba raqamini [1], [2] ko'rinishida ko'rsat. O'zbek tilida (lotin) qisqa va aniq yoz.",
  ].join(" ");
  const user = `Parchalar:\n${hits.map((h, i) => `[${i + 1}] ${h.text}`).join("\n\n")}\n\nSavol: ${question}`;
  return { system, user };
}
