import { createHash } from "node:crypto";
import { isZipLike, openZip, readText } from "./zipx";

/**
 * Yuklanadigan fayl turlarini aniqlash va xavfsizlik tekshiruvi (toza funksiyalar, bazaga tegmaydi).
 * Tur nomiga ishonilmaydi: haqiqiy tarkib (magic bytes va ichki tuzilma) kengaytmaga mos kelishi shart.
 */
export type ImportKind = "pdf" | "docx" | "xlsx" | "pptx" | "odt" | "ods" | "odp" | "csv" | "txt" | "image";

export const KIND_MIME: Record<ImportKind, string> = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  odt: "application/vnd.oasis.opendocument.text",
  ods: "application/vnd.oasis.opendocument.spreadsheet",
  odp: "application/vnd.oasis.opendocument.presentation",
  csv: "text/csv",
  txt: "text/plain",
  image: "image/*",
};
export const IMAGE_MIME = { png: "image/png", jpg: "image/jpeg", webp: "image/webp" } as const;

export const KIND_LABEL: Record<ImportKind, string> = { pdf: "PDF", docx: "Word", xlsx: "Excel", pptx: "PowerPoint", odt: "OpenDocument matn", ods: "OpenDocument jadval", odp: "OpenDocument taqdimot", csv: "CSV", txt: "Matn", image: "Rasm" };

/** Qo'llab-quvvatlanadigan kengaytmalar (foydalanuvchiga ko'rsatiladi). */
export const SUPPORTED_LABEL = "PDF, DOCX, XLSX/CSV, PPTX, ODT/ODS/ODP, TXT, JPG/PNG/WEBP";
export const SUPPORTED_ACCEPT = ".pdf,.docx,.xlsx,.csv,.pptx,.odt,.ods,.odp,.txt,.jpg,.jpeg,.png,.webp";

export const maxImportBytes = () => Math.max(1, Number(process.env.IMPORT_MAX_MB) || 50) * 1024 * 1024;
export const MAX_FILES_PER_SESSION = 6;
export const MAX_SESSIONS_ACTIVE = 5;

/** Fayl nomi: faqat xavfsiz belgilar (yo'l va maxsus belgilarsiz). */
export function safeFileName(name: string): string {
  const base = name.replace(/^.*[\\/]/, "").normalize("NFKD").replace(/[^\w.\- ]+/g, "").trim().replace(/\s+/g, "-").replace(/\.{2,}/g, ".").slice(0, 100);
  return base || "fayl";
}

const LEGACY = new Set(["doc", "xls", "ppt", "rtf"]);
const BY_EXT: Record<string, ImportKind> = { pdf: "pdf", docx: "docx", xlsx: "xlsx", pptx: "pptx", odt: "odt", ods: "ods", odp: "odp", csv: "csv", txt: "txt", jpg: "image", jpeg: "image", png: "image", webp: "image" };

export const extOf = (name: string): string => /\.([A-Za-z0-9]+)$/.exec(name)?.[1].toLowerCase() ?? "";

export type Detected = { ok: true; kind: ImportKind; mime: string } | { ok: false; error: string; code: "empty" | "too_big" | "unsupported" | "legacy" | "encrypted" | "mismatch" | "broken" | "binary" };

const OLE = [0xd0, 0xcf, 0x11, 0xe0];
const startsWith = (b: Uint8Array, sig: number[]) => sig.every((v, i) => b[i] === v);

export function imageMime(b: Uint8Array): string | null {
  if (startsWith(b, [0x89, 0x50, 0x4e, 0x47])) return IMAGE_MIME.png;
  if (startsWith(b, [0xff, 0xd8, 0xff])) return IMAGE_MIME.jpg;
  if (b.length > 12 && Buffer.from(b.subarray(0, 4)).toString("latin1") === "RIFF" && Buffer.from(b.subarray(8, 12)).toString("latin1") === "WEBP") return IMAGE_MIME.webp;
  return null;
}

/** PDF parol bilan himoyalanganmi: trailer lug'atida /Encrypt bor. */
export function pdfEncrypted(bytes: Uint8Array): boolean {
  const tail = Buffer.from(bytes.subarray(Math.max(0, bytes.length - 4096))).toString("latin1");
  const head = Buffer.from(bytes.subarray(0, 2048)).toString("latin1");
  return /\/Encrypt\b/.test(tail) || /\/Encrypt\b/.test(head);
}

