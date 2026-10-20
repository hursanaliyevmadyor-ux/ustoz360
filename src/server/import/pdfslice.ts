import { PDFDocument } from "pdf-lib";

/**
 * PDF'ni sahifalar bo'yicha kesish (sof JavaScript, pdf-lib). Katta to'plamlarda (masalan, 600+ betlik testlar) AI'ga butun fayl emas,
 * faqat kerakli sahifalar yuboriladi: tezroq, arzonroq va fayl hajmi chegarasiga bog'liq emas.
 */
const load = (bytes: Uint8Array) => PDFDocument.load(bytes, { updateMetadata: false, throwOnInvalidObject: false });

/** Sahifalar soni. Fayl ochilmasa (buzuq yoki qo'llab-quvvatlanmaydigan) null. */
export async function pdfPageCount(bytes: Uint8Array): Promise<number | null> {
  try { const n = (await load(bytes)).getPageCount(); return n > 0 ? n : null; } catch { return null; }
}

/** `from`..`to` (1 dan boshlab, ikkalasi ham kiradi) sahifalardan iborat yangi PDF. Chegaradan oshgan sahifalar tashlanadi. */
export async function slicePdf(bytes: Uint8Array, from: number, to: number): Promise<{ bytes: Uint8Array; from: number; to: number }> {
  const src = await load(bytes);
  const total = src.getPageCount();
  const a = Math.max(1, Math.min(from, total)), b = Math.max(a, Math.min(to, total));
  const out = await PDFDocument.create();
  const pages = await out.copyPages(src, Array.from({ length: b - a + 1 }, (_, i) => a - 1 + i));
  pages.forEach((p) => out.addPage(p));
  return { bytes: await out.save({ useObjectStreams: true }), from: a, to: b };
}
