import { ApiError } from "./auth";
import { audit } from "./audit";
import { db } from "./db";
import { analyze, insights, type A } from "./sinflogic";

/** SINF ANALITIKA: sinflar faqat o'qituvchining o'zinikidir (egasi tekshiriladi). O'quvchilar taxallus bilan. */
const MAX_CLASSES = 20, MAX_STUDENTS = 60, MAX_ASSESSMENTS = 60;
const iso = (d: Date) => d.toISOString().slice(0, 10);
const D = (s: string) => new Date(s + "T00:00:00Z");

async function ownClass(userId: string, id: string) {
  const c = await db.classroom.findFirst({ where: { id, userId } });
  if (!c) throw new ApiError(404, "Sinf topilmadi.");
  return c;
}

export async function listClasses(userId: string) {
  const rows = await db.classroom.findMany({
    where: { userId }, orderBy: { createdAt: "asc" },
    include: { _count: { select: { students: true, assessments: true } }, assessments: { select: { id: true, maxScore: true, date: true, scores: { select: { score: true } } }, orderBy: { date: "asc" } } },
  });
  return {
    classes: rows.map((c) => {
      const trend = c.assessments.filter((a) => a.scores.length).map((a) => Math.round(a.scores.reduce((s, x) => s + (x.score / a.maxScore) * 100, 0) / a.scores.length));
      return { id: c.id, name: c.name, subject: c.subject, grade: c.grade, students: c._count.students, assessments: c._count.assessments, avg: trend.length ? trend[trend.length - 1] : null, trend: trend.slice(-6) };
    }),
  };
}

export async function createClass(userId: string, i: { name: string; subject: string; grade?: string }) {
  if ((await db.classroom.count({ where: { userId } })) >= MAX_CLASSES) throw new ApiError(409, `Sinflar soni ${MAX_CLASSES} tadan oshmasin.`);
  return { id: (await db.classroom.create({ data: { userId, name: i.name, subject: i.subject, grade: i.grade || null } })).id };
}
export async function updateClass(userId: string, id: string, i: { name: string; subject: string; grade?: string }) {
  await ownClass(userId, id);
  await db.classroom.update({ where: { id }, data: { name: i.name, subject: i.subject, grade: i.grade || null } });
  return { ok: true as const };
}
export async function deleteClass(userId: string, id: string) {
  await ownClass(userId, id);
  await db.classroom.delete({ where: { id } });
  await audit(userId, "sinf.class_delete", { id });
  return { ok: true as const };
}

/** Sinf, o'quvchilar, baholashlar, natijalar va tayyor tahlil (bitta so'rovda). */
export async function classDetail(userId: string, id: string) {
  const c = await db.classroom.findFirst({
    where: { id, userId },
    include: { students: { orderBy: { createdAt: "asc" } }, assessments: { orderBy: { date: "asc" }, include: { scores: true } } },
  });
  if (!c) throw new ApiError(404, "Sinf topilmadi.");
  const assessments = c.assessments.map((a) => ({ id: a.id, title: a.title, topic: a.topic, kind: a.kind as A["kind"], maxScore: a.maxScore, date: iso(a.date) }));
  const scores = c.assessments.flatMap((a) => a.scores.map((s) => ({ assessmentId: a.id, studentId: s.studentId, score: s.score })));
  const students = c.students.map((s) => ({ id: s.id, alias: s.alias }));
  const analysis = analyze(students, assessments, scores);
  return { id: c.id, name: c.name, subject: c.subject, grade: c.grade, students, assessments, scores, analysis, insights: insights(analysis) };
}

