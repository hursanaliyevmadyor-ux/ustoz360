import { randomBytes } from "node:crypto";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { ApiError } from "../auth";
import { audit } from "../audit";
import { db } from "../db";
import { stemsOf } from "../hub/knowledgelogic";
import { notify } from "../notify";
import { ensureFallbackTopic } from "./collections";
import { similarity, FALLBACK_SUBJECT } from "./verifylogic";

/**
 * Admin ko'rib chiqishi: foydalanuvchilar yuborgan shaxsiy testlar. Faqat admin tasdiqlagan va ulashish huquqi tasdiqlangan savollar
 * umumiy savollar bankiga (alohida nusxa sifatida) o'tadi; foydalanuvchining shaxsiy nusxasi o'zgarmaydi.
 */
type Admin = { id: string };
const rid = (p: string) => p + randomBytes(10).toString("hex");
const LABELS = "ABCDEFGHIJ";

export async function listSubmissions(status?: string) {
  const rows = await db.questionReviewSubmission.findMany({
    where: status ? { status } : {}, orderBy: { submittedAt: "desc" }, take: 200,
    include: { user: { select: { name: true, email: true } }, collection: { select: { id: true, title: true, subject: true, status: true, questions: { select: { answerStatus: true } } } } },
  });
  const counts = await db.questionReviewSubmission.groupBy({ by: ["status"], _count: { _all: true } });
  return {
    counts: Object.fromEntries(counts.map((c) => [c.status, c._count._all])) as Record<string, number>,
    items: rows.map((r) => {
      const qs = r.collection.questions;
      return {
        id: r.id, status: r.status, submittedAt: r.submittedAt.toISOString(), reviewedAt: r.reviewedAt?.toISOString() ?? null, rightsConfirmed: r.rightsConfirmed, publishedCount: r.publishedCount,
        user: r.user.name ?? r.user.email ?? "—", collection: { id: r.collection.id, title: r.collection.title, subject: r.collection.subject, status: r.collection.status },
        counts: { total: qs.length, verified: qs.filter((q) => q.answerStatus === "VERIFIED").length, userSet: qs.filter((q) => q.answerStatus === "USER_SET").length, unverified: qs.filter((q) => q.answerStatus === "UNVERIFIED").length },
      };
    }),
  };
}

export async function getSubmission(subId: string) {
  const sub = await db.questionReviewSubmission.findUnique({ where: { id: subId }, include: { user: { select: { name: true, email: true } }, collection: true } });
  if (!sub) throw new ApiError(404, "Yuborilgan test topilmadi.");
  const qs = await db.question.findMany({ where: { collectionId: sub.collectionId }, orderBy: { collectionPos: "asc" }, take: 300, include: { options: { orderBy: { position: "asc" } }, topic: { select: { id: true, name: true, subject: { select: { name: true, slug: true } } } } } });
  const sources = await db.extractedQuestion.findMany({ where: { id: { in: qs.map((q) => q.importSourceId).filter((x): x is string => !!x) } }, select: { id: true, sourcePage: true, reviewStatus: true, verification: { select: { verificationStatus: true, answerOrigin: true, confidence: true, evidence: true, keySource: true } } } });
  const src = new Map(sources.map((s) => [s.id, s]));

  // Mavjud global savollar bilan o'xshashlik (takroriy savollarni oldindan ko'rsatish uchun)
  const similar = new Map<string, { id: string; text: string; score: number }>();
  for (let i = 0; i < qs.length; i += 10) {
    await Promise.all(qs.slice(i, i + 10).map(async (q) => {
      const stems = stemsOf(q.text).slice(0, 4);
      if (!stems.length) return;
      const cands = await db.question.findMany({ where: { collectionId: null, ownerId: null, status: "APPROVED", OR: stems.map((s) => ({ text: { contains: s, mode: "insensitive" as const } })) }, select: { id: true, text: true }, take: 20 });
      let best: { id: string; text: string; score: number } | null = null;
      for (const c of cands) { const score = similarity(q.text, c.text); if (!best || score > best.score) best = { id: c.id, text: c.text, score }; }
      if (best && best.score >= 0.55) similar.set(q.id, { ...best, text: best.text.slice(0, 160), score: Math.round(best.score * 100) / 100 });
    }));
  }
  const published = await db.question.count({ where: { collectionId: null, importSourceId: { in: qs.map((q) => q.id) } } });
  return {
    id: sub.id, status: sub.status, submittedAt: sub.submittedAt.toISOString(), reviewedAt: sub.reviewedAt?.toISOString() ?? null, reviewNotes: sub.reviewNotes, rightsConfirmed: sub.rightsConfirmed, rightsNote: sub.rightsNote, note: sub.note, publishedCount: sub.publishedCount, published,
    user: sub.user.name ?? sub.user.email ?? "—", collection: { id: sub.collection.id, title: sub.collection.title, subject: sub.collection.subject, sourceNote: sub.collection.sourceNote, status: sub.collection.status },
    questions: qs.map((q) => {
      const s = q.importSourceId ? src.get(q.importSourceId) : undefined;
      const v = s?.verification;
      return {
        id: q.id, pos: q.collectionPos, text: q.text, explanation: q.explanation, difficulty: q.difficulty, sourceRef: q.sourceRef, answerStatus: q.answerStatus,
        topic: { id: q.topic.id, name: q.topic.name, subject: q.topic.subject.name, unclassified: q.topic.subject.slug === FALLBACK_SUBJECT.slug },
        options: q.options.map((o, i) => ({ label: LABELS[i], text: o.text, isCorrect: o.isCorrect })),
        ai: v ? { status: v.verificationStatus, origin: v.answerOrigin, confidence: v.confidence, evidence: Array.isArray(v.evidence) ? v.evidence.length : 0, keySource: v.keySource } : null,
        similar: similar.get(q.id) ?? null,
      };
    }),
  };
}

