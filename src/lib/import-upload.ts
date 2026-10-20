import { api } from "./admin-client";

/** Brauzer tomonidagi fayl yuklash: kichik fayllar to'g'ridan-to'g'ri, katta fayllar bo'laklab (hosting so'rov hajmi chegarasi tufayli). Progress ko'rsatiladi. */
export type UploadState = { key: string; name: string; size: number; status: "wait" | "up" | "done" | "error"; pct: number; error?: string; duplicate?: string };
export type DuplicateInfo = { sessionId: string; title: string; at: string } | null;
export type UploadResult = { ok: true; duplicateOf: DuplicateInfo } | { ok: false; error: string };

const SMALL = 3.5 * 1024 * 1024;

function send(method: "POST" | "PUT", url: string, body: XMLHttpRequestBodyInit, headers: Record<string, string>, onPct?: (p: number) => void): Promise<{ status: number; json: Record<string, unknown> }> {
  return new Promise((resolve) => {
    const x = new XMLHttpRequest();
    x.open(method, url);
    for (const [k, v] of Object.entries(headers)) x.setRequestHeader(k, v);
    x.upload.onprogress = (e) => { if (e.lengthComputable && onPct) onPct(e.loaded / e.total); };
    x.onload = () => { let json: Record<string, unknown> = {}; try { json = JSON.parse(x.responseText); } catch { /* javob JSON emas */ } resolve({ status: x.status, json }); };
    x.onerror = () => resolve({ status: 0, json: { error: "Server bilan aloqa yo'q. Internetni tekshirib, qayta urinib ko'ring." } });
    x.ontimeout = () => resolve({ status: 0, json: { error: "Yuklash vaqti tugadi. Qayta urinib ko'ring." } });
    x.send(body);
  });
}
const ok = (s: number) => s >= 200 && s < 300;
const err = (r: { status: number; json: Record<string, unknown> }, fallback: string) => (r.status === 401 ? "Avval tizimga kiring." : (r.json.error as string | undefined) ?? fallback);

export async function uploadFile(sessionId: string, file: File, role: "AUTO" | "QUESTIONS" | "ANSWERS", onPct: (p: number) => void): Promise<UploadResult> {
  if (file.size <= SMALL) {
    const fd = new FormData();
    fd.append("file", file); fd.append("role", role);
    const r = await send("POST", `/api/import/${sessionId}/files`, fd, {}, onPct);
    return ok(r.status) ? { ok: true, duplicateOf: (r.json.duplicateOf as DuplicateInfo) ?? null } : { ok: false, error: err(r, "Faylni yuklab bo'lmadi.") };
  }
  const prep = await api<{ fileId: string; chunkBytes: number; chunks: number }>(`/api/import/${sessionId}/files/prepare`, "POST", { name: file.name, size: file.size, role });
  if (!prep.ok) return { ok: false, error: prep.error };
  const { fileId, chunkBytes, chunks } = prep.data;
  for (let i = 0; i < chunks; i++) {
    const part = file.slice(i * chunkBytes, Math.min(file.size, (i + 1) * chunkBytes));
    let sent = false, lastError = "";
    for (let attempt = 0; attempt < 3 && !sent; attempt++) {
      const r = await send("PUT", `/api/import/${sessionId}/files/${fileId}/chunk?n=${i}`, part, { "content-type": "application/octet-stream" }, (p) => onPct((i + p) / chunks));
      if (ok(r.status)) sent = true; else lastError = err(r, "Fayl bo'lagini yuborib bo'lmadi.");
    }
    if (!sent) return { ok: false, error: lastError };
    onPct((i + 1) / chunks);
  }
  const done = await api<{ duplicateOf?: DuplicateInfo }>(`/api/import/${sessionId}/files/${fileId}/complete`, "POST");
  return done.ok ? { ok: true, duplicateOf: done.data.duplicateOf ?? null } : { ok: false, error: done.error };
}
