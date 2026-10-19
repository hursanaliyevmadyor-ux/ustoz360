import { Prisma } from "@prisma/client";
import type { Source } from "../../lib/websources";
import { ApiError, requireVerified } from "../auth";
import { audit } from "../audit";
import { db } from "../db";
import { analyzeQuery } from "../ai/intent";
import { getSettings } from "../settings";
import { aiConfigured, aiModel, checkRate, freeProviderInfo } from "../ai/gateway";
import { embed, embeddingVersion, embeddingsConfigured, vectorLiteral } from "./embeddings";
import {
  candidateExpiry, candidateGate, canRestore, decide, effectiveStatus, entrySources, feedbackVerdict, normalizeSources, questionKey, rankEntries,
  runAutoChecks, searchTextOf, stemsOf, transition, userRef, visibleDemand, type Decision, type EntryAction, type Mode,
} from "./knowledgelogic";
import type { EntryInput } from "./knowledgevalid";
import { findPii, scrubPii } from "./privacy";
import { errorRate, ROLE_LABEL, type ProviderStat, type Role } from "./routing";

/**
 * AI Bilim markazi: bazaga tegadigan qism (docs/KNOWLEDGE-HUB.md). Chat yo'lidagi funksiyalar (hubLookup, recordOutcome, proposeCandidate, ...)
 * HECH QACHON xato tashlamaydi: jadval yo'q yoki baza sekin bo'lsa ham AI eskicha ishlayveradi. Admin funksiyalari xatoni ko'rsatadi.
 * Umumiy bilimda faqat tasdiqlangan, muddati o'tmagan, scope=GLOBAL yozuv ishlatiladi. Foydalanuvchi identifikatori hech qayerda saqlanmaydi (faqat bir tomonlama xesh).
 */
export const CONSENT_PURPOSE = "knowledge_improvement";
export const POLICY_VERSION = "2026-10-19";
/** Foydalanuvchiga ko'rsatiladigan tushuntirish (AI sahifasidagi rozilik bloki). */
export const CONSENT_TEXT = "Savolingiz AI xizmatiga yuboriladi. Ruxsat bersangiz, ism-familiya, telefon va boshqa shaxsiy ma'lumotlardan tozalangan, umumlashtirilgan savol va AI javobi umumiy bilimni yaxshilash uchun administratorga ko'rib chiqishga yuboriladi. Admin tasdiqlamaguncha u hech kimga ko'rsatilmaydi. Chat tarixingiz hech qachon ko'chirilmaydi. Ruxsatni istalgan vaqtda qaytarib olsangiz, ko'rib chiqilmagan savollaringiz o'chiriladi. Admin tasdiqlab umumiy bilimga aylangan javob sizga bog'lanmagan, shuning uchun uni sizning nomingiz bilan o'chirib bo'lmaydi.";

const ENTRY_SELECT = { id: true, questionCanonical: true, answer: true, subject: true, topic: true, category: true, status: true, scope: true, expiresAt: true, reviewedAt: true, sourceReferences: true } satisfies Prisma.KnowledgeEntrySelect;
export type Row = Prisma.KnowledgeEntryGetPayload<{ select: typeof ENTRY_SELECT }>;

const isMissing = (e: unknown) => e instanceof Prisma.PrismaClientKnownRequestError && (e.code === "P2021" || e.code === "P2022");
let warnedMissing = false;
function soft(where: string, e: unknown) {
  if (isMissing(e)) { if (!warnedMissing) { warnedMissing = true; console.error(`Bilim markazi jadvallari yo'q (${where}): prisma/supabase-update-knowledge-base.sql qo'llanmagan.`); } return; }
  console.error(`Bilim markazi (${where}):`, (e as Error).message);
}

const dayStart = (d = new Date()) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
const secret = () => process.env.AUTH_SECRET || "";
const TX = { maxWait: 15_000, timeout: 60_000 } as const;

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