const editSchema = z.object({ text: z.string().trim().min(2).max(4000).optional(), options: z.array(z.string().trim().min(1).max(1000)).min(2).max(10).optional(), correct: z.number().int().min(0).max(9).optional(), explanation: z.string().trim().max(3000).optional() });
export const reviewSchema = z.object({
  action: z.enum(["approve", "recheck", "reject", "archive"]),
  topicId: z.string().min(1).optional(),
  decisions: z.record(z.string(), z.object({ decision: z.enum(["APPROVED", "REJECTED"]), edit: editSchema.optional() })).optional(),
  notes: z.string().trim().max(1000).optional(),
});

export async function reviewSubmission(admin: Admin, subId: string, input: z.infer<typeof reviewSchema>) {
  const sub = await db.questionReviewSubmission.findUnique({ where: { id: subId }, include: { collection: true } });
  if (!sub) throw new ApiError(404, "Yuborilgan test topilmadi.");
  const done = (status: string, extra: Prisma.QuestionReviewSubmissionUpdateInput = {}) => db.questionReviewSubmission.update({ where: { id: subId }, data: { status, reviewedAt: new Date(), reviewedBy: admin.id, reviewNotes: input.notes ?? null, ...extra } });
  const tell = (title: string, text: string) => notify(sub.userId, { kind: "import", title, text: [sub.collection.title, text].filter(Boolean).join(": "), href: `/ustoz-ai/testlarim/${sub.collectionId}` });

  if (input.action === "approve") {
    if (sub.status !== "SUBMITTED") throw new ApiError(409, "Bu test allaqachon ko'rib chiqilgan.");
    if (!sub.rightsConfirmed) throw new ApiError(409, "Foydalanuvchi materialni ulashish huquqini tasdiqlamagan: umumiy bankka o'tkazib bo'lmaydi.", "rights_missing");
    const qs = await db.question.findMany({ where: { collectionId: sub.collectionId }, orderBy: { collectionPos: "asc" }, include: { options: { orderBy: { position: "asc" } }, topic: { select: { subject: { select: { slug: true } } } } } });
    const exist = new Set((await db.question.findMany({ where: { collectionId: null, importSourceId: { in: qs.map((q) => q.id) } }, select: { importSourceId: true } })).map((x) => x.importSourceId));
    if (input.topicId && !(await db.topic.findUnique({ where: { id: input.topicId }, select: { id: true } }))) throw new ApiError(404, "Mavzu topilmadi.");
    const fallbackTopic = await ensureFallbackTopic();
    const qRows: Prisma.QuestionCreateManyInput[] = [];
    const oRows: Prisma.AnswerOptionCreateManyInput[] = [];
    const decisions: Record<string, string> = {};
    let edited = 0, rejected = 0;
    for (const q of qs) {
      const d = input.decisions?.[q.id];
      // Tasdiqlanmagan javobli savol faqat admin aniq tasdiqlasa o'tadi.
      const decision = d?.decision ?? (q.answerStatus === "UNVERIFIED" ? "REJECTED" : "APPROVED");
      if (decision === "REJECTED") { decisions[q.id] = "REJECTED"; rejected++; continue; }
      if (exist.has(q.id)) { decisions[q.id] = "APPROVED"; continue; }
      const topicId = q.topicId === fallbackTopic || q.topic.subject.slug === FALLBACK_SUBJECT.slug ? input.topicId : q.topicId;
      if (!topicId) throw new ApiError(400, "Tasniflanmagan savollar uchun mavzuni tanlang.", "topic_required");
      const e = d?.edit;
      const options = e?.options ?? q.options.map((o) => o.text);
      const correct = e?.correct ?? Math.max(0, q.options.findIndex((o) => o.isCorrect));
      if (correct >= options.length) throw new ApiError(400, "To'g'ri variant raqami noto'g'ri.");
      const hasEdit = !!(e && Object.keys(e).length);
      if (hasEdit) edited++;
      decisions[q.id] = hasEdit ? "EDITED" : "APPROVED";
      const gid = rid("gq");
      qRows.push({ id: gid, topicId, text: e?.text ?? q.text, explanation: e?.explanation ?? q.explanation, difficulty: q.difficulty, status: "APPROVED", isDemo: false, source: "IMPORT", sourceRef: ["Foydalanuvchi yuklagan material (admin tasdiqlagan)", q.sourceRef].filter(Boolean).join(" · ").slice(0, 300), kind: q.kind, importSourceId: q.id });
      options.forEach((text, i) => oRows.push({ id: rid("go"), questionId: gid, text, isCorrect: i === correct, position: i }));
    }
    if (qRows.length) await db.$transaction([db.question.createMany({ data: qRows }), db.answerOption.createMany({ data: oRows })]);
    const status = edited > 0 || rejected > 0 ? "APPROVED_EDITED" : "APPROVED";
    await done(status, { decisions: decisions as Prisma.InputJsonValue, publishedCount: qRows.length + [...exist].length });
    await db.personalQuestionCollection.update({ where: { id: sub.collectionId }, data: { status: "PUBLIC_APPROVED" } });
    await audit(admin.id, "import.review_approve", { submission: subId, published: qRows.length, edited, rejected });
    await tell("Testingiz umumiy bankka qo'shildi", `${qRows.length} ta savol tasdiqlandi${rejected ? `, ${rejected} tasi o'tmadi` : ""}.`);
    return { ok: true as const, status, published: qRows.length, rejected, edited };
  }

  if (input.action === "reject") {
    if (!["SUBMITTED", "NEEDS_RECHECK"].includes(sub.status)) throw new ApiError(409, "Bu testni rad etib bo'lmaydi.");
    await done("REJECTED");
    await db.personalQuestionCollection.update({ where: { id: sub.collectionId }, data: { status: "REJECTED" } });
    await audit(admin.id, "import.review_reject", { submission: subId });
    await tell("Test umumiy bankka qabul qilinmadi", input.notes ?? "Shaxsiy testingiz o'zingizda qoladi.");
    return { ok: true as const, status: "REJECTED" };
  }

  if (input.action === "recheck") {
    if (sub.status !== "SUBMITTED") throw new ApiError(409, "Bu testni qayta tekshirishga yuborib bo'lmaydi.");
    await done("NEEDS_RECHECK");
    await db.personalQuestionCollection.update({ where: { id: sub.collectionId }, data: { status: "PRIVATE_ACTIVE" } });
    await audit(admin.id, "import.review_recheck", { submission: subId });
    await tell("Testingizni qayta tekshirish kerak", input.notes ?? "Admin izohlarini ko'rib chiqing va qayta yuboring.");
    return { ok: true as const, status: "NEEDS_RECHECK" };
  }

  // archive: umumiy bankdagi nusxalar arxivga olinadi
  const ids = (await db.question.findMany({ where: { collectionId: sub.collectionId }, select: { id: true } })).map((q) => q.id);
  const arch = await db.question.updateMany({ where: { collectionId: null, importSourceId: { in: ids }, status: "APPROVED" }, data: { status: "ARCHIVED" } });
  await done("ARCHIVED");
  await db.personalQuestionCollection.update({ where: { id: sub.collectionId }, data: { status: "PRIVATE_ACTIVE" } });
  await audit(admin.id, "import.review_archive", { submission: subId, archived: arch.count });
  await tell("Test umumiy bankdan arxivga olindi", input.notes ?? "");
  return { ok: true as const, status: "ARCHIVED", archived: arch.count };
}
