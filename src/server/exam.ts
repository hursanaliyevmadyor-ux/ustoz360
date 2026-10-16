import { randomInt } from "node:crypto";
import { ApiError } from "./auth";
import { db } from "./db";

export type ExamKind = "TEST" | "WRITTEN" | "MIXED";
/** c: tanlangan variant (ekranda ko'rsatilgan tartib bo'yicha, 0 dan), t: yozma javob. */
export type StoredAnswer = { c?: number; t?: string };
/** perm[ko'rsatilgan_indeks] = asl_indeks. Yozma savolda perm yo'q. */
export type OrderItem = { q: string; perm?: number[] };
export type QuestionRow = { id: string; type: string; text: string; options: unknown; correct: number | null; accepted: unknown; explanation: string | null };

const SUBMIT_GRACE_MS = 15_000; // tarmoq kechikishi uchun: vaqt tugagandan keyin ham oxirgi javoblar qabul qilinadi
const MAX_TEXT = 300;

/** Fisher–Yates: kriptografik tasodifiy aralashtirish (har urinishda yangicha ketma-ketlik). */
export function shuffled<T>(arr: readonly T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) { const j = randomInt(0, i + 1); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

const asStrings = (v: unknown): string[] => (Array.isArray(v) ? v.map((x) => String(x)) : []);

/** Yozma javobni solishtirish uchun: kichik harf, bir xil apostrof, ortiqcha bo'shliq va oxirgi tinish belgisiz, "9,8" = "9.8". */
export function normalizeAnswer(s: string): string {
  return s.normalize("NFKC").toLowerCase().replace(/[‘’ʻʼ`´]/g, "'").replace(/\s+/g, " ").replace(/[.,;:!?"«»()\s]+$/g, "").trim().replace(/,(\d)/g, ".$1");
}
export function isWrittenCorrect(given: string, accepted: string[]): boolean {
  const g = normalizeAnswer(given);
  if (!g) return false;
  const gn = Number(g.replace(/\s/g, ""));
  return accepted.some((a) => {
    const n = normalizeAnswer(a);
    if (!n) return false;
    if (n === g) return true;
    const nn = Number(n.replace(/\s/g, ""));
    return Number.isFinite(nn) && Number.isFinite(gn) && nn === gn;
  });
}

export type ReviewItem = {
  n: number; id: string; type: "CHOICE" | "WRITTEN"; text: string; options?: string[];
  chosen?: number | null; correct?: number; given?: string; accepted?: string[]; ok: boolean; explanation?: string | null;
};

/** Toza funksiya: javoblar va savol kalitlari bo'yicha ball hisoblaydi. */
export function gradeAttempt(order: OrderItem[], answers: Record<string, StoredAnswer>, questions: Map<string, QuestionRow>) {
  let score = 0;
  const review: ReviewItem[] = [];
  order.forEach((o, i) => {
    const q = questions.get(o.q);
    if (!q) return;
    const a = answers[o.q];
    if (q.type === "CHOICE") {
      const opts = asStrings(q.options);
      const perm = o.perm ?? opts.map((_, k) => k);
      const displayOptions = perm.map((k) => opts[k]);
      const chosen = typeof a?.c === "number" ? a.c : null;
      const correctDisplay = q.correct === null ? -1 : perm.indexOf(q.correct);
      const ok = chosen !== null && chosen === correctDisplay;
      if (ok) score++;
      review.push({ n: i + 1, id: q.id, type: "CHOICE", text: q.text, options: displayOptions, chosen, correct: correctDisplay, ok, explanation: q.explanation });
    } else {
      const accepted = asStrings(q.accepted);
      const given = (a?.t ?? "").trim();
      const ok = isWrittenCorrect(given, accepted);
      if (ok) score++;
      review.push({ n: i + 1, id: q.id, type: "WRITTEN", text: q.text, given, accepted, ok, explanation: q.explanation });
    }
  });
  return { score, total: order.length, review };
}

function cleanAnswer(q: QuestionRow, raw: { c?: unknown; t?: unknown }): StoredAnswer | null {
  if (q.type === "CHOICE") {
    const n = asStrings(q.options).length;
    if (raw.c === null || raw.c === undefined) return null;
    if (typeof raw.c !== "number" || !Number.isInteger(raw.c) || raw.c < 0 || raw.c >= n) throw new ApiError(400, "Variant noto'g'ri.");
    return { c: raw.c };
  }
  if (raw.t === null || raw.t === undefined) return null;
  if (typeof raw.t !== "string") throw new ApiError(400, "Javob noto'g'ri.");
  const t = raw.t.slice(0, MAX_TEXT);
  return t.trim() ? { t } : null;
}

async function loadAttempt(userId: string, id: string) {
  const at = await db.examAttempt.findFirst({ where: { id, userId }, include: { exam: true } });
  if (!at) throw new ApiError(404, "Imtihon topilmadi.");
  return at;
}
const orderOf = (v: unknown) => v as OrderItem[];
const answersOf = (v: unknown) => (v ?? {}) as Record<string, StoredAnswer>;

export async function listExams(userId: string) {
  const exams = await db.exam.findMany({
    where: { active: true }, orderBy: { createdAt: "asc" },
    select: { id: true, slug: true, title: true, subject: true, kind: true, durationMin: true, pickCount: true, _count: { select: { questions: true } }, questions: { select: { type: true } } },
  });
  const attempts = await db.examAttempt.findMany({
    where: { userId }, orderBy: { startedAt: "desc" }, take: 40,
    select: { id: true, examId: true, startedAt: true, endsAt: true, submittedAt: true, score: true, total: true },
  });
  const now = Date.now();
  return {
    exams: exams.map((e) => {
      const mine = attempts.filter((a) => a.examId === e.id);
      const open = mine.find((a) => !a.submittedAt && a.endsAt.getTime() > now) ?? null;
      const last = mine.find((a) => a.submittedAt) ?? null;
      return {
        slug: e.slug, title: e.title, subject: e.subject, kind: e.kind, durationMin: e.durationMin,
        questionCount: Math.min(e._count.questions, e.pickCount ?? e._count.questions),
        choiceCount: e.questions.filter((q) => q.type === "CHOICE").length,
        writtenCount: e.questions.filter((q) => q.type === "WRITTEN").length,
        openAttemptId: open?.id ?? null,
        last: last ? { id: last.id, score: last.score, total: last.total, at: last.submittedAt } : null,
      };
    }),
  };
}

/** Yangi urinish boshlaydi: savollar va variantlar HAR SAFAR yangicha aralashtiriladi. Tugallanmagan urinish bo'lsa, o'shani davom ettiradi. */
export async function startAttempt(userId: string, slug: string) {
  const exam = await db.exam.findFirst({ where: { slug, active: true }, include: { questions: { select: { id: true, type: true, options: true } } } });
  if (!exam || exam.questions.length === 0) throw new ApiError(404, "Imtihon topilmadi.");
  const open = await db.examAttempt.findFirst({ where: { userId, examId: exam.id, submittedAt: null, endsAt: { gt: new Date() } }, select: { id: true } });
  if (open) return { id: open.id, resumed: true };

  const pool = shuffled(exam.questions);
  const picked = exam.pickCount ? pool.slice(0, exam.pickCount) : pool;
  const order: OrderItem[] = picked.map((q) => {
    if (q.type !== "CHOICE") return { q: q.id };
    return { q: q.id, perm: shuffled(asStrings(q.options).map((_, k) => k)) };
  });
  const at = await db.examAttempt.create({ data: { userId, examId: exam.id, endsAt: new Date(Date.now() + exam.durationMin * 60_000), order } });
  return { id: at.id, resumed: false };
}

export async function getAttemptView(userId: string, id: string) {
  const at = await loadAttempt(userId, id);
  const order = orderOf(at.order);
  const rows = await db.examQuestion.findMany({ where: { id: { in: order.map((o) => o.q) } } });
  const byId = new Map<string, QuestionRow>(rows.map((r) => [r.id, r]));
  const base = {
    id: at.id, serverNow: new Date().toISOString(), endsAt: at.endsAt.toISOString(), submitted: !!at.submittedAt,
    exam: { title: at.exam.title, subject: at.exam.subject, kind: at.exam.kind, durationMin: at.exam.durationMin },
    leftCount: at.leftCount,
  };
  if (at.submittedAt) {
    const g = gradeAttempt(order, answersOf(at.answers), byId);
    return { ...base, result: { score: at.score ?? g.score, total: at.total ?? g.total, submittedAt: at.submittedAt.toISOString(), startedAt: at.startedAt.toISOString(), review: g.review } };
  }
  return {
    ...base,
    answers: answersOf(at.answers),
    questions: order.flatMap((o, i) => {
      const q = byId.get(o.q);
      if (!q) return [];
      const opts = asStrings(q.options);
      return [{ id: q.id, n: i + 1, type: q.type as "CHOICE" | "WRITTEN", text: q.text, ...(q.type === "CHOICE" ? { options: (o.perm ?? opts.map((_, k) => k)).map((k) => opts[k]) } : {}) }];
    }),
  };
}

export async function saveAnswer(userId: string, id: string, qid: string, raw: { c?: unknown; t?: unknown }) {
  const at = await loadAttempt(userId, id);
  if (at.submittedAt) throw new ApiError(409, "Imtihon yakunlangan.");
  if (Date.now() > at.endsAt.getTime() + SUBMIT_GRACE_MS) throw new ApiError(409, "Imtihon vaqti tugagan.");
  if (!orderOf(at.order).some((o) => o.q === qid)) throw new ApiError(400, "Savol bu imtihonga tegishli emas.");
  const q = await db.examQuestion.findUnique({ where: { id: qid } });
  if (!q) throw new ApiError(404, "Savol topilmadi.");
  const clean = cleanAnswer(q, raw);
  // Bir vaqtda kelgan javoblar bir-birini bosib ketmasligi uchun jsonb darajasida yangilaymiz.
  if (clean) await db.$executeRaw`UPDATE "ExamAttempt" SET "answers" = jsonb_set(COALESCE("answers", '{}'::jsonb), ARRAY[${qid}], ${JSON.stringify(clean)}::jsonb, true) WHERE "id" = ${id} AND "submittedAt" IS NULL`;
  else await db.$executeRaw`UPDATE "ExamAttempt" SET "answers" = COALESCE("answers", '{}'::jsonb) - ${qid} WHERE "id" = ${id} AND "submittedAt" IS NULL`;
  return { ok: true as const };
}

/** Imtihonni yakunlaydi. Mijoz oxirgi javoblar nusxasini yuborishi mumkin (tarmoq uzilgan bo'lsa ham yo'qolmasin). Qayta chaqirilsa, natija o'zgarmaydi. */
export async function submitAttempt(userId: string, id: string, snapshot?: Record<string, { c?: unknown; t?: unknown }>) {
  const at = await loadAttempt(userId, id);
  if (at.submittedAt) return getAttemptView(userId, id);
  const order = orderOf(at.order);
  const rows = await db.examQuestion.findMany({ where: { id: { in: order.map((o) => o.q) } } });
  const byId = new Map<string, QuestionRow>(rows.map((r) => [r.id, r]));
  const answers = { ...answersOf(at.answers) };
  if (snapshot && Date.now() <= at.endsAt.getTime() + SUBMIT_GRACE_MS) {
    for (const o of order) {
      const raw = snapshot[o.q]; const q = byId.get(o.q);
      if (!raw || !q) continue;
      try { const c = cleanAnswer(q, raw); if (c) answers[o.q] = c; else delete answers[o.q]; } catch { /* noto'g'ri yozuv e'tiborga olinmaydi */ }
    }
  }
  const g = gradeAttempt(order, answers, byId);
  const submittedAt = new Date();
  const done = await db.examAttempt.updateMany({ where: { id, submittedAt: null }, data: { submittedAt, answers, score: g.score, total: g.total } });
  if (done.count === 0) return getAttemptView(userId, id); // boshqa so'rov oldinroq yakunlagan
  // Natijani qayta o'qimasdan, hisoblanganning o'zini qaytaramiz (bazaga ortiqcha so'rov ketmaydi).
  return {
    id: at.id, serverNow: submittedAt.toISOString(), endsAt: at.endsAt.toISOString(), submitted: true as const,
    exam: { title: at.exam.title, subject: at.exam.subject, kind: at.exam.kind, durationMin: at.exam.durationMin },
    leftCount: at.leftCount,
    result: { score: g.score, total: g.total, submittedAt: submittedAt.toISOString(), startedAt: at.startedAt.toISOString(), review: g.review },
  };
}

export async function recordLeave(userId: string, id: string) {
  const at = await loadAttempt(userId, id);
  if (at.submittedAt) return { ok: true as const };
  await db.examAttempt.update({ where: { id }, data: { leftCount: { increment: 1 } } });
  return { ok: true as const };
}
