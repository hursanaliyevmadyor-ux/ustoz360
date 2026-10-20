import { api } from "./admin-client";
import type { FigureInfo, Preview } from "./import-client";

/**
 * Asl fayl sahifasidan rasm kesish (brauzerda). PDF sahifalarini chizish uchun pdf.js ishlatiladi (CDN'dan, kerak bo'lganda yuklanadi);
 * server PDF chizmaydi. Natija PNG: tekshiruv ko'rinishida va tayyor testga saqlash uchun.
 */
const PDFJS = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
const WORKER = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";

type PdfPage = { getViewport(o: { scale: number }): { width: number; height: number }; render(o: { canvasContext: CanvasRenderingContext2D; viewport: unknown }): { promise: Promise<void> } };
type PdfDoc = { numPages: number; getPage(n: number): Promise<PdfPage> };
type PdfLib = { GlobalWorkerOptions: { workerSrc: string }; getDocument(o: { url: string }): { promise: Promise<PdfDoc> } };

let libPromise: Promise<PdfLib> | null = null;
function loadPdfJs(): Promise<PdfLib> {
  const w = window as unknown as { pdfjsLib?: PdfLib };
  if (w.pdfjsLib) { w.pdfjsLib.GlobalWorkerOptions.workerSrc = WORKER; return Promise.resolve(w.pdfjsLib); }
  libPromise ??= new Promise<PdfLib>((resolve, reject) => {
    const s = document.createElement("script");
    s.src = PDFJS; s.async = true;
    s.onload = () => { if (w.pdfjsLib) { w.pdfjsLib.GlobalWorkerOptions.workerSrc = WORKER; resolve(w.pdfjsLib); } else reject(new Error("pdf.js yuklanmadi")); };
    s.onerror = () => { libPromise = null; reject(new Error("pdf.js yuklanmadi (internetni tekshiring)")); };
    document.head.appendChild(s);
  });
  return libPromise;
}

const docs = new Map<string, Promise<PdfDoc>>();
async function signedUrl(sessionId: string, fileId: string): Promise<{ url: string; kind: string }> {
  const r = await api<Preview>(`/api/import/${sessionId}/files/${fileId}/preview`);
  if (!r.ok) throw new Error(r.error);
  if (!r.data.url) throw new Error("Asl faylni ochib bo'lmadi.");
  return { url: r.data.url.split("#")[0], kind: r.data.kind };
}
function openPdf(sessionId: string, fileId: string): Promise<PdfDoc> {
  let p = docs.get(fileId);
  if (!p) {
    p = (async () => { const [lib, f] = await Promise.all([loadPdfJs(), signedUrl(sessionId, fileId)]); return lib.getDocument({ url: f.url }).promise; })();
    p.catch(() => docs.delete(fileId));
    docs.set(fileId, p);
  }
  return p;
}

const canvasOf = (w: number, h: number) => { const c = document.createElement("canvas"); c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h)); return c; };

/** Sahifadan `box` ([ymin, xmin, ymax, xmax], 0..1000) bo'yicha kesilgan rasm. Qutisi bo'lmasa butun sahifa. */
export async function cropFigure(sessionId: string, fileId: string, fileKind: string, fig: Pick<FigureInfo, "page" | "box">): Promise<HTMLCanvasElement> {
  let full: HTMLCanvasElement;
  if (fileKind === "pdf") {
    const pdf = await openPdf(sessionId, fileId);
    const page = await pdf.getPage(Math.min(Math.max(1, fig.page ?? 1), pdf.numPages));
    const base = page.getViewport({ scale: 1 });
    const viewport = page.getViewport({ scale: Math.min(3, Math.max(1.2, 1500 / base.width)) });
    full = canvasOf(viewport.width, viewport.height);
    await page.render({ canvasContext: full.getContext("2d")!, viewport }).promise;
  } else {
    const { url } = await signedUrl(sessionId, fileId);
    const img = await new Promise<HTMLImageElement>((resolve, reject) => { const i = new Image(); i.crossOrigin = "anonymous"; i.onload = () => resolve(i); i.onerror = () => reject(new Error("Rasmni ochib bo'lmadi.")); i.src = url; });
    full = canvasOf(img.naturalWidth, img.naturalHeight);
    full.getContext("2d")!.drawImage(img, 0, 0);
  }
  if (!fig.box) return full;
  const [y0, x0, y1, x1] = fig.box, padX = 8, padY = 8; // ~0,8% bo'sh joy: qirqilgan chiziqlar ko'rinmasligi uchun
  const sx = Math.max(0, ((x0 - padX) / 1000) * full.width), sy = Math.max(0, ((y0 - padY) / 1000) * full.height);
  const sw = Math.min(full.width - sx, ((x1 - x0 + 2 * padX) / 1000) * full.width), sh = Math.min(full.height - sy, ((y1 - y0 + 2 * padY) / 1000) * full.height);
  const out = canvasOf(sw, sh);
  out.getContext("2d")!.drawImage(full, sx, sy, sw, sh, 0, 0, out.width, out.height);
  return out;
}

export const canvasToPng = (c: HTMLCanvasElement) => new Promise<Blob>((resolve, reject) => c.toBlob((b) => (b ? resolve(b) : reject(new Error("Rasmni tayyorlab bo'lmadi."))), "image/png"));
