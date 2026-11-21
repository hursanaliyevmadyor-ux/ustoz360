import { MAX_IMAGE_BYTES } from "./blob-chunks";

/**
 * Doskaga qo'yiladigan rasmni kichraytiradi: eng uzun tomoni 1600 piksel, JPEG; hajmi chegaradan oshmaguncha sifat va o'lcham pasaytiriladi.
 * Faqat brauzerda ishlaydi. Yaroqsiz fayl yoki juda katta bo'lsa null.
 */
export async function shrinkImage(file: File): Promise<Uint8Array | null> {
  if (!/^image\/(png|jpe?g|webp)$/.test(file.type) || file.size > 25_000_000) return null;
  let bmp: ImageBitmap;
  try { bmp = await createImageBitmap(file); } catch { return null; }
  try {
    for (const [scale, q] of [[1, 0.85], [1, 0.7], [0.8, 0.7], [0.65, 0.65], [0.5, 0.6]] as const) {
      const k = Math.min(1, 1600 / Math.max(bmp.width, bmp.height)) * scale;
      const c = document.createElement("canvas");
      c.width = Math.max(1, Math.round(bmp.width * k)); c.height = Math.max(1, Math.round(bmp.height * k));
      const ctx = c.getContext("2d");
      if (!ctx) return null;
      ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, c.width, c.height); // shaffof PNG oq fonda
      ctx.drawImage(bmp, 0, 0, c.width, c.height);
      const blob = await new Promise<Blob | null>((r) => c.toBlob(r, "image/jpeg", q));
      if (blob && blob.size <= MAX_IMAGE_BYTES) return new Uint8Array(await blob.arrayBuffer());
    }
    return null;
  } finally {
    bmp.close();
  }
}
