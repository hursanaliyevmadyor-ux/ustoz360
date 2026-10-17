import { Prisma } from "@prisma/client";
import { ApiError } from "./auth";
import { db } from "./db";
import { DOC_KINDS, type DocInput } from "./docsvalid";

/** O'qituvchi hujjatlari: faqat egasi ko'radi va o'zgartiradi. */
const MAX_DOCS = 500;

const row = (d: { id: string; kind: string; title: string; subject: string | null; grade: string | null; status: string; updatedAt: Date }) => ({
  id: d.id, kind: d.kind, title: d.title, subject: d.subject, grade: d.grade, status: d.status, updatedAt: d.updatedAt.toISOString(),
});

export async function listDocs(userId: string, opts: { kind?: string; limit?: number } = {}) {
  if (opts.kind && !(DOC_KINDS as readonly string[]).includes(opts.kind)) throw new ApiError(400, "Hujjat turi noto'g'ri.");
  const rows = await db.teacherDoc.findMany({
    where: { userId, ...(opts.kind && { kind: opts.kind }) }, orderBy: { updatedAt: "desc" }, take: Math.min(opts.limit ?? 100, 200),
    select: { id: true, kind: true, title: true, subject: true, grade: true, status: true, updatedAt: true },
  });
  return { docs: rows.map(row) };
}

export async function getDoc(userId: string, id: string) {
  const d = await db.teacherDoc.findFirst({ where: { id, userId } });
  if (!d) throw new ApiError(404, "Hujjat topilmadi.");
  return { ...row(d), data: d.data };
}

export async function saveDoc(userId: string, input: DocInput, id?: string) {
  const data = { kind: input.kind, title: input.title, subject: input.subject || null, grade: input.grade || null, status: input.status, data: input.data as Prisma.InputJsonValue };
  if (id) {
    const r = await db.teacherDoc.updateMany({ where: { id, userId }, data });
    if (!r.count) throw new ApiError(404, "Hujjat topilmadi.");
    return { id };
  }
  if ((await db.teacherDoc.count({ where: { userId } })) >= MAX_DOCS) throw new ApiError(409, `Hujjatlar soni ${MAX_DOCS} tadan oshmasin: eskilarini o'chiring.`);
  return { id: (await db.teacherDoc.create({ data: { userId, ...data } })).id };
}

export async function deleteDoc(userId: string, id: string) {
  const r = await db.teacherDoc.deleteMany({ where: { id, userId } });
  if (!r.count) throw new ApiError(404, "Hujjat topilmadi.");
  return { ok: true as const };
}
