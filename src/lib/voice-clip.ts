/**
 * Chatdagi ovozli xabar: brauzerda yozilgan qisqa audio bo'laklarga bo'linib LiveKit ma'lumot kanalida ("voice" topic) yuboriladi
 * va qabul qiluvchida qayta yig'iladi. Hech qayerga saqlanmaydi (yozma chat kabi): faqat xabar paytida xonada bo'lganlar eshitadi.
 *
 * Bo'lak (paket) tuzilishi (hammasi katta-endian):
 *   0      sehrli bayt 0x56
 *   1..4   xabar raqami (u32)
 *   5      bo'lak tartibi (0 dan)
 *   6      bo'laklar soni
 *   7      format kodi (0 mp4, 1 webm, 2 ogg)
 *   8..9   davomiyligi, 0.1 soniyada (u16)
 *   10..   audio baytlar
 */
export const CLIP_CHUNK = 12000; // LiveKit ishonchli paketi uchun 15 KiB dan past
export const MAX_CLIP_CHUNKS = 16;
export const MAX_CLIP_BYTES = CLIP_CHUNK * MAX_CLIP_CHUNKS;
export const MAX_CLIP_MS = 60_000;
export const MIN_CLIP_MS = 700;
/** Yuboruvchi shu vaqtdan tez-tez yubormaydi; qabul qiluvchi esa undan kamroq kutadi (ortiqcha oqimdan himoya). */
export const SEND_GAP_MS = 1500;
const RECV_GAP_MS = 1000;
const HEAD = 10;
const MAGIC = 0x56;

export const CLIP_MIMES = ["audio/mp4", "audio/webm", "audio/ogg"] as const;
export type ClipMime = (typeof CLIP_MIMES)[number];
export type Clip = { mime: ClipMime; ms: number; bytes: Uint8Array };
export type ClipChunk = { id: number; index: number; total: number; mime: ClipMime; ms: number; data: Uint8Array };

/** MediaRecorder turini ("audio/webm;codecs=opus") asosiy formatga keltiradi; qo'llab-quvvatlanmasa null. */
export function clipMime(type: string): ClipMime | null {
  const base = type.split(";")[0]?.trim().toLowerCase();
  return CLIP_MIMES.find((m) => m === base) ?? null;
}

/** Audioni paketlarga bo'ladi. Bo'sh yoki juda katta bo'lsa null. */
export function splitClip(id: number, clip: Clip): Uint8Array[] | null {
  const n = clip.bytes.length;
  if (n === 0 || n > MAX_CLIP_BYTES) return null;
  const total = Math.ceil(n / CLIP_CHUNK);
  const ds = Math.min(0xffff, Math.max(0, Math.round(clip.ms / 100)));
  const out: Uint8Array[] = [];
  for (let i = 0; i < total; i++) {
    const part = clip.bytes.subarray(i * CLIP_CHUNK, (i + 1) * CLIP_CHUNK);
    const p = new Uint8Array(HEAD + part.length);
    const v = new DataView(p.buffer);
    p[0] = MAGIC;
    v.setUint32(1, id >>> 0);
    p[5] = i;
    p[6] = total;
    p[7] = CLIP_MIMES.indexOf(clip.mime);
    v.setUint16(8, ds);
    p.set(part, HEAD);
    out.push(p);
  }
  return out;
}

/** Kelgan paketni tekshiradi; noto'g'ri bo'lsa null (hech qachon xato tashlamaydi). */
export function parseChunk(p: Uint8Array): ClipChunk | null {
  if (!(p instanceof Uint8Array) || p.length <= HEAD || p.length > HEAD + CLIP_CHUNK || p[0] !== MAGIC) return null;
  const total = p[6] ?? 0, index = p[5] ?? 0;
  const mime = CLIP_MIMES[p[7] ?? 99];
  if (!mime || total < 1 || total > MAX_CLIP_CHUNKS || index >= total) return null;
  const v = new DataView(p.buffer, p.byteOffset, p.byteLength);
  return { id: v.getUint32(1), index, total, mime, ms: Math.min(MAX_CLIP_MS, v.getUint16(8) * 100), data: p.subarray(HEAD) };
}

type Pending = { id: number; total: number; mime: ClipMime; ms: number; parts: (Uint8Array | undefined)[]; count: number; at: number };

/** Har bir yuboruvchidan bir vaqtda faqat bitta xabar yig'iladi; tez-tez kelgan yoki buzilgan paketlar tashlanadi. */
export class ClipAssembler {
  private pending = new Map<string, Pending>();
  private lastDone = new Map<string, number>();
  constructor(private now: () => number = () => Date.now(), private ttlMs = 30_000, private maxSenders = 100) {}

  add(from: string, c: ClipChunk): (Clip & { id: number }) | null {
    const t = this.now();
    let p = this.pending.get(from);
    if (p && (t - p.at > this.ttlMs || p.id !== c.id || p.total !== c.total || p.mime !== c.mime)) { this.pending.delete(from); p = undefined; }
    if (!p) {
      if (t - (this.lastDone.get(from) ?? -Infinity) < RECV_GAP_MS) return null; // juda tez: tashlanadi
      if (this.pending.size >= this.maxSenders) { const first = this.pending.keys().next().value; if (first !== undefined) this.pending.delete(first); }
      p = { id: c.id, total: c.total, mime: c.mime, ms: c.ms, parts: new Array<Uint8Array | undefined>(c.total).fill(undefined), count: 0, at: t };
      this.pending.set(from, p);
    }
    if (p.parts[c.index]) return null; // takror
    p.parts[c.index] = c.data;
    p.count++;
    if (p.count < p.total) return null;
    this.pending.delete(from);
    this.lastDone.set(from, t);
    if (this.lastDone.size > 500) this.lastDone.clear();
    const size = p.parts.reduce((s, x) => s + (x?.length ?? 0), 0);
    const bytes = new Uint8Array(size);
    let o = 0;
    for (const x of p.parts) { if (x) { bytes.set(x, o); o += x.length; } }
    return { id: p.id, mime: p.mime, ms: p.ms, bytes };
  }
}

/** 0:07 ko'rinishidagi vaqt. */
export const clipTime = (ms: number): string => {
  const s = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};