/** Matnni dekodlaydi: UTF-8 (BOM bilan ham), UTF-16 (BOM bilan), bo'lmasa windows-1251 (kirill) zaxirasi. null: matn emas. */
export function decodeText(bytes: Uint8Array): string | null {
  if (bytes.subarray(0, 4096).includes(0) && !(bytes[0] === 0xff && bytes[1] === 0xfe) && !(bytes[0] === 0xfe && bytes[1] === 0xff)) return null;
  if (bytes[0] === 0xff && bytes[1] === 0xfe) return new TextDecoder("utf-16le").decode(bytes.subarray(2));
  if (bytes[0] === 0xfe && bytes[1] === 0xff) return new TextDecoder("utf-16be").decode(bytes.subarray(2));
  try { return new TextDecoder("utf-8", { fatal: true }).decode(bytes).replace(/^﻿/, ""); } catch { /* keyingi kodlash */ }
  try { return new TextDecoder("windows-1251").decode(bytes); } catch { return null; }
}

const ODF_MIME: Record<string, ImportKind> = { "application/vnd.oasis.opendocument.text": "odt", "application/vnd.oasis.opendocument.spreadsheet": "ods", "application/vnd.oasis.opendocument.presentation": "odp" };

export function detectImportKind(name: string, bytes: Uint8Array): Detected {
  const ext = extOf(name);
  if (bytes.length === 0) return { ok: false, code: "empty", error: "Fayl bo'sh." };
  if (bytes.length > maxImportBytes()) return { ok: false, code: "too_big", error: `Fayl ${Math.round(maxImportBytes() / 1024 / 1024)} MB dan oshmasin.` };
  if (LEGACY.has(ext)) return { ok: false, code: "legacy", error: `Eski .${ext} formati qo'llab-quvvatlanmaydi. Faylni Word/Excel/PowerPoint'da «Boshqacha saqlash» orqali ${ext === "doc" ? ".docx" : ext === "xls" ? ".xlsx" : ext === "ppt" ? ".pptx" : ".docx yoki .pdf"} ko'rinishiga o'tkazib, qayta yuklang.` };
  const kind = BY_EXT[ext];
  if (!kind) return { ok: false, code: "unsupported", error: `Bu fayl turi qo'llab-quvvatlanmaydi. Mumkin: ${SUPPORTED_LABEL}.` };

  if (kind === "image") {
    const m = imageMime(bytes);
    return m ? { ok: true, kind, mime: m } : { ok: false, code: "mismatch", error: "Fayl haqiqiy rasm (JPG, PNG yoki WEBP) emas." };
  }
  if (kind === "pdf") {
    if (Buffer.from(bytes.subarray(0, 1024)).toString("latin1").indexOf("%PDF-") < 0) return { ok: false, code: "mismatch", error: "Fayl haqiqiy PDF emas." };
    if (pdfEncrypted(bytes)) return { ok: false, code: "encrypted", error: "PDF parol bilan himoyalangan. Parolni olib tashlab, qayta yuklang." };
    return { ok: true, kind, mime: KIND_MIME.pdf };
  }
  if (kind === "txt" || kind === "csv") {
    const t = decodeText(bytes);
    if (t === null) return { ok: false, code: "binary", error: "Matn fayli emas (ikkilik belgilar bor yoki kodlash noma'lum)." };
    return { ok: true, kind, mime: KIND_MIME[kind] };
  }
  // ZIP asosidagi fayllar
  if (startsWith(bytes, OLE)) return { ok: false, code: "encrypted", error: "Fayl parol bilan himoyalangan yoki eski formatda. Parolni olib tashlab, yangi formatda (.docx/.xlsx/.pptx) saqlab, qayta yuklang." };
  if (!isZipLike(bytes)) return { ok: false, code: "mismatch", error: `Fayl haqiqiy ${kind.toUpperCase()} emas yoki buzilgan.` };
  const z = openZip(bytes);
  if (!z) return { ok: false, code: "broken", error: "Fayl buzilgan: ichki tuzilmasini o'qib bo'lmadi." };
  const need = { docx: "word/document.xml", xlsx: "xl/workbook.xml", pptx: "ppt/presentation.xml" } as const;
  if (kind === "docx" || kind === "xlsx" || kind === "pptx") {
    if (!z.entries.has(need[kind])) return { ok: false, code: "mismatch", error: `Fayl haqiqiy ${kind.toUpperCase()} emas (tuzilmasi mos kelmaydi).` };
    return { ok: true, kind, mime: KIND_MIME[kind] };
  }
  // OpenDocument: mimetype yozuvi kengaytmaga mos bo'lishi shart.
  const mt = (readText(z, "mimetype") ?? "").trim();
  if (ODF_MIME[mt] !== kind || !z.entries.has("content.xml")) return { ok: false, code: "mismatch", error: `Fayl haqiqiy ${kind.toUpperCase()} emas (tuzilmasi mos kelmaydi).` };
  return { ok: true, kind, mime: KIND_MIME[kind] };
}

/** Fayl mazmuni bo'yicha SHA-256 (dublikat aniqlash). */
export const sha256Hex = (bytes: Uint8Array): string => createHash("sha256").update(bytes).digest("hex");
