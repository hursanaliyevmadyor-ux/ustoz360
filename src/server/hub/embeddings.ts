/**
 * Ixtiyoriy vektorli (semantik) qidiruv uchun embedding: Gemini embedContent. Kalit faqat serverda (GEMINI_API_KEY).
 * Kalit yo'q, model xato bersa yoki vektor jadvali (prisma/supabase-update-knowledge-vector.sql) yo'q bo'lsa, qidiruv kalit so'zlar bilan ishlaydi.
 */
export const EMBED_DIMS = 768;
const BASE = () => process.env.GEMINI_API_BASE || "https://generativelanguage.googleapis.com/v1beta";
export const embedModel = () => process.env.KNOWLEDGE_EMBED_MODEL || "gemini-embedding-001";
export const embeddingVersion = () => `${embedModel()}@${EMBED_DIMS}`;
export const embeddingsConfigured = () => Boolean(process.env.GEMINI_API_KEY) && process.env.KNOWLEDGE_EMBEDDINGS !== "off";

export const validVector = (v: unknown): v is number[] => Array.isArray(v) && v.length === EMBED_DIMS && v.every((x) => typeof x === "number" && Number.isFinite(x));
/** pgvector matn ko'rinishi: "[0.1,0.2,...]". */
export const vectorLiteral = (v: number[]) => `[${v.map((x) => Number(x.toFixed(6))).join(",")}]`;

let warned = false;
/** Matn uchun vektor yoki null (hech qachon xato tashlamaydi: chaqiruvchi kalit so'zli qidiruvga o'tadi). */
export async function embed(text: string, task: "RETRIEVAL_QUERY" | "RETRIEVAL_DOCUMENT"): Promise<number[] | null> {
  if (!embeddingsConfigured()) return null;
  const input = text.replace(/\s+/g, " ").trim().slice(0, 2000);
  if (!input) return null;
  try {
    const res = await fetch(`${BASE()}/models/${embedModel()}:embedContent`, {
      method: "POST", signal: AbortSignal.timeout(6000),
      headers: { "content-type": "application/json", "x-goog-api-key": process.env.GEMINI_API_KEY ?? "" },
      body: JSON.stringify({ model: `models/${embedModel()}`, content: { parts: [{ text: input }] }, taskType: task, outputDimensionality: EMBED_DIMS }),
    });
    if (!res.ok) { if (!warned) { warned = true; console.error("Embedding xizmati javob bermadi:", res.status); } return null; }
    const d = (await res.json()) as { embedding?: { values?: unknown } };
    return validVector(d.embedding?.values) ? d.embedding.values : null;
  } catch (e) {
    if (!warned) { warned = true; console.error("Embedding xatosi:", (e as Error).name); }
    return null;
  }
}