export async function addStudents(userId: string, classId: string, aliases: string[]) {
  await ownClass(userId, classId);
  const have = await db.student.findMany({ where: { classId }, select: { alias: true } });
  const known = new Set(have.map((s) => s.alias.toLowerCase()));
  const fresh = Array.from(new Set(aliases.map((a) => a.trim()))).filter((a) => !known.has(a.toLowerCase()));
  if (have.length + fresh.length > MAX_STUDENTS) throw new ApiError(409, `Sinfda ${MAX_STUDENTS} tadan ortiq o'quvchi bo'lmasin.`);
  if (fresh.length) await db.student.createMany({ data: fresh.map((alias) => ({ classId, alias })), skipDuplicates: true });
  return { added: fresh.length, skipped: aliases.length - fresh.length };
}
export async function renameStudent(userId: string, classId: string, sid: string, alias: string) {
  await ownClass(userId, classId);
  if (await db.student.findFirst({ where: { classId, alias: { equals: alias.trim(), mode: "insensitive" }, NOT: { id: sid } } })) throw new ApiError(409, "Bunday taxallus sinfda bor.");
  const r = await db.student.updateMany({ where: { id: sid, classId }, data: { alias: alias.trim() } });
  if (!r.count) throw new ApiError(404, "O'quvchi topilmadi.");
  return { ok: true as const };
}
export async function removeStudent(userId: string, classId: string, sid: string) {
  await ownClass(userId, classId);
  const r = await db.student.deleteMany({ where: { id: sid, classId } });
  if (!r.count) throw new ApiError(404, "O'quvchi topilmadi.");
  return { ok: true as const };
}

export async function saveAssessment(userId: string, classId: string, i: { title: string; topic: string; kind: string; maxScore: number; date: string }, id?: string) {
  await ownClass(userId, classId);
  if (id) {
    const cur = await db.assessment.findFirst({ where: { id, classId }, include: { scores: { select: { score: true } } } });
    if (!cur) throw new ApiError(404, "Baholash topilmadi.");
    const over = cur.scores.find((s) => s.score > i.maxScore);
    if (over) throw new ApiError(400, `Eng yuqori ballni ${i.maxScore} ga tushirib bo'lmaydi: ${over.score} ball kiritilgan.`);
    await db.assessment.update({ where: { id }, data: { title: i.title, topic: i.topic, kind: i.kind, maxScore: i.maxScore, date: D(i.date) } });
    return { id };
  }
  if ((await db.assessment.count({ where: { classId } })) >= MAX_ASSESSMENTS) throw new ApiError(409, `Baholashlar soni ${MAX_ASSESSMENTS} tadan oshmasin.`);
  return { id: (await db.assessment.create({ data: { classId, title: i.title, topic: i.topic, kind: i.kind, maxScore: i.maxScore, date: D(i.date) } })).id };
}
export async function deleteAssessment(userId: string, classId: string, id: string) {
  await ownClass(userId, classId);
  const r = await db.assessment.deleteMany({ where: { id, classId } });
  if (!r.count) throw new ApiError(404, "Baholash topilmadi.");
  return { ok: true as const };
}

/** Natijalarni kiritish/tahrirlash: studentId -> ball; null bo'lsa natija o'chadi. Ball eng yuqori balldan oshmasligi tekshiriladi. */
export async function saveScores(userId: string, classId: string, assessmentId: string, scores: Record<string, number | null>) {
  await ownClass(userId, classId);
  const a = await db.assessment.findFirst({ where: { id: assessmentId, classId }, select: { id: true, maxScore: true } });
  if (!a) throw new ApiError(404, "Baholash topilmadi.");
  const ids = Object.keys(scores);
  const valid = new Set((await db.student.findMany({ where: { classId, id: { in: ids } }, select: { id: true } })).map((s) => s.id));
  for (const [sid, v] of Object.entries(scores)) {
    if (!valid.has(sid)) throw new ApiError(400, "Natija sinfda yo'q o'quvchiga tegishli.");
    if (v !== null && v > a.maxScore) throw new ApiError(400, `Ball ${a.maxScore} dan oshmasligi kerak.`);
  }
  const set = Object.entries(scores).filter(([, v]) => v !== null) as [string, number][];
  const clear = Object.entries(scores).filter(([, v]) => v === null).map(([k]) => k);
  // Ikki buyruq (o'chirish + qo'shish) bitta tranzaksiyada: sekin bazada ham tez va butun holda saqlanadi.
  await db.$transaction([
    db.assessmentScore.deleteMany({ where: { assessmentId, studentId: { in: ids } } }),
    db.assessmentScore.createMany({ data: set.map(([studentId, score]) => ({ assessmentId, studentId, score })) }),
  ]);
  return { saved: set.length, cleared: clear.length };
}