/** Savolga tasdiqlangan bilimdan javob qidiradi. Xato bo'lsa null (chaqiruvchi AI ga o'tadi). */
export async function hubLookup(question: string): Promise<HubLookup | null> {
  try {
    const now = new Date();
    const intent = analyzeQuery(question, now);
    const stems = stemsOf(question).slice(0, 8);
    if (!stems.length) return null;
    const usable: Prisma.KnowledgeEntryWhereInput = { status: "APPROVED", scope: "GLOBAL", OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] };
    const [kw, vec, st] = await Promise.all([
      db.knowledgeEntry.findMany({ where: { AND: [usable, { OR: stems.map((s) => ({ searchText: { contains: s } })) }] }, select: ENTRY_SELECT, take: 60 }),
      vectorSims(question),
      detectSubjectTopic(question),
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

export async function markServed(entryId: string) {
  try { await db.knowledgeEntry.update({ where: { id: entryId }, data: { servedCount: { increment: 1 }, lastServedAt: new Date() } }); } catch (e) { soft("servedCount", e); }
}

/**
 * Bilim bazasidan to'g'ridan-to'g'ri javob berishdan oldin AI funksiyalari bilan bir xil tekshiruvlar: tasdiqlangan akkaunt, admin yoqqanmi, daqiqalik chegara.
 * Jurnal qatori (`hub-kb`) Claude kunlik limitiga hisoblanmaydi, lekin daqiqalik chegarani sanaydi (suiiste'molga qarshi).
 */
export async function serveDirect(userId: string, entryId: string, t0 = Date.now()) {
  await requireVerified(userId);
  const s = (await getSettings()).ai;
  if (!s.enabled || !s.freeEnabled) throw new ApiError(503, "AI xizmati administrator tomonidan vaqtincha o'chirilgan.", "ai_disabled");
  await checkRate(userId, s.perMinute);
  await db.aiRequest.create({ data: { userId, feature: "hub-kb", model: "kb", status: "ok", latencyMs: Date.now() - t0, promptVersion: "hub@1" }, select: { id: true } }).catch(() => undefined);
  await markServed(entryId);
}

// ---------- umumlashtirilgan ehtiyoj (foydalanuvchisiz) ----------
export type Outcome = "kb" | "grounded" | "ai" | "error";
export async function recordOutcome(o: { subject: string; topic: string; outcome: Outcome }) {
  const inc = { asked: 1, fromKb: o.outcome === "kb" ? 1 : 0, byAi: o.outcome === "grounded" || o.outcome === "ai" ? 1 : 0, unanswered: o.outcome === "ai" || o.outcome === "error" ? 1 : 0 };
  const where = { day_subject_topic: { day: dayStart(), subject: o.subject, topic: o.topic } };
  const update = { asked: { increment: inc.asked }, fromKb: { increment: inc.fromKb }, byAi: { increment: inc.byAi }, unanswered: { increment: inc.unanswered } };
  try {
    try { await db.knowledgeDemand.upsert({ where, create: { day: dayStart(), subject: o.subject, topic: o.topic, ...inc }, update }); }
    catch (e) { if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") await db.knowledgeDemand.update({ where, data: update }); else throw e; }
  } catch (e) { soft("ehtiyoj", e); }
}

// ---------- rozilik ----------
export async function consentState(userId: string) {
  try {
    const r = await db.knowledgeConsent.findUnique({ where: { userId_purpose: { userId, purpose: CONSENT_PURPOSE } } });
    return { enabled: !!r && !r.revokedAt, policyVersion: r?.policyVersion ?? POLICY_VERSION, grantedAt: r && !r.revokedAt ? r.grantedAt.toISOString() : null, available: true };
  } catch (e) { soft("rozilik", e); return { enabled: false, policyVersion: POLICY_VERSION, grantedAt: null, available: false }; }
}

/** Rozilikni qaytarib olish: ko'rib chiqilmagan nomzodlardan foydalanuvchining ulushi o'chiriladi. */
async function withdrawContributions(userId: string) {
  if (!secret()) return;
  const ref = userRef(secret(), "contrib", userId);
  const rows = await db.knowledgeCandidate.findMany({ where: { contributorRefs: { has: ref }, reviewStatus: { in: ["PENDING_REVIEW", "NEEDS_SOURCE"] } }, select: { id: true, contributorRefs: true, askCount: true } });
  for (const c of rows) {
    const rest = c.contributorRefs.filter((r) => r !== ref);
    if (!rest.length) await db.knowledgeCandidate.delete({ where: { id: c.id } });
    else await db.knowledgeCandidate.update({ where: { id: c.id }, data: { contributorRefs: rest, askCount: Math.max(1, c.askCount - 1) } });
  }
}

export async function setConsent(userId: string, enabled: boolean) {
  const key = { userId_purpose: { userId, purpose: CONSENT_PURPOSE } };
  try {
    if (enabled) await db.knowledgeConsent.upsert({ where: key, create: { userId, purpose: CONSENT_PURPOSE, policyVersion: POLICY_VERSION }, update: { policyVersion: POLICY_VERSION, grantedAt: new Date(), revokedAt: null } });
    else { await db.knowledgeConsent.updateMany({ where: { userId, purpose: CONSENT_PURPOSE, revokedAt: null }, data: { revokedAt: new Date() } }); await withdrawContributions(userId); }
  } catch (e) {
    if (isMissing(e)) throw new ApiError(503, "Bu imkoniyat hali yoqilmagan.", "hub_unavailable");
    throw e;
  }
  return consentState(userId);
}

// ---------- nomzod yaratish (chat yo'lidan) ----------
export type ProposeArgs = {
  userId: string; question: string; answer: string; mode: Mode; kb: "direct" | "grounded" | "none"; subject: string; topic: string;
  provider?: string; model?: string; sources?: Source[]; evidenceTexts?: string[]; privateContext?: boolean;
};

/**
 * AI javobi umumiy bilimga NOMZOD bo'lishi mumkinmi: faqat foydalanuvchi roziligi bilan, shaxsiy ma'lumotsiz, bazada javob yo'q bo'lsa.
 * Nomzod bilim emas: admin ko'rib chiqmaguncha hech kimga ko'rsatilmaydi. Hech qachon xato tashlamaydi.
 */
export async function proposeCandidate(a: ProposeArgs): Promise<{ created: boolean; reason?: string }> {
  try {
    if (a.mode === "off" || !secret()) return { created: false, reason: a.mode === "off" ? "mode_off" : "no_secret" };
    const consent = (await consentState(a.userId)).enabled;
    const piiFound = findPii(a.question).length > 0 || findPii(a.answer).length > 0;
    const gate = candidateGate({ mode: a.mode, consent, question: a.question, answer: a.answer, privateContext: a.privateContext, kb: a.kb, piiFound });
    if (!gate.ok) return { created: false, reason: gate.reason };

    const ref = userRef(secret(), "contrib", a.userId);
    const key = questionKey(a.question);
    const existing = await db.knowledgeCandidate.findUnique({ where: { questionKey: key }, select: { id: true, reviewStatus: true, contributorRefs: true } });
    if (existing) {
      if (!["PENDING_REVIEW", "NEEDS_SOURCE"].includes(existing.reviewStatus)) return { created: false, reason: "reviewed" };
      if (existing.contributorRefs.includes(ref)) return { created: false, reason: "same_user" };
      await db.knowledgeCandidate.update({ where: { id: existing.id }, data: { askCount: { increment: 1 }, contributorRefs: { push: ref } } });
      return { created: true, reason: "counted" };
    }

    const sources = (a.sources ?? []).filter((s) => !!s.url);
    const checks = runAutoChecks({ question: a.question, answer: a.answer, sources: sources.map((s, i) => ({ url: s.url, title: s.title, trust: s.trust, content: a.evidenceTexts?.[i] })) });
    const intent = analyzeQuery(a.question);
    const c = await db.knowledgeCandidate.create({
      data: {
        questionKey: key, normalizedQuestion: scrubPii(a.question).text.replace(/\s+/g, " ").trim().slice(0, 500), proposedAnswer: scrubPii(a.answer).text.trim().slice(0, 6000),
        subject: a.subject || null, topic: a.topic || null, category: intent.officialLike ? "normative" : "general",
        generatedByProvider: a.provider ?? "unknown", model: a.model ?? null,
        evidence: { sources: normalizeSources(sources) } as Prisma.InputJsonValue, autoChecks: { bestTrust: checks.bestTrust, needsSource: checks.needsSource } as Prisma.InputJsonValue,
        riskFlags: checks.flags, reviewStatus: checks.needsSource ? "NEEDS_SOURCE" : "PENDING_REVIEW", contributorRefs: [ref], expiresAt: candidateExpiry(),
      },
      select: { id: true },
    });
    await db.knowledgeAudit.create({ data: { operation: "candidate.create", actor: "system", candidateId: c.id, metadata: { provider: a.provider ?? "unknown", flags: checks.flags } as Prisma.InputJsonValue } }).catch(() => undefined);
    return { created: true };
  } catch (e) { soft("nomzod", e); return { created: false, reason: "error" }; }
}

// ---------- foydalanuvchi bahosi ----------
export async function submitFeedback(userId: string, input: { entryId: string; rating: 1 | -1; reason?: string }) {
  if (!secret()) throw new ApiError(503, "Baholash hozircha mavjud emas.", "hub_unavailable");
  try {
    const entry = await db.knowledgeEntry.findUnique({ where: { id: input.entryId }, select: { id: true, status: true, subject: true, topic: true, scope: true } });
    if (!entry || entry.scope !== "GLOBAL") throw new ApiError(404, "Bilim yozuvi topilmadi.");
    const voterRef = userRef(secret(), `vote:${entry.id}`, userId);
    const reason = input.rating === -1 ? input.reason ?? "other" : null;
    const before = await db.knowledgeFeedback.findUnique({ where: { entryId_voterRef: { entryId: entry.id, voterRef } }, select: { rating: true } });
    await db.knowledgeFeedback.upsert({ where: { entryId_voterRef: { entryId: entry.id, voterRef } }, create: { entryId: entry.id, voterRef, rating: input.rating, reason }, update: { rating: input.rating, reason } });
    if (before?.rating !== input.rating) {
      const day = dayStart(), subject = entry.subject ?? "", topic = entry.topic ?? "";
      const fld = input.rating === 1 ? { helpful: { increment: 1 } } : { unhelpful: { increment: 1 } };
      await db.knowledgeDemand.upsert({ where: { day_subject_topic: { day, subject, topic } }, create: { day, subject, topic, ...(input.rating === 1 ? { helpful: 1 } : { unhelpful: 1 }) }, update: fld }).catch(() => undefined);
    }
    const [neg, pos] = await Promise.all([db.knowledgeFeedback.count({ where: { entryId: entry.id, rating: -1 } }), db.knowledgeFeedback.count({ where: { entryId: entry.id, rating: 1 } })]);
    let flagged = false;
    if (feedbackVerdict(neg, pos) === "flag" && entry.status === "APPROVED") {
      // Xavfsiz tomonga: yozuv qidiruvdan chiqadi, qayta yoqish faqat adminda.
      await db.knowledgeEntry.update({ where: { id: entry.id }, data: { status: "FLAGGED" } });
      await db.knowledgeAudit.create({ data: { operation: "entry.auto_flag", actor: "system", entryId: entry.id, metadata: { negative: neg, positive: pos } as Prisma.InputJsonValue } }).catch(() => undefined);
      flagged = true;
    }
    return { ok: true, flagged };
  } catch (e) {
    if (isMissing(e)) throw new ApiError(503, "Baholash hozircha mavjud emas.", "hub_unavailable");
    throw e;
  }
}

// ======================= ADMIN =======================
type Tx = Prisma.TransactionClient;
async function writeAudit(c: Tx | typeof db, actor: string, operation: string, ref: { entryId?: string; candidateId?: string }, metadata: Record<string, unknown> = {}) {
  await c.knowledgeAudit.create({ data: { actor, operation, ...ref, metadata: metadata as Prisma.InputJsonValue } });
}
const expiryOf = (on: string | null | undefined) => (on ? new Date(`${on}T23:59:59Z`) : null);
const entryData = (i: EntryInput) => ({
  questionCanonical: i.questionCanonical.trim(), answer: i.answer.trim(), subject: i.subject, topic: i.topic, category: i.category,
  sourceReferences: normalizeSources(i.sources) as Prisma.InputJsonValue, sourceVersion: i.sourceVersion, expiresAt: expiryOf(i.expiresOn),
  searchText: searchTextOf(i.questionCanonical, i.answer),
});

/** Jadval yaratilmagan bo'lsa admin sahifasi tushunarli xabar ko'rsatishi uchun. */
async function guard<T>(fn: () => Promise<T>): Promise<T> {
  try { return await fn(); } catch (e) { if (isMissing(e)) throw new ApiError(503, "Bilim markazi jadvallari hali yaratilmagan: prisma/supabase-update-knowledge-base.sql ni qo'llang.", "hub_tables_missing"); throw e; }
}

export async function createEntry(adminId: string, input: EntryInput, origin: "ADMIN" | "CANDIDATE" | "OFFICIAL_IMPORT" = "ADMIN") {
  const e = await guard(() => db.$transaction(async (t) => {
    const row = await t.knowledgeEntry.create({ data: { ...entryData(input), origin, status: "APPROVED", reviewedBy: adminId, reviewedAt: new Date() }, select: { id: true } });
    await writeAudit(t, adminId, "entry.create", { entryId: row.id }, { origin });
    return row;
  }, TX));
  await audit(adminId, "knowledge.entry.create", { entryId: e.id });
  void storeEmbedding(e.id, input.questionCanonical);
  return e;
}

export async function updateEntry(adminId: string, id: string, input: EntryInput) {
  const row = await guard(() => db.$transaction(async (t) => {
    const cur = await t.knowledgeEntry.findUnique({ where: { id }, select: { id: true, scope: true } });
    if (!cur || cur.scope !== "GLOBAL") throw new ApiError(404, "Bilim yozuvi topilmadi.");
    const r = await t.knowledgeEntry.update({ where: { id }, data: { ...entryData(input), reviewedBy: adminId, reviewedAt: new Date(), embeddingModelVersion: null }, select: { id: true } });
    await writeAudit(t, adminId, "entry.update", { entryId: id });
    return r;
  }, TX));
  await audit(adminId, "knowledge.entry.update", { entryId: id });
  void storeEmbedding(row.id, input.questionCanonical);
  return { ok: true };
}

export async function applyEntryAction(adminId: string, id: string, action: EntryAction, opts: { note?: string | null; expiresOn?: string | null } = {}) {
  const out = await guard(() => db.$transaction(async (t) => {
    const e = await t.knowledgeEntry.findUnique({ where: { id }, select: { id: true, status: true, scope: true, category: true, expiresAt: true, sourceReferences: true } });
    if (!e || e.scope !== "GLOBAL") throw new ApiError(404, "Bilim yozuvi topilmadi.");
    const now = new Date();
    const tr = transition(effectiveStatus(e, now), action);
    if (!tr.ok) throw new ApiError(409, tr.error);
    const data: Prisma.KnowledgeEntryUpdateInput = { status: tr.to };
    if (action === "restore") {
      const next = opts.expiresOn ? expiryOf(opts.expiresOn) : e.expiresAt && e.expiresAt.getTime() > now.getTime() ? e.expiresAt : null;
      const bad = canRestore({ category: e.category, expiresAt: next, sourceReferences: e.sourceReferences }, now);
      if (bad) throw new ApiError(400, bad);
      data.expiresAt = next; data.reviewedBy = adminId; data.reviewedAt = now;
    }
    await t.knowledgeEntry.update({ where: { id }, data });
    await writeAudit(t, adminId, `entry.${action}`, { entryId: id }, { from: e.status, to: tr.to, ...(opts.note && { note: opts.note }) });
    return { status: tr.to };
  }, TX));
  await audit(adminId, `knowledge.entry.${action}`, { entryId: id });
  return out;
}

export async function listEntries(f: { status?: string; q?: string; take?: number } = {}) {
  return guard(async () => {
    const now = new Date();
    const and: Prisma.KnowledgeEntryWhereInput[] = [{ scope: "GLOBAL" }];
    if (f.status === "APPROVED") and.push({ status: "APPROVED", OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] });
    else if (f.status === "STALE") and.push({ OR: [{ status: "STALE" }, { status: "APPROVED", expiresAt: { lte: now } }] });
    else if (f.status && f.status !== "ALL") and.push({ status: f.status });
    if (f.q?.trim()) and.push({ OR: [{ questionCanonical: { contains: f.q.trim(), mode: "insensitive" } }, { answer: { contains: f.q.trim(), mode: "insensitive" } }] });
    const rows = await db.knowledgeEntry.findMany({
      where: { AND: and }, orderBy: { updatedAt: "desc" }, take: Math.min(f.take ?? 100, 200),
      select: { ...ENTRY_SELECT, audience: true, origin: true, sourceVersion: true, servedCount: true, lastServedAt: true, updatedAt: true, reviewedBy: true, embeddingModelVersion: true, feedback: { select: { rating: true } } },
    });
    return rows.map(({ feedback, ...r }) => ({
      ...r, effectiveStatus: effectiveStatus(r, now), sources: entrySources(r.sourceReferences),
      helpful: feedback.filter((x) => x.rating === 1).length, unhelpful: feedback.filter((x) => x.rating === -1).length,
    }));
  });
}

/** Ko'rib chiqilmagan va muddati o'tgan nomzodlar «EXPIRED» bo'ladi, foydalanuvchi izlari (xeshlar) o'chadi. */
export async function expireCandidates() {
  try { await db.knowledgeCandidate.updateMany({ where: { reviewStatus: { in: ["PENDING_REVIEW", "NEEDS_SOURCE"] }, expiresAt: { lt: new Date() } }, data: { reviewStatus: "EXPIRED", contributorRefs: [] } }); } catch (e) { soft("nomzod muddati", e); }
}

export async function listCandidates(status = "PENDING") {
  return guard(async () => {
    await expireCandidates();
    const where: Prisma.KnowledgeCandidateWhereInput = status === "PENDING" ? { reviewStatus: { in: ["PENDING_REVIEW", "NEEDS_SOURCE"] } } : status === "ALL" ? {} : { reviewStatus: status };
    return db.knowledgeCandidate.findMany({
      where, orderBy: [{ askCount: "desc" }, { createdAt: "desc" }], take: 100,
      select: { id: true, normalizedQuestion: true, proposedAnswer: true, subject: true, topic: true, category: true, generatedByProvider: true, model: true, evidence: true, riskFlags: true, reviewStatus: true, askCount: true, createdAt: true, expiresAt: true, reviewedAt: true, reviewNote: true },
    });
  });
}

export async function reviewCandidate(adminId: string, id: string, r: { decision: "approve"; entry: EntryInput } | { decision: "reject"; note?: string | null }) {
  const out = await guard(() => db.$transaction(async (t) => {
    const c = await t.knowledgeCandidate.findUnique({ where: { id }, select: { id: true, reviewStatus: true } });
    if (!c) throw new ApiError(404, "Nomzod topilmadi.");
    if (!["PENDING_REVIEW", "NEEDS_SOURCE"].includes(c.reviewStatus)) throw new ApiError(409, "Bu nomzod allaqachon ko'rib chiqilgan.");
    const now = new Date();
    if (r.decision === "approve") {
      const e = await t.knowledgeEntry.create({ data: { ...entryData(r.entry), origin: "CANDIDATE", status: "APPROVED", reviewedBy: adminId, reviewedAt: now }, select: { id: true } });
      // Foydalanuvchi izlari (xeshlar) ko'rib chiqilgach o'chadi.
      await t.knowledgeCandidate.update({ where: { id }, data: { reviewStatus: "APPROVED", reviewedBy: adminId, reviewedAt: now, contributorRefs: [], duplicateOfId: null } });
      await writeAudit(t, adminId, "candidate.approve", { candidateId: id, entryId: e.id });
      return { entryId: e.id as string | null };
    }
    await t.knowledgeCandidate.update({ where: { id }, data: { reviewStatus: "REJECTED", reviewedBy: adminId, reviewedAt: now, reviewNote: r.note ?? null, contributorRefs: [] } });
    await writeAudit(t, adminId, "candidate.reject", { candidateId: id }, r.note ? { note: r.note } : {});
    return { entryId: null as string | null };
  }, TX));
  await audit(adminId, `knowledge.candidate.${r.decision}`, { candidateId: id });
  if (r.decision === "approve" && out.entryId) void storeEmbedding(out.entryId, r.entry.questionCanonical);
  return { ok: true, entryId: out.entryId };
}

// ---------- umumiy ko'rinish ----------
async function providerStats(): Promise<Map<string, ProviderStat>> {
  const since = new Date(Date.now() - 86_400_000);
  const m = new Map<string, ProviderStat>();
  try {
    const rows = await db.aiRequest.groupBy({ by: ["provider", "status"], where: { createdAt: { gte: since }, provider: { not: null } }, _count: true, _avg: { latencyMs: true }, _sum: { inputTokens: true, outputTokens: true } });
    for (const r of rows) {
      if (!r.provider) continue;
      const s = m.get(r.provider) ?? { provider: r.provider, calls: 0, errors: 0, avgMs: null, tokens: 0 };
      s.calls += r._count; s.tokens += (r._sum.inputTokens ?? 0) + (r._sum.outputTokens ?? 0);
      if (r.status !== "ok" && r.status !== "truncated") s.errors += r._count;
      if (r._avg.latencyMs != null) s.avgMs = Math.round(s.avgMs == null ? r._avg.latencyMs : (s.avgMs + r._avg.latencyMs) / 2);
      m.set(r.provider, s);
    }
  } catch (e) { soft("provayder statistikasi", e); }
  return m;
}

export async function providerOverview() {
  const [stats, s] = await Promise.all([providerStats(), getSettings()]);
  const roles = s.ai.providerRoles as Record<string, Role | undefined>;
  const free = freeProviderInfo().map((p) => {
    const st = stats.get(p.id);
    return { id: p.id, kind: "free" as const, host: p.host, model: p.model, role: (roles[p.id] ?? "fallback") as Role, roleLabel: ROLE_LABEL[roles[p.id] ?? "fallback"], explicitRole: !!roles[p.id], breakerSeconds: p.breakerSeconds, calls: st?.calls ?? 0, errors: st?.errors ?? 0, errorPct: st ? errorRate(st) : 0, avgMs: st?.avgMs ?? null, tokens: st?.tokens ?? 0 };
  });
  const cs = stats.get("claude");
  const claude = aiConfigured() ? { id: "claude", kind: "claude" as const, host: "api.anthropic.com", model: aiModel(), calls: cs?.calls ?? 0, errors: cs?.errors ?? 0, errorPct: cs ? errorRate(cs) : 0, avgMs: cs?.avgMs ?? null, tokens: cs?.tokens ?? 0 } : null;
  return { free, claude, note: "Kalitlar faqat serverda (Vercel muhit o'zgaruvchilari). Bu yerda faqat xost, model va ko'rsatkichlar." };
}

export async function hubOverview() {
  const now = new Date(), since = new Date(Date.now() - 30 * 86_400_000);
  const settings = (await getSettings()).ai;
  const base = { mode: settings.hubMode, embeddings: { configured: embeddingsConfigured(), ready: await vectorReady(), version: embeddingVersion() } };
  try {
    const [byStatus, expiredApproved, byCand, demand, missing, stale, flagged, recent] = await Promise.all([
      db.knowledgeEntry.groupBy({ by: ["status"], where: { scope: "GLOBAL" }, _count: true }),
      db.knowledgeEntry.count({ where: { scope: "GLOBAL", status: "APPROVED", expiresAt: { lte: now } } }),
      db.knowledgeCandidate.groupBy({ by: ["reviewStatus"], _count: true }),
      db.knowledgeDemand.findMany({ where: { day: { gte: dayStart(since) } } }),
      db.knowledgeCandidate.findMany({ where: { reviewStatus: { in: ["PENDING_REVIEW", "NEEDS_SOURCE"] } }, orderBy: [{ askCount: "desc" }, { createdAt: "desc" }], take: 15, select: { id: true, normalizedQuestion: true, askCount: true, subject: true, topic: true, reviewStatus: true } }),
      db.knowledgeEntry.findMany({ where: { scope: "GLOBAL", OR: [{ status: { in: ["STALE", "NEEDS_RECHECK"] } }, { status: "APPROVED", expiresAt: { lte: now } }] }, orderBy: { updatedAt: "asc" }, take: 15, select: { id: true, questionCanonical: true, status: true, expiresAt: true } }),
      db.knowledgeEntry.findMany({ where: { scope: "GLOBAL", status: "FLAGGED" }, orderBy: { updatedAt: "desc" }, take: 15, select: { id: true, questionCanonical: true, updatedAt: true, feedback: { select: { rating: true } } } }),
      db.knowledgeAudit.findMany({ orderBy: { at: "desc" }, take: 12, select: { id: true, operation: true, actor: true, at: true, entryId: true, candidateId: true } }),
    ]);
    const count = (s: string) => byStatus.find((x) => x.status === s)?._count ?? 0;
    const cand = (s: string) => byCand.find((x) => x.reviewStatus === s)?._count ?? 0;
    const sum = (k: "asked" | "fromKb" | "byAi" | "unanswered" | "helpful" | "unhelpful") => demand.reduce((n, r) => n + r[k], 0);
    const group = (keyOf: (r: (typeof demand)[number]) => string, label: (r: (typeof demand)[number]) => { subject: string; topic: string }) => {
      const m = new Map<string, { subject: string; topic: string; asked: number; fromKb: number; unanswered: number }>();
      for (const r of demand) { const k = keyOf(r); const x = m.get(k) ?? { ...label(r), asked: 0, fromKb: 0, unanswered: 0 }; x.asked += r.asked; x.fromKb += r.fromKb; x.unanswered += r.unanswered; m.set(k, x); }
      return visibleDemand([...m.values()]).sort((a, b) => b.asked - a.asked).slice(0, 12);
    };
    const asked = sum("asked");
    return {
      available: true as const, ...base,
      counts: { approved: count("APPROVED") - expiredApproved, stale: count("STALE") + expiredApproved, needsRecheck: count("NEEDS_RECHECK"), flagged: count("FLAGGED"), archived: count("ARCHIVED"), pending: cand("PENDING_REVIEW"), needsSource: cand("NEEDS_SOURCE") },
      demand: {
        days: 30, asked, fromKb: sum("fromKb"), byAi: sum("byAi"), unanswered: sum("unanswered"), helpful: sum("helpful"), unhelpful: sum("unhelpful"), hitRate: asked ? Math.round((sum("fromKb") / asked) * 100) : 0,
        subjects: group((r) => r.subject, (r) => ({ subject: r.subject, topic: "" })).filter((r) => r.subject),
        topics: group((r) => `${r.subject}|${r.topic}`, (r) => ({ subject: r.subject, topic: r.topic })).filter((r) => r.topic),
        hidden: demand.length > 0 && asked < 5,
      },
      missing: missing.map((m) => ({ id: m.id, question: m.normalizedQuestion, askCount: m.askCount, subject: m.subject, topic: m.topic, status: m.reviewStatus })),
      stale: stale.map((e) => ({ id: e.id, question: e.questionCanonical, status: effectiveStatus(e, now), expiresAt: e.expiresAt })),
      flagged: flagged.map((e) => ({ id: e.id, question: e.questionCanonical, updatedAt: e.updatedAt, unhelpful: e.feedback.filter((f) => f.rating === -1).length, helpful: e.feedback.filter((f) => f.rating === 1).length })),
      audit: recent,
    };
  } catch (e) {
    if (isMissing(e)) return { available: false as const, ...base };
    throw e;
  }
}
