import { randomBytes } from "node:crypto";
import { z } from "zod";
import { ApiError, hasRole } from "./auth";
import { audit } from "./audit";
import { db } from "./db";
import { chunkText, detectKind, extractText, KIND_MIME, MAX_DOCS_PER_USER, MAX_TOTAL_BYTES_PER_USER, safeFileName } from "./librarylogic";
import { notify } from "./notify";
import { buildGroundedPrompt, keywordRetriever } from "./rag";
import { runAnyAi } from "./ai/structured";
import { aiAvailable } from "./ai/gateway";
import { storage } from "./storage";

/** BILIMXONA kutubxonasi: fayl Supabase Storage'da (shaxsiy bucket), bu yerda metadata va matn bo'laklari. */
type Viewer = { id: string; roles: { role: string }[] };
const isAdmin = (u: Viewer) => hasRole(u, "ADMIN", "SUPERADMIN");

export const uploadMeta = z.object({
  title: z.string().trim().min(1, "Nom bo'sh bo'lmasin").max(160),
  subject: z.string().trim().max(60).optional().transform((v) => v || undefined),
  tags: z.string().trim().max(200).optional().transform((v) => (v ? v.split(/[,;]+/).map((t) => t.trim().toLowerCase()).filter(Boolean).slice(0, 8) : [])),
});

const view = (d: { id: string; ownerId: string; title: string; fileName: string; mime: string; sizeBytes: number; visibility: string; status: string; subject: string | null; tags: string[]; textChars: number | null; createdAt: Date; owner?: { name: string | null }; favorites?: { userId: string }[] }, viewerId: string) => ({
  id: d.id, title: d.title, fileName: d.fileName, type: d.mime === KIND_MIME.pdf ? "PDF" : d.mime === KIND_MIME.docx ? "DOCX" : "TXT",
  sizeBytes: d.sizeBytes, visibility: d.visibility, status: d.status, subject: d.subject, tags: d.tags, textChars: d.textChars,
  createdAt: d.createdAt.toISOString(), mine: d.ownerId === viewerId, owner: d.owner?.name ?? null, favorite: !!d.favorites?.length,
});

export function storageState() {
  const s = storage().configured();
  return { configured: s, note: s ? null : "Fayl saqlash xizmati ulanmagan: yuklash vaqtincha mavjud emas." };
}

export async function listLibrary(viewer: Viewer, q: { q?: string; subject?: string; scope?: string; page?: number }) {
  const take = 24, skip = Math.max(0, ((q.page ?? 1) - 1) * take);
  const term = q.q?.trim();
  const base = q.scope === "mine" ? { ownerId: viewer.id } : q.scope === "favorites" ? { favorites: { some: { userId: viewer.id } }, OR: [{ ownerId: viewer.id }, { visibility: "PUBLIC" }] }
    : { OR: [{ ownerId: viewer.id }, { visibility: "PUBLIC" }] };
  const where = {
    ...base,
    ...(q.subject && { subject: q.subject }),
    ...(term && { AND: [{ OR: [{ title: { contains: term, mode: "insensitive" as const } }, { fileName: { contains: term, mode: "insensitive" as const } }, { tags: { has: term.toLowerCase() } }] }] }),
  };
  const [total, rows, subjects] = await Promise.all([
    db.libraryDoc.count({ where }),
    db.libraryDoc.findMany({ where, orderBy: { createdAt: "desc" }, take, skip, include: { owner: { select: { name: true } }, favorites: { where: { userId: viewer.id }, select: { userId: true } } } }),
    db.libraryDoc.findMany({ where: { OR: [{ ownerId: viewer.id }, { visibility: "PUBLIC" }], subject: { not: null } }, distinct: ["subject"], select: { subject: true } }),
  ]);
  return { total, page: q.page ?? 1, pages: Math.max(1, Math.ceil(total / take)), docs: rows.map((d) => view(d, viewer.id)), subjects: subjects.map((s) => s.subject!).sort(), storage: storageState() };
}

