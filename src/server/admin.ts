import { randomBytes } from "node:crypto";
import { Prisma } from "@prisma/client";
import { ApiError } from "./auth";
import { db } from "./db";
import { deriveKind, slugify, type ExamInput, type QuestionInput, type SeminarInput } from "./adminvalid";

/** Faqat adminlar uchun kontent boshqaruvi. Chaqiruvchi (API yo'li) avval requireAdmin() bilan rolni tekshirishi shart. */

async function uniqueSlug(base: string, exists: (slug: string) => Promise<boolean>) {
  const s = slugify(base);
  if (!(await exists(s))) return s;
  for (let i = 0; i < 6; i++) { const c = `${s}-${randomBytes(2).toString("hex")}`; if (!(await exists(c))) return c; }
  throw new ApiError(500, "Noyob nom yaratib bo'lmadi, qayta urinib ko'ring.");
}
const strs = (v: unknown): string[] => (Array.isArray(v) ? v.map(String) : []);

// ---------- Imtihonlar ----------

export async function listAdminExams() {
  const rows = await db.exam.findMany({
    orderBy: { createdAt: "desc" },
    select: { id: true, slug: true, title: true, subject: true, kind: true, durationMin: true, pickCount: true, active: true, _count: { select: { questions: true, attempts: true } } },
  });
  return { exams: rows.map(({ _count, ...e }) => ({ ...e, questionCount: _count.questions, attemptCount: _count.attempts })) };
}

export async function getAdminExam(id: string) {
  const e = await db.exam.findUnique({ where: { id }, include: { questions: { orderBy: [{ position: "asc" }, { id: "asc" }] }, _count: { select: { attempts: true } } } });
  if (!e) throw new ApiError(404, "Imtihon topilmadi.");
  return {
    id: e.id, slug: e.slug, title: e.title, subject: e.subject, kind: e.kind, durationMin: e.durationMin, pickCount: e.pickCount, active: e.active, attemptCount: e._count.attempts,
    questions: e.questions.map((q) => ({ id: q.id, position: q.position, type: q.type as "CHOICE" | "WRITTEN", text: q.text, options: strs(q.options), correct: q.correct, accepted: strs(q.accepted), explanation: q.explanation ?? "" })),
  };
}

export async function createExam(input: ExamInput) {
  const slug = await uniqueSlug(input.title, async (s) => !!(await db.exam.findUnique({ where: { slug: s }, select: { id: true } })));
  const e = await db.exam.create({ data: { slug, title: input.title, subject: input.subject, kind: "TEST", durationMin: input.durationMin, pickCount: input.pickCount ?? null, active: input.active ?? false } });
  return { id: e.id };
}

export async function updateExam(id: string, input: ExamInput) {
  const cur = await db.exam.findUnique({ where: { id }, select: { id: true, _count: { select: { questions: true } } } });
  if (!cur) throw new ApiError(404, "Imtihon topilmadi.");
  if (input.pickCount && input.pickCount > cur._count.questions) throw new ApiError(400, `Bankda atigi ${cur._count.questions} ta savol bor, ko'proq tanlab bo'lmaydi.`);
  await db.exam.update({ where: { id }, data: { title: input.title, subject: input.subject, durationMin: input.durationMin, pickCount: input.pickCount ?? null, ...(input.active !== undefined && { active: input.active }) } });
  return { ok: true as const };
}

/** Urinishlari bor imtihon o'chirilmaydi (talabalar natijasi yo'qolmasligi uchun), faqat yashiriladi. */
export async function deleteExam(id: string) {
  const e = await db.exam.findUnique({ where: { id }, select: { id: true, _count: { select: { attempts: true } } } });
  if (!e) throw new ApiError(404, "Imtihon topilmadi.");
  if (e._count.attempts > 0) { await db.exam.update({ where: { id }, data: { active: false } }); return { archived: true as const }; }
  await db.exam.delete({ where: { id } });
  return { deleted: true as const };
}

async function refreshKind(examId: string) {
  const rows = await db.examQuestion.findMany({ where: { examId }, select: { type: true } });
  await db.exam.update({ where: { id: examId }, data: { kind: deriveKind(rows.map((r) => r.type)) } });
}

const questionData = (q: QuestionInput) => q.type === "CHOICE"
  ? { type: "CHOICE", text: q.text, options: q.options, correct: q.correct, accepted: Prisma.DbNull, explanation: q.explanation ?? null }
  : { type: "WRITTEN", text: q.text, options: Prisma.DbNull, correct: null, accepted: q.accepted, explanation: q.explanation ?? null };

export async function addQuestion(examId: string, q: QuestionInput) {
  const exam = await db.exam.findUnique({ where: { id: examId }, select: { id: true } });
  if (!exam) throw new ApiError(404, "Imtihon topilmadi.");
  const last = await db.examQuestion.aggregate({ where: { examId }, _max: { position: true } });
  const created = await db.examQuestion.create({ data: { examId, position: (last._max.position ?? -1) + 1, ...questionData(q) } });
  await refreshKind(examId);
  return { id: created.id };
}

