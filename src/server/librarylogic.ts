import { inflateRawSync } from "node:zlib";

/** BILIMXONA: yuklashni tekshirish, matn ajratish va bo'laklash (toza funksiyalar, bazaga tegmaydi). */

export const MAX_FILE_BYTES = 5 * 1024 * 1024; // 5 MB (hosting so'rov hajmi chegarasiga ham mos)
export const MAX_DOCS_PER_USER = 50;
export const MAX_TOTAL_BYTES_PER_USER = 100 * 1024 * 1024;

export type FileKind = "pdf" | "docx" | "txt";
export const KIND_MIME: Record<FileKind, string> = { pdf: "application/pdf", docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", txt: "text/plain" };

/** Fayl nomi: faqat xavfsiz belgilar (yo'l va maxsus belgilarsiz). */
export function safeFileName(name: string): string {
  const base = name.replace(/^.*[\\/]/, "").normalize("NFKD").replace(/[^\w.\- ]+/g, "").trim().replace(/\s+/g, "-").replace(/\.{2,}/g, ".").slice(0, 100);
  return base || "fayl";
}

const extOf = (name: string): FileKind | null => {
  const m = /\.([A-Za-z0-9]+)$/.exec(name);
  const e = m?.[1].toLowerCase();
  return e === "pdf" || e === "docx" || e === "txt" ? e : null;
};

/** Haqiqiy tarkib (magic bytes) kengaytmaga mos kelishi shart: nomi .pdf bo'lgan boshqa fayl o'tmaydi. */
export function detectKind(name: string, bytes: Uint8Array): { ok: true; kind: FileKind } | { ok: false; error: string } {
  const kind = extOf(name);
  if (!kind) return { ok: false, error: "Faqat PDF, DOCX yoki TXT fayl yuklash mumkin." };
  if (bytes.length === 0) return { ok: false, error: "Fayl bo'sh." };
  if (bytes.length > MAX_FILE_BYTES) return { ok: false, error: `Fayl ${Math.round(MAX_FILE_BYTES / 1024 / 1024)} MB dan oshmasin.` };
  const head = (n: number) => Buffer.from(bytes.subarray(0, n));
  if (kind === "pdf" && !head(5).equals(Buffer.from("%PDF-"))) return { ok: false, error: "Fayl haqiqiy PDF emas." };
  if (kind === "docx" && !head(4).equals(Buffer.from([0x50, 0x4b, 0x03, 0x04]))) return { ok: false, error: "Fayl haqiqiy DOCX emas." };
  if (kind === "txt") {
    if (bytes.subarray(0, 4096).includes(0)) return { ok: false, error: "Matn fayli emas (ikkilik belgilar bor)." };
    try { new TextDecoder("utf-8", { fatal: true }).decode(bytes); } catch { return { ok: false, error: "TXT fayl UTF-8 kodlashda bo'lishi kerak." }; }
  }
  return { ok: true, kind };
}

// ---------- DOCX matni (kutubxonasiz: zip + XML) ----------
function zipEntry(buf: Buffer, wanted: string): Buffer | null {
  const eocd = buf.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  if (eocd < 0) return null;
  const count = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  for (let i = 0; i < count && p + 46 <= buf.length && buf.readUInt32LE(p) === 0x02014b50; i++) {
    const method = buf.readUInt16LE(p + 10), csize = buf.readUInt32LE(p + 20), usize = buf.readUInt32LE(p + 24);
    const nlen = buf.readUInt16LE(p + 28), elen = buf.readUInt16LE(p + 30), clen = buf.readUInt16LE(p + 32), off = buf.readUInt32LE(p + 42);
    const name = buf.subarray(p + 46, p + 46 + nlen).toString("utf8");
    if (name === wanted) {
      if (buf.readUInt32LE(off) !== 0x04034b50) return null;
      const start = off + 30 + buf.readUInt16LE(off + 26) + buf.readUInt16LE(off + 28);
      const raw = buf.subarray(start, start + csize);
      if (usize > 20 * 1024 * 1024) return null; // zip-bomba himoyasi
      try { return method === 0 ? raw : method === 8 ? inflateRawSync(raw, { maxOutputLength: 20 * 1024 * 1024 }) : null; } catch { return null; }
    }
    p += 46 + nlen + elen + clen;
  }
  return null;
}
const decodeXml = (s: string) => s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n))).replace(/&amp;/g, "&");

export function extractDocx(bytes: Uint8Array): string | null {
  const xml = zipEntry(Buffer.from(bytes), "word/document.xml");
  if (!xml) return null;
  const text = decodeXml(xml.toString("utf8").replace(/<w:tab\/>/g, "\t").replace(/<\/w:p>/g, "\n").replace(/<w:br\/>/g, "\n").replace(/<[^>]+>/g, ""));
  return text.replace(/\n{3,}/g, "\n\n").trim() || null;
}

/** Matnni ajratadi: TXT va DOCX. PDF hozircha indekslanmaydi (null). */
export function extractText(kind: FileKind, bytes: Uint8Array): string | null {
  if (kind === "txt") return new TextDecoder("utf-8").decode(bytes).replace(/\r\n/g, "\n").trim() || null;
  if (kind === "docx") return extractDocx(bytes);
  return null;
}

/** RAG uchun bo'laklar: abzatslar chegarasida, taxminan `size` belgigacha. Bo'laklar soni cheklangan. */
export function chunkText(text: string, size = 1000, max = 300): string[] {
  const out: string[] = []; let cur = "";
  const flush = () => { if (cur.trim()) out.push(cur.trim()); cur = ""; };
  for (const para of text.split(/\n{2,}|\n/)) {
    const p = para.trim(); if (!p) continue;
    if (p.length > size) {
      flush();
      for (let i = 0; i < p.length; i += size) out.push(p.slice(i, i + size));
    } else if (cur.length + p.length + 1 > size) { flush(); cur = p; }
    else cur = cur ? `${cur}\n${p}` : p;
    if (out.length >= max) break;
  }
  flush();
  return out.slice(0, max);
}
