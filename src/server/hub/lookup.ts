import { Prisma } from "@prisma/client";
import { db } from "../db";
import { analyzeQuery } from "../ai/intent";
import { getSettings } from "../settings";
import { embed, embeddingVersion, embeddingsConfigured, vectorLiteral } from "./embeddings";
import { decide, rankEntries, stemsOf, type Decision, type Mode } from "./knowledgelogic";

/**
 * AI Bilim markazining QIDIRUV qismi (docs/KNOWLEDGE-HUB.md). Alohida modul: gateway ham, chat ham, internet qidiruvi ham shuni ishlatadi,
 * shu sababli bu fayl gateway'ni import qilmaydi (aylanma bog'lanish bo'lmasligi uchun). Hech qachon xato tashlamaydi: jadval yo'q yoki baza
 * sekin bo'lsa null qaytadi va AI eskicha ishlayveradi. Faqat tasdiqlangan, muddati o'tmagan, scope=GLOBAL yozuv ishlatiladi.
 */
export const ENTRY_SELECT = { id: true, questionCanonical: true, answer: true, subject: true, topic: true, category: true, status: true, scope: true, expiresAt: true, reviewedAt: true, sourceReferences: true } satisfies Prisma.KnowledgeEntrySelect;
export type Row = Prisma.KnowledgeEntryGetPayload<{ select: typeof ENTRY_SELECT }>;

export const isMissing = (e: unknown) => e instanceof Prisma.PrismaClientKnownRequestError && (e.code === "P2021" || e.code === "P2022");
let warnedMissing = false;
export function soft(where: string, e: unknown) {
  if (isMissing(e)) { if (!warnedMissing) { warnedMissing = true; console.error(`Bilim markazi jadvallari yo'q (${where}): prisma/supabase-update-knowledge-base.sql qo'llanmagan.`); } return; }
  console.error(`Bilim markazi (${where}):`, (e as Error).message);
}

export async function hubMode(): Promise<Mode> {
  try { return (await getSettings()).ai.hubMode ?? "off"; } catch { return "off"; }
}

// ---------- fan va mavzu ----------
let topicCache: { at: number; rows: { name: string; stems: string[]; subject: string }[] } | null = null;
async function topicList() {
  if (topicCache && Date.now() - topicCache.at < 10 * 60_000) return topicCache.rows;
  const rows = (await db.topic.findMany({ select: { name: true, subject: { select: { name: true } } }, take: 800 })).map((t) => ({ name: t.name, stems: stemsOf(t.name), subject: t.subject.name.toLowerCase() }));
  topicCache = { at: Date.now(), rows };
  return rows;
}

/** Savolning fani va mavzusi: avval qoidalar (intent.ts), mavzu «Fanlar va mavzular» ro'yxatidan. Topilmasa bo'sh satr. */
export async function detectSubjectTopic(question: string): Promise<{ subject: string; topic: string }> {
  const subject = analyzeQuery(question).spec.subject ?? "";
  try {
    const q = new Set(stemsOf(question));
    let best: { name: string; subject: string; matched: number; ratio: number } | null = null;
    for (const t of await topicList()) {
      if (!t.stems.length) continue;
      const matched = t.stems.filter((s) => q.has(s)).length;
      const ratio = matched / t.stems.length;
      if (matched >= 1 && ratio >= 0.75 && (!subject || t.subject === subject || !t.subject) && (!best || matched > best.matched || (matched === best.matched && ratio > best.ratio))) best = { name: t.name, subject: t.subject, matched, ratio };
    }
    return { subject: subject || best?.subject || "", topic: best?.name ?? "" };
  } catch (e) { soft("mavzu", e); return { subject, topic: "" }; }
}

// ---------- vektor (ixtiyoriy) ----------
let vecReady: { at: number; ok: boolean } | null = null;
export async function vectorReady(): Promise<boolean> {
  if (vecReady && Date.now() - vecReady.at < 5 * 60_000) return vecReady.ok;
  let ok = false;
  try { const r = await db.$queryRaw<{ t: string | null }[]>`SELECT to_regclass('"KnowledgeEmbedding"')::text AS t`; ok = !!r[0]?.t; } catch { ok = false; }
  vecReady = { at: Date.now(), ok };
  return ok;
}

