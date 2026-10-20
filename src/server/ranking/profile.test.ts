import { describe, expect, it } from "vitest";
import { checkNickname, normalizeNickname } from "./nickname";
import { sanitizeAvatar } from "./imagemeta";

const cat = (...p: number[][]) => Uint8Array.from(p.flat());
const txt = (s: string) => [...Buffer.from(s, "latin1")];
const be16 = (n: number) => [(n >> 8) & 255, n & 255];
const be32 = (n: number) => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];
const le32 = (n: number) => [n & 255, (n >> 8) & 255, (n >> 16) & 255, (n >>> 24) & 255];
const has = (b: Uint8Array, s: string) => Buffer.from(b).includes(Buffer.from(s, "latin1"));

describe("nik", () => {
  it("yagonalik kaliti katta-kichik harf, ._- belgilari va o'xshash raqamlarga bog'liq emas", () => {
    expect(normalizeNickname("ZiyoUstoz")).toBe(normalizeNickname("ziyo_ustoz"));
    expect(normalizeNickname("ZiyoUstoz")).toBe(normalizeNickname("Z1yo.Ustoz"));
    expect(normalizeNickname("IlmSari")).not.toBe(normalizeNickname("BilimPro"));
  });
  it("format: uzunlik, belgilar, faqat raqam, band so'zlar", () => {
    expect(checkNickname("ZiyoUstoz")).toMatchObject({ ok: true, nickname: "ZiyoUstoz" });
    expect(checkNickname("  BilimPro  ")).toMatchObject({ ok: true, nickname: "BilimPro" });
    expect(checkNickname("ab")).toMatchObject({ ok: false, code: "format" });
    expect(checkNickname("a".repeat(21))).toMatchObject({ ok: false, code: "format" });
    expect(checkNickname("Ziyo Ustoz")).toMatchObject({ ok: false, code: "format" });
    expect(checkNickname("_ziyo")).toMatchObject({ ok: false, code: "format" });
    expect(checkNickname("12345")).toMatchObject({ ok: false, code: "format" });
    expect(checkNickname("Admin")).toMatchObject({ ok: false, code: "blocked" });
    expect(checkNickname("4dmin_pro")).toMatchObject({ ok: false, code: "blocked" });
    expect(checkNickname("USTOZ360")).toMatchObject({ ok: false, code: "blocked" });
  });
});

describe("profil rasmi xavfsizligi", () => {
  it("JPEG: EXIF va izohlar olib tashlanadi, o'lchami o'qiladi, JFIF va ma'lumot saqlanadi", () => {
    const jpeg = cat(
      [0xff, 0xd8],
      [0xff, 0xe0, ...be16(16), ...txt("JFIF\0"), 1, 1, 0, 0, 1, 0, 1, 0, 0],
      [0xff, 0xe1, ...be16(2 + 16), ...txt("Exif\0\0GPS-SECRET")],
      [0xff, 0xfe, ...be16(2 + 6), ...txt("secret")],
      [0xff, 0xc0, ...be16(17), 8, ...be16(120), ...be16(100), 3, 1, 0x22, 0, 2, 0x11, 1, 3, 0x11, 1],
      [0xff, 0xda, ...be16(12), 3, 1, 0, 2, 0x11, 3, 0x11, 0, 63, 0, 1, 2, 3, 4, 0xff, 0xd9],
    );
    const r = sanitizeAvatar(jpeg);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.image).toMatchObject({ mime: "image/jpeg", ext: "jpg", width: 100, height: 120 });
    expect(has(r.image.bytes, "GPS-SECRET")).toBe(false);
    expect(has(r.image.bytes, "secret")).toBe(false);
    expect(has(r.image.bytes, "JFIF")).toBe(true);
    expect(r.image.bytes.slice(-2)).toEqual(Uint8Array.from([0xff, 0xd9]));
  });

  it("PNG: matn va EXIF bo'laklari tashlanadi, IHDR/IDAT/IEND saqlanadi", () => {
    const chunk = (type: string, data: number[]) => [...be32(data.length), ...txt(type), ...data, 0, 0, 0, 0];
    const png = cat([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], chunk("IHDR", [...be32(80), ...be32(90), 8, 6, 0, 0, 0]), chunk("tEXt", txt("Author\0Maxfiy Ism")), chunk("eXIf", txt("GPS")), chunk("IDAT", [1, 2, 3, 4]), chunk("IEND", []));
    const r = sanitizeAvatar(png);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.image).toMatchObject({ mime: "image/png", width: 80, height: 90 });
    expect(has(r.image.bytes, "Maxfiy Ism")).toBe(false);
    expect(has(r.image.bytes, "eXIf")).toBe(false);
    expect(has(r.image.bytes, "IDAT")).toBe(true);
    expect(sanitizeAvatar(cat([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], chunk("IHDR", [...be32(80), ...be32(90), 8, 6, 0, 0, 0]))).ok).toBe(false); // IDAT/IEND yo'q
  });

  it("WebP: EXIF/XMP bo'laklari va bayroqlari tozalanadi, RIFF hajmi qayta hisoblanadi", () => {
    const ck = (type: string, data: number[]) => [...txt(type), ...le32(data.length), ...data, ...(data.length & 1 ? [0] : [])];
    const vp8x = ck("VP8X", [0x08 | 0x04 | 0x20, 0, 0, 0, ...[199, 0, 0], ...[149, 0, 0]]); // 200×150
    const vp8l = ck("VP8L", [0x2f, 0xc7, 0x00, 0x00, 0x00, 1, 2, 3]);
    const exif = ck("EXIF", txt("GPS-SECRET"));
    const body = [...txt("WEBP"), ...vp8x, ...vp8l, ...exif];
    const webp = cat(txt("RIFF"), le32(body.length), body);
    const r = sanitizeAvatar(webp);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.image).toMatchObject({ mime: "image/webp", width: 200, height: 150 });
    expect(has(r.image.bytes, "GPS-SECRET")).toBe(false);
    expect(has(r.image.bytes, "EXIF")).toBe(false);
    const out = r.image.bytes;
    expect(le32Read(out, 4)).toBe(out.length - 8);
    const flags = out[12 + 8];
    expect(flags & (0x20 | 0x08 | 0x04 | 0x02)).toBe(0);
  });

  it("rad etiladi: bo'sh, katta hajm, boshqa tur, juda kichik rasm", () => {
    expect(sanitizeAvatar(new Uint8Array(0)).ok).toBe(false);
    expect(sanitizeAvatar(new Uint8Array(2 * 1024 * 1024 + 1)).ok).toBe(false);
    expect(sanitizeAvatar(Uint8Array.from(Buffer.from("GIF89a....", "latin1"))).ok).toBe(false);
    expect(sanitizeAvatar(Uint8Array.from(Buffer.from("<svg onload=alert(1)></svg>", "utf8"))).ok).toBe(false);
    const tiny = cat([0xff, 0xd8], [0xff, 0xc0, ...be16(17), 8, ...be16(10), ...be16(10), 3, 1, 0x22, 0, 2, 0x11, 1, 3, 0x11, 1], [0xff, 0xda, ...be16(4), 0, 0, 0xff, 0xd9]);
    expect(sanitizeAvatar(tiny)).toMatchObject({ ok: false });
  });
});

function le32Read(b: Uint8Array, o: number) { return (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0; }
