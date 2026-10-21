import { ApiError } from "../auth";
import { db } from "../db";
import { storage } from "../storage";
import { imagePaths, slotNumbers } from "../../lib/figure-text";
import type { Figure } from "./aischema";

/**
 * Savoldagi rasm/jadval/formula bo'laklari. Joyi (`[[RASM:n]]`) va koordinatalari AI tahlilida aniqlanadi; rasmning o'zini (PNG) brauzer asl
 * sahifadan kesib yuboradi (server PDF chizmaydi). Tayyor testga saqlanganda rasm savolga alohida nusxa sifatida bog'lanadi: `[[rasm:egasi/nom]]`.
 */
export const MAX_FIGURE_BYTES = 3 * 1024 * 1024;
const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const isPng = (b: Uint8Array) => b.length > 64 && PNG.every((x, i) => b[i] === x);

/** Rasm turini bayt belgilaridan aniqlaydi (fayl nomiga ishonilmaydi). Brauzer kesgan rasmlar PNG, DOCX ichidagilar PNG/JPEG/GIF/WebP bo'lishi mumkin. */
export function sniffImage(b: Uint8Array): "image/png" | "image/jpeg" | "image/gif" | "image/webp" | null {
  if (b.length < 12) return null;
  if (PNG.every((x, i) => b[i] === x)) return "image/png";
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x38) return "image/gif";
  if (b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return "image/webp";
  return null;
}

export const figureKey = (owner: string, name: string) => `figures/${owner}/${name}.png`;
export type FigMeta = { figures?: Record<string, Figure[]>; figureUp?: Record<string, number[]> };
export const figMeta = (docKinds: unknown): FigMeta => (docKinds && typeof docKinds === "object" && !Array.isArray(docKinds) ? (docKinds as FigMeta) : {});

/** Savoldagi barcha rasm joylari kesib yuklanganmi (yoki rasm joyi umuman yo'qmi). */
export function figuresReady(text: string, qid: string, meta: FigMeta): boolean {
  const slots = slotNumbers(text);
  if (!slots.length) return true;
  const up = meta.figureUp?.[qid] ?? [];
  return slots.every((n) => up.includes(n));
}

/** Tasdiqlangan savollardagi hali yuklanmagan rasm joylari (brauzer ularni kesib yuboradi). */
export async function pendingFigures(userId: string, sessionId: string) {
  const s = await db.importSession.findFirst({ where: { id: sessionId, ownerId: userId }, select: { id: true } });
  if (!s) throw new ApiError(404, "Import topilmadi.");
  const [files, qs] = await Promise.all([
    db.importFile.findMany({ where: { importSessionId: sessionId }, select: { id: true, kind: true, docKinds: true } }),
    db.extractedQuestion.findMany({ where: { importSessionId: sessionId, userDecision: "APPROVED" }, select: { id: true, fileId: true, originalText: true, editedText: true } }),
  ]);
  const items: { questionId: string; n: number; page: number | null; box: Figure["box"]; kind: string; fileId: string; fileKind: string; done: boolean }[] = [];
  for (const q of qs) {
    const f = files.find((x) => x.id === q.fileId);
    if (!f) continue;
    const m = figMeta(f.docKinds);
    for (const n of slotNumbers(q.editedText ?? q.originalText)) {
      const fig = m.figures?.[q.id]?.find((x) => x.n === n);
      if (!fig) continue;
      items.push({ questionId: q.id, n, page: fig.page, box: fig.box, kind: fig.kind, fileId: f.id, fileKind: f.kind, done: !!m.figureUp?.[q.id]?.includes(n) });
    }
  }
  return { items };
}

/** Brauzer kesgan rasmni (PNG) saqlaydi. Faqat o'z importidagi, rasm joyi mavjud savol uchun. */
export async function uploadFigure(userId: string, sessionId: string, qid: string, n: number, bytes: Uint8Array) {
  if (!Number.isInteger(n) || n < 1 || n > 20) throw new ApiError(400, "Rasm raqami noto'g'ri.");
  if (bytes.length > MAX_FIGURE_BYTES) throw new ApiError(413, "Rasm juda katta (3 MB gacha).");
  if (!isPng(bytes)) throw new ApiError(400, "Rasm PNG formatida bo'lishi kerak.", "bad_image");
  const q = await db.extractedQuestion.findFirst({ where: { id: qid, importSessionId: sessionId, session: { ownerId: userId } }, select: { id: true, fileId: true } });
  if (!q || !q.fileId) throw new ApiError(404, "Savol topilmadi.");
  const f = await db.importFile.findUnique({ where: { id: q.fileId }, select: { id: true, docKinds: true } });
  const m = figMeta(f?.docKinds);
  if (!f || !m.figures?.[qid]?.some((x) => x.n === n)) throw new ApiError(404, "Bu savolda bunday rasm joyi yo'q.");
  const st = storage();
  if (!st.configured()) throw new ApiError(503, "Fayl saqlash xizmati ulanmagan.", "storage_unconfigured");
  const key = figureKey(userId, `${sessionId}-${qid}-${n}`);
  await st.remove(key).catch(() => undefined);
  await st.put(key, bytes, "image/png");
  // Fayl metasi qayta o'qib yoziladi (boshqa maydonlar saqlanadi).
  const fresh = figMeta((await db.importFile.findUnique({ where: { id: f.id }, select: { docKinds: true } }))?.docKinds);
  const up = { ...(fresh.figureUp ?? {}) };
  up[qid] = [...new Set([...(up[qid] ?? []), n])].sort((a, b) => a - b);
  await db.importFile.update({ where: { id: f.id }, data: { docKinds: { ...(fresh as object), figureUp: up } as never } });
  return { ok: true as const };
}

