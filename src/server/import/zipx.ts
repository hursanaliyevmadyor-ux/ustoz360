import { inflateRawSync } from "node:zlib";

/**
 * ZIP o'qish (kutubxonasiz): DOCX, XLSX, PPTX va OpenDocument fayllari ZIP + XML. Faqat o'qiladi, hech narsa diskka yozilmaydi.
 * Himoya: bitta yozuv va umumiy ochilgan hajm cheklangan (zip-bomba), yozuvlar soni cheklangan.
 */
export const MAX_ENTRY_BYTES = 25 * 1024 * 1024;
export const MAX_TOTAL_BYTES = 60 * 1024 * 1024;
const MAX_ENTRIES = 5000;

export type ZipEntry = { name: string; method: number; csize: number; usize: number; offset: number };
export type Zip = { buf: Buffer; entries: Map<string, ZipEntry>; read: (name: string) => Buffer | null; budget: { used: number } };

export const isZipLike = (b: Uint8Array) => b.length > 4 && b[0] === 0x50 && b[1] === 0x4b && (b[2] === 0x03 || b[2] === 0x05) && (b[3] === 0x04 || b[3] === 0x06);

/** Markaziy katalogni o'qiydi. Buzilgan yoki ZIP bo'lmasa null. */
export function openZip(bytes: Uint8Array): Zip | null {
  const buf = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const eocd = buf.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  if (eocd < 0 || eocd + 22 > buf.length) return null;
  const count = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  const entries = new Map<string, ZipEntry>();
  for (let i = 0; i < count && i < MAX_ENTRIES; i++) {
    if (p + 46 > buf.length || buf.readUInt32LE(p) !== 0x02014b50) return entries.size ? finish(buf, entries) : null;
    const method = buf.readUInt16LE(p + 10), csize = buf.readUInt32LE(p + 20), usize = buf.readUInt32LE(p + 24);
    const nlen = buf.readUInt16LE(p + 28), elen = buf.readUInt16LE(p + 30), clen = buf.readUInt16LE(p + 32), offset = buf.readUInt32LE(p + 42);
    const name = buf.subarray(p + 46, p + 46 + nlen).toString("utf8");
    entries.set(name, { name, method, csize, usize, offset });
    p += 46 + nlen + elen + clen;
  }
  return entries.size ? finish(buf, entries) : null;
}

function finish(buf: Buffer, entries: Map<string, ZipEntry>): Zip {
  const budget = { used: 0 };
  const read = (name: string): Buffer | null => {
    const e = entries.get(name);
    if (!e || e.usize > MAX_ENTRY_BYTES || budget.used + e.usize > MAX_TOTAL_BYTES) return null;
    const off = e.offset;
    if (off + 30 > buf.length || buf.readUInt32LE(off) !== 0x04034b50) return null;
    const start = off + 30 + buf.readUInt16LE(off + 26) + buf.readUInt16LE(off + 28);
    const raw = buf.subarray(start, start + e.csize);
    try {
      const out = e.method === 0 ? raw : e.method === 8 ? inflateRawSync(raw, { maxOutputLength: MAX_ENTRY_BYTES }) : null;
      if (out) budget.used += out.length;
      return out;
    } catch { return null; }
  };
  return { buf, entries, read, budget };
}

/** Matn yozuvini o'qiydi (UTF-8). */
export const readText = (z: Zip, name: string): string | null => z.read(name)?.toString("utf8") ?? null;

/** Test va sinovlar uchun: yozuvlarni siqmasdan (STORE) ZIP ga joylaydi. */
export function buildZip(files: Record<string, string | Buffer>): Buffer {
  const parts: Buffer[] = [];
  const central: Buffer[] = [];
  let offset = 0;
  for (const [name, data] of Object.entries(files)) {
    const nameBuf = Buffer.from(name, "utf8");
    const content = typeof data === "string" ? Buffer.from(data, "utf8") : data;
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt16LE(0, 6); local.writeUInt16LE(0, 8);
    local.writeUInt32LE(0, 14); local.writeUInt32LE(content.length, 18); local.writeUInt32LE(content.length, 22); local.writeUInt16LE(nameBuf.length, 26);
    parts.push(local, nameBuf, content);
    const cen = Buffer.alloc(46);
    cen.writeUInt32LE(0x02014b50, 0); cen.writeUInt16LE(20, 4); cen.writeUInt16LE(20, 6);
    cen.writeUInt32LE(content.length, 20); cen.writeUInt32LE(content.length, 24); cen.writeUInt16LE(nameBuf.length, 28); cen.writeUInt32LE(offset, 42);
    central.push(cen, nameBuf);
    offset += 30 + nameBuf.length + content.length;
  }
  const cd = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(central.length / 2, 8); end.writeUInt16LE(central.length / 2, 10);
  end.writeUInt32LE(cd.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...parts, cd, end]);
}
