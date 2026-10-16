export type ApiResult<T> = { ok: true; data: T } | { ok: false; error: string; status: number };

/** Admin sahifalari uchun fetch o'rami: xatoni tushunarli matn bilan qaytaradi. */
export async function api<T = unknown>(url: string, method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE" = "GET", body?: unknown): Promise<ApiResult<T>> {
  try {
    const r = await fetch(url, { method, ...(body !== undefined && { headers: { "content-type": "application/json" }, body: JSON.stringify(body) }) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) return { ok: false, status: r.status, error: r.status === 403 ? "Bu amal faqat adminlar uchun." : r.status === 401 ? "Avval tizimga kiring." : (d as { error?: string }).error ?? "Xatolik yuz berdi." };
    return { ok: true, data: d as T };
  } catch { return { ok: false, status: 0, error: "Server bilan aloqa yo'q. Internetni tekshirib, qayta urinib ko'ring." }; }
}