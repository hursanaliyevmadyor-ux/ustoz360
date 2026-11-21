import { shrinkImage } from "./image-shrink";
import { MAX_FILE_BYTES, cleanFileName, fmtSize, parsePollFile, sniffFile, type PollFile } from "./poll-file";

export type PreparedFile = { file: PollFile; bytes: Uint8Array };
export const PICK_ERROR = "Bu turdagi fayl qabul qilinmaydi. Rasm, PDF, Word, Excel yoki PowerPoint faylini tanlang.";

/**
 * Ustoz tanlagan faylni yuborishga tayyorlaydi (faqat brauzerda): turi fayl ichidagi belgiga qarab tekshiriladi,
 * rasm kichraytiriladi, boshqa fayl 2 MB dan oshmasligi kerak. Xato bo'lsa, o'zbekcha matn qaytadi.
 */
export async function preparePollFile(f: File): Promise<{ ok: true; value: PreparedFile } | { ok: false; error: string }> {
  if (f.size === 0) return { ok: false, error: "Fayl bo'sh." };
  if (f.size > 25_000_000) return { ok: false, error: `Fayl juda katta (${fmtSize(f.size)}). Rasm kichikroq bo'lsin, hujjat ${fmtSize(MAX_FILE_BYTES)} dan oshmasin.` };
  const head = new Uint8Array(await f.slice(0, 16).arrayBuffer());
  const kind = sniffFile(head, f.name);
  if (!kind) return { ok: false, error: PICK_ERROR };
  let bytes: Uint8Array;
  let mime = kind.mime;
  let name = cleanFileName(f.name);
  if (kind.kind === "image") {
    // brauzer ba'zan turini bermaydi (bo'sh): tur fayl ichidan aniqlangan, shuning uchun to'g'ri tur bilan beramiz
    const small = await shrinkImage(f.type === kind.mime ? f : new File([f], f.name, { type: kind.mime }));
    if (!small) return { ok: false, error: "Rasm ochilmadi yoki juda katta. PNG, JPG yoki WebP tanlang." };
    bytes = small; mime = "image/jpeg"; name = name.replace(/\.[a-z0-9]{2,5}$/i, "") + ".jpg";
  } else {
    if (f.size > MAX_FILE_BYTES) return { ok: false, error: `Fayl hajmi ${fmtSize(MAX_FILE_BYTES)} dan oshmasin (hozir ${fmtSize(f.size)}). Kichikroq fayl yoki PDF qiling.` };
    bytes = new Uint8Array(await f.arrayBuffer());
  }
  const file = parsePollFile({ id: Math.floor(Math.random() * 2 ** 31) || 1, name, mime, size: bytes.length });
  return file ? { ok: true, value: { file, bytes } } : { ok: false, error: PICK_ERROR };
}