export async function uploadDoc(viewer: Viewer, file: { name: string; bytes: Uint8Array }, meta: z.infer<typeof uploadMeta>) {
  const st = storage();
  if (!st.configured()) throw new ApiError(503, "Fayl saqlash xizmati ulanmagan: yuklash vaqtincha mavjud emas.", "storage_unconfigured");
  const det = detectKind(file.name, file.bytes);
  if (!det.ok) throw new ApiError(400, det.error);
  const [count, sum] = await Promise.all([db.libraryDoc.count({ where: { ownerId: viewer.id } }), db.libraryDoc.aggregate({ where: { ownerId: viewer.id }, _sum: { sizeBytes: true } })]);
  if (count >= MAX_DOCS_PER_USER) throw new ApiError(409, `Kutubxonada ${MAX_DOCS_PER_USER} tadan ortiq hujjat bo'lmasin: eskilarini o'chiring.`);
  if ((sum._sum.sizeBytes ?? 0) + file.bytes.length > MAX_TOTAL_BYTES_PER_USER) throw new ApiError(409, "Umumiy hajm chegarasi (100 MB) oshib ketadi.");

  const path = `u/${viewer.id}/${randomBytes(8).toString("hex")}-${safeFileName(file.name)}`;
  await st.put(path, file.bytes, KIND_MIME[det.kind]);
  let doc;
  try {
    const text = extractText(det.kind, file.bytes);
    const chunks = text ? chunkText(text) : [];
    doc = await db.libraryDoc.create({ data: { ownerId: viewer.id, title: meta.title, fileName: safeFileName(file.name), mime: KIND_MIME[det.kind], sizeBytes: file.bytes.length, storagePath: path, subject: meta.subject ?? null, tags: meta.tags, status: chunks.length ? "READY" : "UPLOADED", textChars: text?.length ?? null } });
    if (chunks.length) await db.libraryChunk.createMany({ data: chunks.map((t, idx) => ({ docId: doc!.id, idx, text: t })) });
  } catch (e) {
    await st.remove(path).catch(() => {}); // bazaga yozilmasa, yetim fayl qolmasin
    throw e;
  }
  await audit(viewer.id, "library.upload", { id: doc.id, type: det.kind, size: file.bytes.length });
  return { id: doc.id, status: doc.status, indexed: doc.status === "READY" };
}

async function accessible(viewer: Viewer, id: string) {
  const d = await db.libraryDoc.findUnique({ where: { id } });
  if (!d || (d.ownerId !== viewer.id && d.visibility !== "PUBLIC" && !isAdmin(viewer))) throw new ApiError(404, "Hujjat topilmadi.");
  return d;
}

/** Yuklab olish: qisqa muddatli (5 daqiqa) imzolangan havola. Fayl brauzerga to'g'ridan-to'g'ri, ochiq doimiy havolasiz beriladi. */
export async function downloadUrl(viewer: Viewer, id: string) {
  const d = await accessible(viewer, id);
  if (!storage().configured()) throw new ApiError(503, "Fayl saqlash xizmati ulanmagan.", "storage_unconfigured");
  return { url: await storage().signedUrl(d.storagePath, 300), fileName: d.fileName };
}

/** Bitta hujjat kartochkasi (ruxsat tekshiriladi): Telegram bot va boshqa ixcham ko'rinishlar uchun. */
export async function getLibraryDoc(viewer: Viewer, id: string) {
  await accessible(viewer, id);
  const d = await db.libraryDoc.findUniqueOrThrow({ where: { id }, include: { owner: { select: { name: true } }, favorites: { where: { userId: viewer.id }, select: { userId: true } } } });
  return view(d, viewer.id);
}

export async function toggleFavorite(viewer: Viewer, id: string) {
  await accessible(viewer, id);
  const key = { userId_docId: { userId: viewer.id, docId: id } };
  if (await db.libraryFavorite.findUnique({ where: key })) { await db.libraryFavorite.delete({ where: key }); return { favorite: false }; }
  await db.libraryFavorite.create({ data: { userId: viewer.id, docId: id } });
  return { favorite: true };
}

export async function deleteDoc(viewer: Viewer, id: string) {
  const d = await db.libraryDoc.findUnique({ where: { id } });
  if (!d || (d.ownerId !== viewer.id && !isAdmin(viewer))) throw new ApiError(404, "Hujjat topilmadi.");
  if (storage().configured()) await storage().remove(d.storagePath).catch((e) => { if (!(e instanceof ApiError) || !/404/.test(e.message)) throw e; });
  await db.libraryDoc.delete({ where: { id } });
  await audit(viewer.id, "library.delete", { id });
  return { ok: true as const };
}

