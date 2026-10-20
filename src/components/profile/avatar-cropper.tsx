"use client";
import * as React from "react";
import { Minus, Plus } from "lucide-react";
import type { AvatarState } from "@/lib/avatars";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";

const VIEW = 280, OUT = 512;
const OK_TYPES = ["image/jpeg", "image/png", "image/webp"];
export const MAX_PICK_BYTES = 10 * 1024 * 1024;

/** Profil rasmini aylana shaklida qirqish: surish va kattalashtirish; natija 512×512 rasm (metadata'siz) bo'lib serverga yuboriladi. Server baribir tur va hajmni qayta tekshiradi. */
export function AvatarCropper({ file, onClose, onSaved }: { file: File | null; onClose: () => void; onSaved: (avatar: AvatarState) => void }) {
  const [img, setImg] = React.useState<HTMLImageElement | null>(null);
  const [zoom, setZoom] = React.useState(1);
  const [pos, setPos] = React.useState({ x: 0, y: 0 });
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");
  const drag = React.useRef<{ x: number; y: number; px: number; py: number } | null>(null);

  React.useEffect(() => {
    setImg(null); setError(""); setZoom(1); setPos({ x: 0, y: 0 });
    if (!file) return;
    if (!OK_TYPES.includes(file.type)) { setError("Faqat JPG, PNG yoki WebP rasm tanlang."); return; }
    if (file.size > MAX_PICK_BYTES) { setError("Rasm juda katta (10 MB gacha)."); return; }
    const url = URL.createObjectURL(file);
    const i = new Image();
    i.onload = () => setImg(i);
    i.onerror = () => setError("Rasmni ochib bo'lmadi.");
    i.src = url;
    return () => URL.revokeObjectURL(url);
  }, [file]);

  // Rasm doira ichini to'liq qoplashi uchun minimal masshtab; surish chegaralanadi.
  const base = img ? VIEW / Math.min(img.naturalWidth, img.naturalHeight) : 1;
  const scale = base * zoom;
  const clamp = React.useCallback((p: { x: number; y: number }) => {
    if (!img) return p;
    const mx = Math.max(0, (img.naturalWidth * scale - VIEW) / 2), my = Math.max(0, (img.naturalHeight * scale - VIEW) / 2);
    return { x: Math.max(-mx, Math.min(mx, p.x)), y: Math.max(-my, Math.min(my, p.y)) };
  }, [img, scale]);
  React.useEffect(() => { setPos((p) => clamp(p)); }, [clamp]);

  const down = (e: React.PointerEvent) => { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); drag.current = { x: e.clientX, y: e.clientY, px: pos.x, py: pos.y }; };
  const move = (e: React.PointerEvent) => { const d = drag.current; if (d) setPos(clamp({ x: d.px + e.clientX - d.x, y: d.py + e.clientY - d.y })); };
  const up = () => { drag.current = null; };
  const key = (e: React.KeyboardEvent) => {
    const step = 12; const d = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key];
    if (d) { e.preventDefault(); setPos((p) => clamp({ x: p.x + d[0], y: p.y + d[1] })); }
  };

  const save = async () => {
    if (!img) return;
    setBusy(true); setError("");
    try {
      const c = document.createElement("canvas"); c.width = OUT; c.height = OUT;
      const ctx = c.getContext("2d")!;
      const k = OUT / VIEW;
      ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, OUT, OUT);
      ctx.drawImage(img, (VIEW / 2 + pos.x - (img.naturalWidth * scale) / 2) * k, (VIEW / 2 + pos.y - (img.naturalHeight * scale) / 2) * k, img.naturalWidth * scale * k, img.naturalHeight * scale * k);
      const blob: Blob | null = await new Promise((res) => c.toBlob((b) => res(b), "image/webp", 0.9));
      const out = blob && blob.type === "image/webp" ? blob : await new Promise<Blob | null>((res) => c.toBlob((b) => res(b), "image/jpeg", 0.9));
      if (!out) throw new Error("Rasmni tayyorlab bo'lmadi.");
      const r = await fetch("/api/profile/avatar", { method: "POST", headers: { "content-type": out.type }, body: out });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error ?? "Rasmni yuklab bo'lmadi.");
      onSaved(d as AvatarState);
      onClose();
    } catch (e) { setError((e as Error).message); }
    setBusy(false);
  };

  return (
    <Dialog open={!!file} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent title="Profil rasmi" description="Rasmni suring va kattalashtiring: doira ichidagi qism saqlanadi.">
        <div className="flex flex-col items-center gap-4">
          <div role="application" aria-label="Rasmni qirqish: surish uchun sudrang yoki strelka tugmalarini bosing" tabIndex={0} onKeyDown={key}
            onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}
            className="relative touch-none select-none overflow-hidden rounded-2xl bg-muted outline-none focus-visible:ring-2 focus-visible:ring-primary" style={{ width: VIEW, height: VIEW, maxWidth: "100%" }}>
            {img && (
              // Mahalliy blob: next/image kerak emas.
              // eslint-disable-next-line @next/next/no-img-element
              <img src={img.src} alt="" draggable={false} className="pointer-events-none absolute max-w-none"
                style={{ width: img.naturalWidth * scale, height: img.naturalHeight * scale, left: VIEW / 2 + pos.x - (img.naturalWidth * scale) / 2, top: VIEW / 2 + pos.y - (img.naturalHeight * scale) / 2 }} />
            )}
            {/* Doira niqobi: tashqarisi xira */}
            <div aria-hidden className="pointer-events-none absolute inset-0 rounded-full" style={{ boxShadow: "0 0 0 999px rgba(16,42,76,0.55)", border: "2px solid #fff" }} />
          </div>
          <div className="flex w-full max-w-[280px] items-center gap-3">
            <Button type="button" variant="outline" size="icon" aria-label="Kichraytirish" onClick={() => setZoom((z) => Math.max(1, +(z - 0.2).toFixed(2)))}><Minus className="h-4 w-4" aria-hidden /></Button>
            <input type="range" min={1} max={4} step={0.05} value={zoom} onChange={(e) => setZoom(Number(e.target.value))} aria-label="Kattalashtirish" className="h-2 flex-1 accent-primary" />
            <Button type="button" variant="outline" size="icon" aria-label="Kattalashtirish" onClick={() => setZoom((z) => Math.min(4, +(z + 0.2).toFixed(2)))}><Plus className="h-4 w-4" aria-hidden /></Button>
          </div>
          {error && <p role="alert" className="text-center text-sm text-danger">{error}</p>}
          <div className="flex w-full justify-end gap-2">
            <Button variant="ghost" onClick={onClose}>Bekor qilish</Button>
            <Button loading={busy} disabled={!img} onClick={() => void save()}>Saqlash</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
