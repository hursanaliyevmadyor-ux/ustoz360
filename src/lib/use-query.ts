"use client";
import * as React from "react";

export type Query<T> = { data: T | null; loading: boolean; error: string | null; status: number; reload: () => void; setData: React.Dispatch<React.SetStateAction<T | null>> };

/**
 * Autentifikatsiyalangan GET so'rov: yuklanish, xato (401/403 alohida) va qayta yuklash. `url = null` bo'lsa so'rov yuborilmaydi.
 * Xato matni serverdan keladi (tushunarli o'zbekcha), texnik tafsilot ko'rsatilmaydi.
 */
export function useQuery<T>(url: string | null): Query<T> {
  const [data, setData] = React.useState<T | null>(null);
  const [loading, setLoading] = React.useState(Boolean(url));
  const [error, setError] = React.useState<string | null>(null);
  const [status, setStatus] = React.useState(0);
  const [tick, setTick] = React.useState(0);
  React.useEffect(() => {
    if (!url) { setLoading(false); return; }
    let live = true;
    setLoading(true); setError(null);
    fetch(url).then(async (r) => {
      const d = await r.json().catch(() => ({}));
      if (!live) return;
      setStatus(r.status);
      if (!r.ok) { setError(r.status === 401 ? "Avval tizimga kiring." : r.status === 403 ? "Bu bo'lim uchun huquqingiz yo'q." : (d as { error?: string }).error ?? "Ma'lumotni yuklab bo'lmadi."); setData(null); }
      else setData(d as T);
      setLoading(false);
    }).catch(() => { if (live) { setStatus(0); setError("Server bilan aloqa yo'q. Internetni tekshirib, qayta urinib ko'ring."); setLoading(false); } });
    return () => { live = false; };
  }, [url, tick]);
  const reload = React.useCallback(() => setTick((t) => t + 1), []);
  return { data, loading, error, status, reload, setData };
}