/** DOCX rasmlari: matndagi `[[IMG:k]]` belgilari tekshiruvdagi `[[RASM:n]]` joylariga aylanadi va rasm baytlari darhol saqlanadi (brauzerda kesish kerak emas). */
export type DocImageSource = { owner: string; sessionId: string; images: Map<number, { bytes: Buffer | null }> };
export const hasImgMark = (s: string) => /\[\[IMG:\d{1,4}\]\]/.test(s);
export async function bindDocImages(text: string, options: { label: string; text: string }[], o: DocImageSource & { qid: string }) {
  const order: number[] = [];
  const base = Math.max(0, ...slotNumbers(text), ...options.flatMap((x) => slotNumbers(x.text)));
  const slot = (s: string) => s.replace(/\[\[IMG:(\d{1,4})\]\]/g, (_m, k: string) => {
    const key = Number(k);
    let i = order.indexOf(key);
    if (i < 0) { order.push(key); i = order.length - 1; }
    return base + i + 1 <= 20 ? `[[RASM:${base + i + 1}]]` : "";
  });
  const outText = slot(text);
  const outOptions = options.map((x) => ({ ...x, text: slot(x.text) }));
  const figures: Figure[] = [];
  const up: number[] = [];
  let missing = 0;
  const st = storage();
  for (let i = 0; i < order.length && base + i + 1 <= 20; i++) {
    const n = base + i + 1;
    const bytes = o.images.get(order[i])?.bytes ?? null;
    const mime = bytes ? sniffImage(bytes) : null;
    if (bytes && mime && st.configured()) {
      try {
        const name = `${o.sessionId}-${o.qid}-${n}`;
        await st.put(figureKey(o.owner, name), bytes, mime);
        figures.push({ n, page: null, box: null, kind: "figure", src: `${o.owner}/${name}` });
        up.push(n);
        continue;
      } catch { /* saqlab bo'lmadi: quyida «o'qib bo'lmaydigan» deb belgilanadi */ }
    }
    missing++;
    figures.push({ n, page: null, box: null, kind: "unreadable" });
  }
  return { text: outText, options: outOptions, figures, up, missing };
}

/** Rasmni o'qish (ko'rsatish uchun). `owner`: egasining id'si yoki `global`; ruxsatni chaqiruvchi tekshiradi. */
export async function readFigure(owner: string, name: string): Promise<Buffer | null> {
  const st = storage();
  if (!st.configured()) return null;
  try { return await st.get(figureKey(owner, name)); } catch { return null; }
}

/**
 * Import rasmlarini tayyor savolga biriktiradi: har bir `[[RASM:n]]` uchun rasm `figures/<egasi>/<savolId>-<n>.png` ga nusxalanadi va belgi
 * `[[rasm:egasi/savolId-n]]` ga almashadi. Nusxa mustaqil: import o'chirilsa ham rasm qoladi.
 */
export async function attachFigures(text: string, o: { owner: string; sessionId: string; importQid: string; newQid: string }): Promise<string> {
  let out = text;
  const st = storage();
  for (const n of slotNumbers(text)) {
    let bytes: Buffer;
    try { bytes = await st.get(figureKey(o.owner, `${o.sessionId}-${o.importQid}-${n}`)); }
    catch { throw new ApiError(502, "Savol rasmi topilmadi: rasmlarni qayta tayyorlab ko'ring.", "figure_missing"); }
    const name = `${o.newQid}-${n}`;
    await st.put(figureKey(o.owner, name), bytes, sniffImage(bytes) ?? "image/png");
    out = out.split(`[[RASM:${n}]]`).join(`[[rasm:${o.owner}/${name}]]`);
  }
  return out;
}

/** Admin tasdiqlaganda: egasining rasmlari umumiy nusxaga ko'chiriladi (`global/<savolId>-<n>`). */
export async function globalizeFigures(text: string, o: { fromOwner: string; newQid: string }): Promise<string> {
  let out = text, i = 0;
  const st = storage();
  for (const p of imagePaths(text)) {
    const [owner, name] = p.split("/");
    if (owner !== o.fromOwner) continue;
    let bytes: Buffer;
    try { bytes = await st.get(figureKey(owner, name)); } catch { throw new ApiError(502, "Savol rasmi topilmadi: umumiy bankka o'tkazib bo'lmadi.", "figure_missing"); }
    const next = `global/${o.newQid}-${++i}`;
    await st.put(figureKey("global", `${o.newQid}-${i}`), bytes, sniffImage(bytes) ?? "image/png");
    out = out.split(`[[rasm:${p}]]`).join(`[[rasm:${next}]]`);
  }
  return out;
}

/** Savol o'chirilganda egasining rasm fayllari ham o'chiriladi. */
export async function removeFigures(texts: string[], owner: string) {
  const st = storage();
  if (!st.configured()) return;
  for (const t of texts) for (const p of imagePaths(t)) { const [o, name] = p.split("/"); if (o === owner) await st.remove(figureKey(o, name)).catch(() => undefined); }
}