/** Egasi hujjatini ommaviy qilishni so'raydi: adminlar tasdiqlamaguncha shaxsiy qoladi. */
export async function requestPublic(viewer: Viewer, id: string) {
  const d = await db.libraryDoc.findFirst({ where: { id, ownerId: viewer.id } });
  if (!d) throw new ApiError(404, "Hujjat topilmadi.");
  if (d.visibility !== "PRIVATE") throw new ApiError(409, d.visibility === "PUBLIC" ? "Hujjat allaqachon ommaviy." : "So'rov allaqachon yuborilgan.");
  await db.libraryDoc.update({ where: { id }, data: { visibility: "PUBLIC_PENDING" } });
  const admins = await db.userRole.findMany({ where: { role: { in: ["ADMIN", "SUPERADMIN"] } }, select: { userId: true }, distinct: ["userId"] });
  await Promise.all(admins.map((a) => notify(a.userId, { kind: "library", title: "Hujjat ommaviy qilish uchun yuborildi", text: d.title, href: "/admin/kutubxona" })));
  return { ok: true as const };
}

export async function adminLibrary(status?: string) {
  const rows = await db.libraryDoc.findMany({ where: status ? { visibility: status } : {}, orderBy: { createdAt: "desc" }, take: 200, include: { owner: { select: { name: true, email: true } } } });
  return { docs: rows.map((d) => ({ ...view(d, ""), owner: d.owner.name ?? d.owner.email ?? "—" })) };
}
export async function reviewLibrary(adminId: string, id: string, action: "approve" | "reject") {
  const d = await db.libraryDoc.findUnique({ where: { id } });
  if (!d) throw new ApiError(404, "Hujjat topilmadi.");
  if (d.visibility !== "PUBLIC_PENDING") throw new ApiError(409, "Hujjat tekshiruvda emas.");
  await db.libraryDoc.update({ where: { id }, data: { visibility: action === "approve" ? "PUBLIC" : "PRIVATE" } });
  await audit(adminId, `admin.library_${action}`, { id });
  await notify(d.ownerId, { kind: "library", title: action === "approve" ? "Hujjat ommaviy qilindi" : "Hujjat ommaviy qilinmadi", text: d.title, href: "/bilimxona" });
  return { ok: true as const };
}

/**
 * Hujjat ichidan savolga javob. Avval hujjatdan mos parchalar topiladi; AI ulangan bo'lsa FAQAT shu parchalarga tayanib javob yozadi.
 * AI ulanmagan yoki parcha topilmasa, javob to'qilmaydi: topilgan parchalar (manba) ko'rsatiladi yoki "topilmadi" deyiladi.
 */
export async function askDoc(viewer: Viewer, id: string, question: string) {
  const d = await accessible(viewer, id);
  if (d.status !== "READY") throw new ApiError(409, "Bu hujjat matni hali indekslanmagan (hozircha faqat TXT va DOCX). Savol berib bo'lmaydi.", "not_indexed");
  const chunks = await db.libraryChunk.findMany({ where: { docId: id }, orderBy: { idx: "asc" }, select: { idx: true, text: true } });
  const hits = keywordRetriever.retrieve(question, chunks, 4);
  const sources = hits.map((h, i) => ({ n: i + 1, idx: h.idx, text: h.text.slice(0, 600), score: h.score }));
  if (!hits.length) return { answer: null as string | null, grounded: false, sources, note: "Hujjatda bu savolga mos joy topilmadi. Savolni boshqacha so'zlar bilan yozib ko'ring." };
  if (!aiAvailable().any) return { answer: null, grounded: false, sources, note: "AI ulanmagan: hujjatdan topilgan mos parchalar ko'rsatildi." };
  const { system, user } = buildGroundedPrompt(question, hits);
  const r = await runAnyAi({ userId: viewer.id, feature: "chat", messages: [{ role: "user", content: user }], system, maxTokens: 900, promptVersion: "docqa@1", knowledge: false /* hujjat ichidan javob: manba faqat hujjat; shaxsiy hujjat matni bilim qidiruviga ketmaydi */ });
  return { answer: r.text, grounded: true, sources, note: null as string | null };
}
