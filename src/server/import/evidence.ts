import { db } from "../db";
import { hubLookup, hubMode } from "../hub/lookup";
import { entrySources, stemsOf } from "../hub/knowledgelogic";
import { keywordRetriever } from "../rag";
import { tavilyConfigured, tavilySearch } from "../ai/tavily";
import { hostOf, rankHits, TRUST_LABEL, type Trust } from "../ai/trust";
import type { Evidence } from "./verifylogic";

/**
 * Javob dalillarini yig'ish: tasdiqlangan bilim (AI Bilim markazi, faqat `on` rejimida), BILIMXONA (foydalanuvchining o'z va ommaviy hujjatlari)
 * va internet (Tavily, faqat kerak bo'lganda). Faqat HAQIQATAN topilgan manbalar qaytariladi: nom, havola va parcha to'qilmaydi.
 */
export type CtxItem = { id: string; kind: "HUB" | "LIBRARY" | "WEB"; source: string; title: string; url?: string; text: string; trust?: string; note?: string };

export async function gatherLocalContext(userId: string, question: string): Promise<CtxItem[]> {
  const items: CtxItem[] = [];
  const q = question.slice(0, 400);
  try {
    if ((await hubMode()) === "on") {
      const h = await hubLookup(q, { topic: false });
      if (h && h.decision.kind !== "none") {
        const hits = h.decision.kind === "direct" ? [h.decision.hit] : h.decision.hits;
        hits.slice(0, 2).forEach((x, i) => {
          const src = entrySources(x.entry.sourceReferences)[0];
          items.push({ id: `H${i + 1}`, kind: "HUB", source: "AI Bilim markazi", title: x.entry.questionCanonical.slice(0, 120), url: src?.url, trust: src?.trust, text: x.entry.answer.slice(0, 700) });
        });
      }
    }
  } catch (e) { console.error("import: bilim markazi", (e as Error).message); }
  try {
    const stems = stemsOf(q).slice(0, 5);
    if (stems.length) {
      const rows = await db.libraryChunk.findMany({
        where: { doc: { status: "READY", OR: [{ ownerId: userId }, { visibility: "PUBLIC" }] }, OR: stems.map((s) => ({ text: { contains: s, mode: "insensitive" as const } })) },
        select: { idx: true, text: true, doc: { select: { title: true } } }, take: 40,
      });
      if (rows.length) {
        const hits = keywordRetriever.retrieve(q, rows.map((r, i) => ({ idx: i, text: r.text })), 2);
        hits.forEach((h, i) => { const r = rows[h.idx]; items.push({ id: `L${i + 1}`, kind: "LIBRARY", source: "BILIMXONA", title: r.doc.title, note: `${r.idx + 1}-bo'lak`, text: r.text.slice(0, 700) }); });
      }
    }
  } catch (e) { console.error("import: kutubxona", (e as Error).message); }
  return items;
}

export async function webContext(userId: string, query: string): Promise<CtxItem[]> {
  if (!tavilyConfigured()) return [];
  const r = await tavilySearch(userId, query.slice(0, 300));
  if (!r) return [];
  return rankHits(r.hits, 3).map((h, i) => ({ id: `W${i + 1}`, kind: "WEB" as const, source: hostOf(h.url), title: h.title, url: h.url, trust: h.trust, text: h.content.slice(0, 700) }));
}

const quote = (t: string) => t.replace(/\s+/g, " ").trim().slice(0, 220);

/** Haqiqatan ishlatilgan kontekst elementlaridan dalil yozuvlari. `usedIds`: AI «usedSources» da ko'rsatgani (bo'sh bo'lsa, taklif qilingan kontekst «ko'rilgan manba» sifatida beriladi). */
export function contextEvidence(items: CtxItem[], usedIds: string[] | null | undefined): Evidence[] {
  const picked = usedIds && usedIds.length ? items.filter((c) => usedIds.includes(c.id)) : items;
  return picked.map((c) => ({
    type: c.kind, title: c.title, url: c.url, quote: quote(c.text), trust: c.trust ? TRUST_LABEL[c.trust as Trust] ?? c.trust : undefined,
    note: [c.source, c.note, usedIds && usedIds.length ? "AI shu manbaga tayandi" : "tekshirishda ko'rib chiqilgan manba"].filter(Boolean).join(" · "),
  }));
}

export type EvidenceInput = {
  fileName: string; page: string | null;
  key: string[] | null; keySource: "INLINE" | "SEPARATE_FILE" | null; keyFileName?: string | null;
  computed: { expression: string; value: number } | null;
  aiExplanation: string | null; aiModel: string | null;
  ctx: Evidence[];
  /** Faylda javob yonida berilgan izoh (kalitdagi yoki savol yonidagi): dalil emas, faqat fayldagi ma'lumot. */
  keyExplanation?: string | null;
};

/** Savol uchun «Javobni qanday aniqladik?» dalillari ro'yxati. */
export function buildEvidence(i: EvidenceInput): Evidence[] {
  const out: Evidence[] = [];
  out.push({ type: "SOURCE", title: `Asl fayl: ${i.fileName}`, page: i.page ?? undefined, note: i.page ? `Savol shu joyda: ${i.page}` : "Savol asl faylda" });
  if (i.key) out.push(i.keySource === "SEPARATE_FILE"
    ? { type: "SEPARATE_KEY", title: i.keyFileName ? `Alohida javoblar kaliti: ${i.keyFileName}` : "Fayl ichidagi javoblar kaliti (ro'yxat)", note: `Kalitda: ${i.key.join(", ")}. Bu tekshirilgan haqiqat emas, faqat fayldagi ma'lumot.` }
    : { type: "FILE_KEY", title: "Fayldagi javob belgisi / kalit", page: i.page ?? undefined, note: `Faylda: ${i.key.join(", ")}. Bu tekshirilgan haqiqat emas, faqat fayldagi ma'lumot.` });
  if (i.keyExplanation) out.push({ type: i.keySource === "SEPARATE_FILE" ? "SEPARATE_KEY" : "FILE_KEY", title: "Fayldagi izoh", quote: i.keyExplanation, note: "Muallifning izohi: tekshirilgan haqiqat emas, faqat fayldagi ma'lumot." });
  if (i.computed) out.push({ type: "COMPUTED", title: "Hisoblab tekshirildi", note: `${i.computed.expression} = ${i.computed.value}` });
  out.push(...i.ctx);
  if (i.aiExplanation) out.push({ type: "AI", title: "AI izohi", note: i.aiModel ? `Model: ${i.aiModel}` : undefined, quote: i.aiExplanation });
  return out;
}
