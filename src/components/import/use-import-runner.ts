"use client";
import * as React from "react";
import { api } from "@/lib/admin-client";
import { ACTIVE, type StepResult } from "@/lib/import-client";

/**
 * Faol importni bosqichma-bosqich davom ettiradi: har bir chaqiruv serverda bitta ish birligini bajaradi (resumable).
 * Sahifa yopilsa ham holat bazada saqlanadi; qaytib kirganda shu hook jarayonni qolgan joyidan davom ettiradi.
 * Bir vaqtda bitta tsikl ishlaydi, `wait` (soniya) bo'lsa kutiladi, tarmoq xatosida kutib qayta uriniladi.
 */
export function useImportRunner(sessionId: string, status: string | undefined, onTick: (r: StepResult) => void, onFinished: () => void) {
  const [last, setLast] = React.useState<StepResult | null>(null);
  const [offline, setOffline] = React.useState(false);
  const [running, setRunning] = React.useState(false);
  const cb = React.useRef({ onTick, onFinished });
  cb.current = { onTick, onFinished };
  const active = !!status && ACTIVE.includes(status);

  React.useEffect(() => {
    if (!active) { setRunning(false); return; }
    let live = true;
    const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
    void (async () => {
      setRunning(true);
      let failures = 0;
      while (live) {
        const r = await api<StepResult>(`/api/import/${sessionId}/advance`, "POST");
        if (!live) return;
        if (!r.ok) {
          if (r.status === 401 || r.status === 404) { setOffline(false); setRunning(false); cb.current.onFinished(); return; }
          failures++; setOffline(true);
          if (failures >= 8) { setRunning(false); return; }
          await sleep(Math.min(15000, 2000 * failures));
          continue;
        }
        failures = 0; setOffline(false);
        setLast(r.data); cb.current.onTick(r.data);
        if (r.data.finished) { setRunning(false); cb.current.onFinished(); return; }
        await sleep(Math.max(300, (r.data.wait ?? 0) * 1000));
      }
    })();
    return () => { live = false; };
  }, [sessionId, active]);

  return { last, offline, running };
}
