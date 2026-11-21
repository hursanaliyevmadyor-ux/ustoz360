/**
 * So'rovnomaga biriktiriladigan fayl: rasm, PDF, Word, Excel, PowerPoint. Fayl ustoz brauzerida turadi va LiveKit ma'lumot kanalida
 * bo'laklab yuboriladi (blob-chunks.ts); bazaga yoki saqlash joyiga yozilmaydi, shuning uchun hajm cheklangan.
 * Fayl turi nomga emas, fayl ichidagi belgiga (magic bayt) qarab aniqlanadi.
 */
export const MAX_FILE_BYTES = 2_000_000;
export const MAX_FILE_NAME = 80;
export type FileKind = "image" | "pdf" | "word" | "excel" | "ppt";

const M = {
  png: "image/png", jpg: "image/jpeg", webp: "image/webp", pdf: "application/pdf",
  doc: "application/msword", docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel", xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ppt: "application/vnd.ms-powerpoint", pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
} as const;
const KIND_OF_MIME: Record<string, FileKind> = {
  [M.png]: "image", [M.jpg]: "image", [M.webp]: "image", [M.pdf]: "pdf", [M.doc]: "word", [M.docx]: "word",
  [M.xls]: "excel", [M.xlsx]: "excel", [M.ppt]: "ppt", [M.pptx]: "ppt",
};
export const FILE_LABEL: Record<FileKind, string> = { image: "Rasm", pdf: "PDF", word: "Word", excel: "Excel", ppt: "PowerPoint" };
/** <input type="file"> uchun ruxsat etilgan turlar. */
export const FILE_ACCEPT = ".png,.jpg,.jpeg,.webp,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx";

export type PollFile = { id: number; name: string; mime: string; size: number; kind: FileKind };

export const kindOfMime = (mime: unknown): FileKind | null => (typeof mime === "string" && Object.prototype.hasOwnProperty.call(KIND_OF_MIME, mime) ? KIND_OF_MIME[mime]! : null);

/** Fayl nomini xavfsiz qiladi: yo'l belgilari, boshqaruv belgilari olib tashlanadi, uzunligi cheklanadi (kengaytma saqlanadi). */
export function cleanFileName(raw: unknown): string {
  // eslint-disable-next-line no-control-regex
  let n = typeof raw === "string" ? raw.replace(/[\u0000-\u001f\u007f<>:"/\\|?*]/g, " ").replace(/\s+/g, " ").trim() : "";
  n = n.replace(/^[.\s]+/, "");
  if (n.length > MAX_FILE_NAME) {
    const dot = n.lastIndexOf(".");
    const ext = dot > 0 && n.length - dot <= 6 ? n.slice(dot) : "";
    n = n.slice(0, MAX_FILE_NAME - ext.length).trimEnd() + ext;
  }
  return n;
}

const startsWith = (b: Uint8Array, sig: readonly number[], at = 0) => sig.every((v, i) => b[at + i] === v);
const ext = (name: string) => (name.toLowerCase().match(/\.([a-z0-9]{2,5})$/)?.[1] ?? "");

/** Fayl turini ichidagi belgiga qarab aniqlaydi; ruxsat etilmagan yoki nomi bilan mos kelmasa null. */
export function sniffFile(bytes: Uint8Array, name: string): { mime: string; kind: FileKind } | null {
  if (bytes.length < 8) return null;
  const e = ext(name);
  let mime: string | null = null;
  if (startsWith(bytes, [0x25, 0x50, 0x44, 0x46])) mime = M.pdf;
  else if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47])) mime = M.png;
  else if (startsWith(bytes, [0xff, 0xd8, 0xff])) mime = M.jpg;
  else if (startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) && startsWith(bytes, [0x57, 0x45, 0x42, 0x50], 8)) mime = M.webp;
  else if (startsWith(bytes, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])) mime = e === "doc" ? M.doc : e === "xls" ? M.xls : e === "ppt" ? M.ppt : null;
  else if (startsWith(bytes, [0x50, 0x4b, 0x03, 0x04])) mime = e === "docx" ? M.docx : e === "xlsx" ? M.xlsx : e === "pptx" ? M.pptx : null;
  const kind = kindOfMime(mime);
  return mime && kind ? { mime, kind } : null;
}

/** 1,2 MB ko'rinishidagi hajm. */
export function fmtSize(n: number): string {
  if (!Number.isFinite(n) || n < 0) return "";
  if (n < 1000) return `${n} B`;
  if (n < 1_000_000) return `${Math.round(n / 1000)} KB`;
  return `${(n / 1_000_000).toFixed(1).replace(".", ",")} MB`;
}

/** Ustozdan kelgan fayl ma'lumotini tekshiradi; yaroqsiz bo'lsa null (hech qachon xato tashlamaydi). */
export function parsePollFile(v: unknown): PollFile | null {
  if (!v || typeof v !== "object" || Array.isArray(v)) return null;
  const o = v as Record<string, unknown>;
  const kind = kindOfMime(o.mime), name = cleanFileName(o.name);
  const ok = (x: unknown, max: number) => typeof x === "number" && Number.isInteger(x) && x >= 1 && x <= max;
  if (!kind || !name || !ok(o.id, 2 ** 31) || !ok(o.size, MAX_FILE_BYTES)) return null;
  return { id: o.id as number, name, mime: o.mime as string, size: o.size as number, kind };
}