async function vectorSims(question: string): Promise<Map<string, number> | undefined> {
  try {
    if (!embeddingsConfigured() || !(await vectorReady())) return undefined;
    const v = await embed(question, "RETRIEVAL_QUERY");
    if (!v) return undefined;
    const lit = vectorLiteral(v);
    const rows = await db.$queryRaw<{ id: string; sim: number }[]>`SELECT e."knowledgeId" AS id, 1 - (e."embedding" <=> ${lit}::vector) AS sim FROM "KnowledgeEmbedding" e JOIN "KnowledgeEntry" k ON k."id" = e."knowledgeId" WHERE k."status" = 'APPROVED' AND k."scope" = 'GLOBAL' AND (k."expiresAt" IS NULL OR k."expiresAt" > now()) ORDER BY e."embedding" <=> ${lit}::vector LIMIT 10`;
    return new Map(rows.map((r) => [r.id, Number(r.sim)]));
  } catch (e) { soft("vektor qidiruv", e); return undefined; }
}

/** Yozuvning savol matni uchun vektor hisoblab saqlaydi (ixtiyoriy; bajarilmasa qidiruv kalit so'zlar bilan ishlayveradi). */
export async function storeEmbedding(entryId: string, question: string): Promise<boolean> {
  try {
    if (!embeddingsConfigured() || !(await vectorReady())) return false;
    const v = await embed(question, "RETRIEVAL_DOCUMENT");
    if (!v) return false;
    const lit = vectorLiteral(v), ver = embeddingVersion();
    await db.$executeRaw`INSERT INTO "KnowledgeEmbedding" ("knowledgeId", "embedding", "modelVersion") VALUES (${entryId}, ${lit}::vector, ${ver}) ON CONFLICT ("knowledgeId") DO UPDATE SET "embedding" = EXCLUDED."embedding", "modelVersion" = EXCLUDED."modelVersion", "updatedAt" = now()`;
    await db.knowledgeEntry.update({ where: { id: entryId }, data: { embeddingModelVersion: ver } });
    return true;
  } catch (e) { soft("embedding saqlash", e); return false; }
}

// ---------- qidiruv ----------
export type HubLookup = { decision: Decision<Row>; subject: string; topic: string; needsFresh: boolean };

/**
 * Savolga tasdiqlangan bilimdan javob qidiradi. Xato bo'lsa null (chaqiruvchi AI ga o'tadi).
 * `topic: false`: fan/mavzuni aniqlamaydi (statistika kerak bo'lmagan joylarda: bazaga bitta so'rov kam).
 */
export async function hubLookup(question: string, opts: { topic?: boolean } = {}): Promise<HubLookup | null> {
  try {
    const now = new Date();
    const intent = analyzeQuery(question, now);
    const stems = stemsOf(question).slice(0, 8);
    if (!stems.length) return null;
    const usable: Prisma.KnowledgeEntryWhereInput = { status: "APPROVED", scope: "GLOBAL", OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] };
    const [kw, vec, st] = await Promise.all([
      db.knowledgeEntry.findMany({ where: { AND: [usable, { OR: stems.map((s) => ({ searchText: { contains: s } })) }] }, select: ENTRY_SELECT, take: 60 }),
      vectorSims(question),
      opts.topic === false ? Promise.resolve({ subject: intent.spec.subject ?? "", topic: "" }) : detectSubjectTopic(question),
    ]);
    let rows = kw;
    if (vec) {
      const need = [...vec.keys()].filter((id) => !kw.some((r) => r.id === id));
      if (need.length) rows = [...kw, ...(await db.knowledgeEntry.findMany({ where: { AND: [usable, { id: { in: need } }] }, select: ENTRY_SELECT }))];
    }
    const decision = decide(rankEntries(question, rows, now, vec), question, { needsFresh: intent.needsFresh, now });
    return { decision, subject: st.subject, topic: st.topic, needsFresh: intent.needsFresh };
  } catch (e) { soft("qidiruv", e); return null; }
}
