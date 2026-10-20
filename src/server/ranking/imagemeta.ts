/**
 * Profil rasmi xavfsizligi (toza funksiyalar, qo'shimcha paketsiz): haqiqiy tur (JPEG, PNG, WebP) bayt belgilari bo'yicha aniqlanadi, o'lchamlar
 * tekshiriladi va metadata (EXIF, GPS, XMP, izohlar, rang profili) olib tashlanadi. Brauzer aylana qirqim qilib yuborganda ham server qayta tekshiradi.
 */
export type CleanImage = { bytes: Uint8Array; mime: "image/jpeg" | "image/png" | "image/webp"; ext: "jpg" | "png" | "webp"; width: number; height: number };
export const AVATAR_MAX_BYTES = 2 * 1024 * 1024;
export const AVATAR_MIN_SIDE = 64, AVATAR_MAX_SIDE = 4096;

const u16 = (b: Uint8Array, o: number) => (b[o] << 8) | b[o + 1];
const u32 = (b: Uint8Array, o: number) => ((b[o] << 24) | (b[o + 1] << 16) | (b[o + 2] << 8) | b[o + 3]) >>> 0;
const le32 = (b: Uint8Array, o: number) => (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0;
const ascii = (b: Uint8Array, o: number, n: number) => String.fromCharCode(...b.slice(o, o + n));
const concat = (parts: Uint8Array[]) => { const out = new Uint8Array(parts.reduce((a, p) => a + p.length, 0)); let o = 0; for (const p of parts) { out.set(p, o); o += p.length; } return out; };

function cleanJpeg(b: Uint8Array): CleanImage | null {
  if (b[0] !== 0xff || b[1] !== 0xd8) return null;
  const out: Uint8Array[] = [b.slice(0, 2)];
  let i = 2, w = 0, h = 0;
  while (i + 4 <= b.length) {
    if (b[i] !== 0xff) return null;
    const m = b[i + 1];
    if (m === 0xff) { i++; continue; }
    if (m === 0xd9) { out.push(b.slice(i, i + 2)); i += 2; break; }
    if ((m >= 0xd0 && m <= 0xd8) || m === 0x01) { out.push(b.slice(i, i + 2)); i += 2; continue; }
    const len = u16(b, i + 2);
    if (len < 2 || i + 2 + len > b.length) return null;
    const seg = b.slice(i, i + 2 + len);
    if ((m >= 0xc0 && m <= 0xcf) && ![0xc4, 0xc8, 0xcc].includes(m)) { h = u16(b, i + 5); w = u16(b, i + 7); }
    // APP1–APP15 (EXIF, XMP, ICC...) va izohlar (COM) tashlanadi; JFIF (APP0) va jadvallar saqlanadi.
    const drop = (m >= 0xe1 && m <= 0xef) || m === 0xfe;
    if (!drop) out.push(seg);
    i += 2 + len;
    if (m === 0xda) { out.push(b.slice(i)); i = b.length; break; } // siqilgan ma'lumot oxirigacha o'zgarishsiz
  }
  if (!w || !h) return null;
  return { bytes: concat(out), mime: "image/jpeg", ext: "jpg", width: w, height: h };
}

const PNG_SIG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const PNG_KEEP = new Set(["IHDR", "PLTE", "IDAT", "IEND", "tRNS", "gAMA", "sRGB", "cHRM", "sBIT", "pHYs"]);
function cleanPng(b: Uint8Array): CleanImage | null {
  if (!PNG_SIG.every((x, i) => b[i] === x)) return null;
  const out: Uint8Array[] = [b.slice(0, 8)];
  let i = 8, w = 0, h = 0, idat = false, end = false;
  while (i + 12 <= b.length) {
    const len = u32(b, i), type = ascii(b, i + 4, 4), total = 12 + len;
    if (i + total > b.length) return null;
    if (type === "IHDR") { w = u32(b, i + 8); h = u32(b, i + 12); }
    if (type === "IDAT") idat = true;
    if (type === "acTL" || type === "fcTL" || type === "fdAT") return null; // animatsiya qo'llab-quvvatlanmaydi
    if (PNG_KEEP.has(type)) out.push(b.slice(i, i + total)); // tEXt, iTXt, zTXt, eXIf, tIME, iCCP va boshqa qo'shimcha bo'laklar tashlanadi
    i += total;
    if (type === "IEND") { end = true; break; }
  }
  if (!w || !h || !idat || !end) return null;
  return { bytes: concat(out), mime: "image/png", ext: "png", width: w, height: h };
}

function cleanWebp(b: Uint8Array): CleanImage | null {
  if (ascii(b, 0, 4) !== "RIFF" || ascii(b, 8, 4) !== "WEBP") return null;
  const riffEnd = Math.min(b.length, 8 + le32(b, 4));
  const kept: Uint8Array[] = [];
  let i = 12, w = 0, h = 0, image = false;
  while (i + 8 <= riffEnd) {
    const type = ascii(b, i, 4), len = le32(b, i + 4), padded = len + (len & 1);
    if (i + 8 + len > riffEnd) return null;
    if (type === "ANIM" || type === "ANMF") return null;
    const chunk = b.slice(i, i + 8 + padded > b.length ? b.length : i + 8 + padded);
    if (type === "VP8X") {
      w = (b[i + 12] | (b[i + 13] << 8) | (b[i + 14] << 16)) + 1; h = (b[i + 15] | (b[i + 16] << 8) | (b[i + 17] << 16)) + 1;
      const c = chunk.slice(); c[8] &= ~(0x20 | 0x08 | 0x04 | 0x02); // ICC, EXIF, XMP va animatsiya bayroqlari o'chiriladi
      kept.push(c);
    } else if (type === "VP8 ") {
      image = true; if (!w) { w = u16le(b, i + 14) & 0x3fff; h = u16le(b, i + 16) & 0x3fff; } kept.push(chunk);
    } else if (type === "VP8L") {
      image = true; if (!w) { const v = le32(b, i + 9); w = (v & 0x3fff) + 1; h = ((v >> 14) & 0x3fff) + 1; } kept.push(chunk);
    } else if (type === "ALPH") kept.push(chunk);
    // EXIF, XMP, ICCP va noma'lum bo'laklar tashlanadi
    i += 8 + padded;
  }
  if (!image || !w || !h) return null;
  const body = concat(kept);
  const head = new Uint8Array(12);
  head.set(b.slice(0, 4), 0); head.set(b.slice(8, 12), 8);
  const size = 4 + body.length; head[4] = size & 0xff; head[5] = (size >> 8) & 0xff; head[6] = (size >> 16) & 0xff; head[7] = (size >>> 24) & 0xff;
  return { bytes: concat([head, body]), mime: "image/webp", ext: "webp", width: w, height: h };
}
const u16le = (b: Uint8Array, o: number) => b[o] | (b[o + 1] << 8);

/** Rasmni tekshiradi va metadata'sini tozalaydi. Xato bo'lsa foydalanuvchiga tushunarli xabar. */
export function sanitizeAvatar(bytes: Uint8Array): { ok: true; image: CleanImage } | { ok: false; error: string } {
  if (bytes.length === 0) return { ok: false, error: "Rasm tanlanmagan." };
  if (bytes.length > AVATAR_MAX_BYTES) return { ok: false, error: "Rasm hajmi 2 MB dan oshmasin." };
  const img = cleanJpeg(bytes) ?? cleanPng(bytes) ?? cleanWebp(bytes);
  if (!img) return { ok: false, error: "Faqat JPG, PNG yoki WebP rasm yuklash mumkin (fayl buzilgan yoki boshqa turda)." };
  if (img.width < AVATAR_MIN_SIDE || img.height < AVATAR_MIN_SIDE) return { ok: false, error: `Rasm juda kichik (kamida ${AVATAR_MIN_SIDE}×${AVATAR_MIN_SIDE} piksel).` };
  if (img.width > AVATAR_MAX_SIDE || img.height > AVATAR_MAX_SIDE) return { ok: false, error: `Rasm juda katta (${AVATAR_MAX_SIDE}×${AVATAR_MAX_SIDE} pikseldan oshmasin).` };
  return { ok: true, image: img };
}