export async function updateQuestion(qid: string, q: QuestionInput) {
  const cur = await db.examQuestion.findUnique({ where: { id: qid }, select: { examId: true } });
  if (!cur) throw new ApiError(404, "Savol topilmadi.");
  await db.examQuestion.update({ where: { id: qid }, data: questionData(q) });
  await refreshKind(cur.examId);
  return { ok: true as const };
}

export async function deleteQuestion(qid: string) {
  const cur = await db.examQuestion.findUnique({ where: { id: qid }, select: { examId: true } });
  if (!cur) throw new ApiError(404, "Savol topilmadi.");
  await db.examQuestion.delete({ where: { id: qid } });
  await refreshKind(cur.examId);
  return { ok: true as const };
}

// ---------- Fanlar va mavzular ----------

export async function listSubjects() {
  const rows = await db.subject.findMany({ orderBy: { name: "asc" }, include: { topics: { orderBy: { name: "asc" }, select: { id: true, name: true, objectives: true, _count: { select: { questions: true } } } } } });
  return { subjects: rows.map((s) => ({ id: s.id, name: s.name, topics: s.topics.map((t) => ({ id: t.id, name: t.name, objectives: t.objectives, questionCount: t._count.questions })) })) };
}
export async function setTopicObjectives(id: string, objectives: string[]) {
  const r = await db.topic.updateMany({ where: { id }, data: { objectives } });
  if (!r.count) throw new ApiError(404, "Mavzu topilmadi.");
  return { ok: true as const };
}
export async function createSubject(name: string) {
  const slug = await uniqueSlug(name, async (s) => !!(await db.subject.findUnique({ where: { slug: s }, select: { id: true } })));
  return { id: (await db.subject.create({ data: { slug, name } })).id };
}
export async function renameSubject(id: string, name: string) {
  const r = await db.subject.updateMany({ where: { id }, data: { name } });
  if (!r.count) throw new ApiError(404, "Fan topilmadi.");
  return { ok: true as const };
}
export async function deleteSubject(id: string) {
  const s = await db.subject.findUnique({ where: { id }, select: { _count: { select: { topics: true } } } });
  if (!s) throw new ApiError(404, "Fan topilmadi.");
  if (s._count.topics > 0) throw new ApiError(409, "Fanda mavzular bor. Avval mavzularni o'chiring.");
  await db.subject.delete({ where: { id } });
  return { ok: true as const };
}
export async function createTopic(subjectId: string, name: string) {
  const subj = await db.subject.findUnique({ where: { id: subjectId }, select: { id: true } });
  if (!subj) throw new ApiError(404, "Fan topilmadi.");
  const slug = await uniqueSlug(name, async (s) => !!(await db.topic.findUnique({ where: { slug: s }, select: { id: true } })));
  return { id: (await db.topic.create({ data: { slug, name, subjectId } })).id };
}
export async function renameTopic(id: string, name: string) {
  const r = await db.topic.updateMany({ where: { id }, data: { name } });
  if (!r.count) throw new ApiError(404, "Mavzu topilmadi.");
  return { ok: true as const };
}
export async function deleteTopic(id: string) {
  const t = await db.topic.findUnique({ where: { id }, select: { _count: { select: { questions: true, mastery: true } } } });
  if (!t) throw new ApiError(404, "Mavzu topilmadi.");
  if (t._count.questions > 0 || t._count.mastery > 0) throw new ApiError(409, "Bu mavzuga savollar yoki o'quvchi natijalari bog'langan, o'chirib bo'lmaydi.");
  await db.topic.delete({ where: { id } });
  return { ok: true as const };
}

// ---------- Seminarlar ----------

const seminarData = (i: SeminarInput) => ({
  title: i.title, description: i.description ?? null, speaker: i.speaker ?? null, startsAt: new Date(i.startsAt), durationMin: i.durationMin ?? null,
  place: i.place ?? null, link: i.link ?? null, capacity: i.capacity ?? null, active: i.active ?? true,
});
export async function listAdminSeminars() {
  const rows = await db.seminar.findMany({ orderBy: { startsAt: "desc" } });
  return { seminars: rows.map((s) => ({ ...s, startsAt: s.startsAt.toISOString(), createdAt: s.createdAt.toISOString() })) };
}
export async function createSeminar(i: SeminarInput) { return { id: (await db.seminar.create({ data: seminarData(i) })).id }; }
export async function updateSeminar(id: string, i: SeminarInput) {
  const r = await db.seminar.updateMany({ where: { id }, data: seminarData(i) });
  if (!r.count) throw new ApiError(404, "Seminar topilmadi.");
  return { ok: true as const };
}
export async function deleteSeminar(id: string) {
  const r = await db.seminar.deleteMany({ where: { id } });
  if (!r.count) throw new ApiError(404, "Seminar topilmadi.");
  return { ok: true as const };
}
/** Hamma ko'radigan ro'yxat: faol va hali tugamagan seminarlar. */
export async function listPublicSeminars() {
  const since = new Date(Date.now() - 3 * 3_600_000);
  const rows = await db.seminar.findMany({ where: { active: true, startsAt: { gte: since } }, orderBy: { startsAt: "asc" }, take: 100 });
  return { seminars: rows.map((s) => ({ id: s.id, title: s.title, description: s.description, speaker: s.speaker, startsAt: s.startsAt.toISOString(), durationMin: s.durationMin, place: s.place, link: s.link, capacity: s.capacity })) };
}
