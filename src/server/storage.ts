import { ApiError } from "./auth";

/**
 * Fayl saqlash xizmati (BILIMXONA). Hozirgi amalga oshirish: Supabase Storage (REST), shaxsiy (private) bucket.
 * Kerakli muhit o'zgaruvchilari: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (faqat serverda; brauzerga hech qachon berilmaydi).
 * Fayllar brauzerdan to'g'ridan-to'g'ri emas, faqat server orqali yuklanadi va qisqa muddatli imzolangan havola bilan beriladi.
 */
export interface StorageService {
  configured(): boolean;
  put(path: string, bytes: Uint8Array, mime: string): Promise<void>;
  get(path: string): Promise<Buffer>;
  signedUrl(path: string, seconds: number): Promise<string>;
  remove(path: string): Promise<void>;
}

const bucket = () => process.env.SUPABASE_STORAGE_BUCKET || "library";
const base = () => (process.env.SUPABASE_URL ?? "").replace(/\/+$/, "");
const headers = (extra: Record<string, string> = {}) => ({ authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`, apikey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "", ...extra });
const enc = (p: string) => p.split("/").map(encodeURIComponent).join("/");
const fail = (what: string, status: number) => new ApiError(502, `Fayl saqlash xizmati xato berdi (${what}, ${status}).`);

let bucketReady = false;
async function ensureBucket() {
  if (bucketReady) return;
  const res = await fetch(`${base()}/storage/v1/bucket`, { method: "POST", headers: headers({ "content-type": "application/json" }), body: JSON.stringify({ id: bucket(), name: bucket(), public: false }), signal: AbortSignal.timeout(20_000) });
  // 200: yaratildi; 400/409: allaqachon bor.
  if (!res.ok && res.status !== 400 && res.status !== 409) throw fail("bucket", res.status);
  bucketReady = true;
}

const supabase: StorageService = {
  configured: () => Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY),
  async put(path, bytes, mime) {
    await ensureBucket();
    const res = await fetch(`${base()}/storage/v1/object/${bucket()}/${enc(path)}`, { method: "POST", headers: headers({ "content-type": mime, "x-upsert": "false" }), body: bytes as BodyInit, signal: AbortSignal.timeout(60_000) });
    if (!res.ok) throw fail("yuklash", res.status);
  },
  async get(path) {
    const res = await fetch(`${base()}/storage/v1/object/${bucket()}/${enc(path)}`, { headers: headers(), signal: AbortSignal.timeout(60_000) });
    if (!res.ok) throw fail("o'qish", res.status);
    return Buffer.from(await res.arrayBuffer());
  },
  async signedUrl(path, seconds) {
    const res = await fetch(`${base()}/storage/v1/object/sign/${bucket()}/${enc(path)}`, { method: "POST", headers: headers({ "content-type": "application/json" }), body: JSON.stringify({ expiresIn: seconds }), signal: AbortSignal.timeout(20_000) });
    if (!res.ok) throw fail("havola", res.status);
    const d = (await res.json()) as { signedURL?: string };
    if (!d.signedURL) throw fail("havola", 0);
    return `${base()}/storage/v1${d.signedURL.startsWith("/") ? "" : "/"}${d.signedURL}`;
  },
  async remove(path) {
    const res = await fetch(`${base()}/storage/v1/object/${bucket()}`, { method: "DELETE", headers: headers({ "content-type": "application/json" }), body: JSON.stringify({ prefixes: [path] }), signal: AbortSignal.timeout(20_000) });
    if (!res.ok) throw fail("o'chirish", res.status);
  },
};

let current: StorageService = supabase;
export const storage = (): StorageService => current;
/** Testlar uchun almashtirish. */
export const setStorage = (s: StorageService | null) => { current = s ?? supabase; };
export const storageConfigured = () => current.configured();
