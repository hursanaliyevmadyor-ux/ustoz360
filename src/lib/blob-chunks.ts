/**
 * Doskaga qo'yiladigan rasm kabi katta ikkilik ma'lumot: bo'laklarga bo'linib LiveKit ma'lumot kanalida ("bimg" topic) yuboriladi
 * va qabul qiluvchida qayta yig'iladi. Hech qayerga saqlanmaydi.
 *
 * Bo'lak tuzilishi (katta-endian): 0 sehrli bayt 0x49, 1..4 rasm raqami (u32), 5..6 tartib (u16), 7..8 bo'laklar soni (u16), 9.. baytlar.
 */
export const BLOB_CHUNK = 12000; // LiveKit ishonchli paketi uchun 15 KiB dan past
export const MAX_BLOB_BYTES = 2_000_000; // eng katta fayl (so'rovnomaga biriktirilgan hujjat)
export const MAX_IMAGE_BYTES = 480_000; // doskaga qo'yiladigan rasm (kichraytirilgan)
export const MAX_BLOB_CHUNKS = Math.ceil(MAX_BLOB_BYTES / BLOB_CHUNK);
const HEAD = 9;
const MAGIC = 0x49;

export type BlobChunk = { id: number; index: number; total: number; data: Uint8Array };

/** Baytlarni paketlarga bo'ladi. Bo'sh yoki juda katta bo'lsa null. */
export function splitBlob(id: number, bytes: Uint8Array): Uint8Array[] | null {
  if (bytes.length === 0 || bytes.length > MAX_BLOB_BYTES) return null;
  const total = Math.ceil(bytes.length / BLOB_CHUNK);
  const out: Uint8Array[] = [];
  for (let i = 0; i < total; i++) {
    const part = bytes.subarray(i * BLOB_CHUNK, (i + 1) * BLOB_CHUNK);
    const p = new Uint8Array(HEAD + part.length);
    const v = new DataView(p.buffer);
    p[0] = MAGIC;
    v.setUint32(1, id >>> 0);
    v.setUint16(5, i);
    v.setUint16(7, total);
    p.set(part, HEAD);
    out.push(p);
  }
  return out;
}

/** Kelgan paketni tekshiradi; noto'g'ri bo'lsa null (hech qachon xato tashlamaydi). */
export function parseBlobChunk(p: Uint8Array): BlobChunk | null {
  if (!(p instanceof Uint8Array) || p.length <= HEAD || p.length > HEAD + BLOB_CHUNK || p[0] !== MAGIC) return null;
  const v = new DataView(p.buffer, p.byteOffset, p.byteLength);
  const index = v.getUint16(5), total = v.getUint16(7);
  if (total < 1 || total > MAX_BLOB_CHUNKS || index >= total) return null;
  return { id: v.getUint32(1), index, total, data: p.subarray(HEAD) };
}

type Pending = { total: number; parts: (Uint8Array | undefined)[]; count: number; at: number };

/** Rasm raqami bo'yicha yig'adi (bir vaqtda bir nechta rasm bo'lishi mumkin, lekin cheklangan). Tugagach to'liq baytlarni qaytaradi. */
export class BlobAssembler {
  private pending = new Map<number, Pending>();
  constructor(private now: () => number = () => Date.now(), private ttlMs = 60_000, private maxPending = 6) {}

  add(c: BlobChunk): { id: number; bytes: Uint8Array } | null {
    const t = this.now();
    for (const [id, p] of this.pending) if (t - p.at > this.ttlMs) this.pending.delete(id); // eskirganlar
    let p = this.pending.get(c.id);
    if (p && p.total !== c.total) { this.pending.delete(c.id); p = undefined; }
    if (!p) {
      if (this.pending.size >= this.maxPending) { const first = this.pending.keys().next().value; if (first !== undefined) this.pending.delete(first); }
      p = { total: c.total, parts: new Array<Uint8Array | undefined>(c.total).fill(undefined), count: 0, at: t };
      this.pending.set(c.id, p);
    }
    if (p.parts[c.index]) return null; // takror
    p.parts[c.index] = c.data;
    p.count++;
    if (p.count < p.total) return null;
    this.pending.delete(c.id);
    const size = p.parts.reduce((s, x) => s + (x?.length ?? 0), 0);
    const bytes = new Uint8Array(size);
    let o = 0;
    for (const x of p.parts) { if (x) { bytes.set(x, o); o += x.length; } }
    return { id: c.id, bytes };
  }
}
