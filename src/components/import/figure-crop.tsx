"use client";
import * as React from "react";
import { ImageOff, Loader2 } from "lucide-react";
import { cropFigure, canvasToPng } from "@/lib/figure-crop";
import type { FigureInfo } from "@/lib/import-client";
import { cn } from "@/lib/utils";

const KIND: Record<string, string> = { figure: "Rasm", table: "Jadval", formula: "Formula", unreadable: "O'qib bo'lmagan joy" };

/** Savoldagi rasm/jadval/formula joyi: asl sahifadan kesilgan rasm o'z joyida ko'rsatiladi (kesib bo'lmasa, asl sahifaga havola). */
export function FigureCrop({ sessionId, fileId, fileKind, fig, onOpenPage }: { sessionId: string; fileId: string | null; fileKind: string | null; fig: FigureInfo | null; onOpenPage?: (page: number | null) => void }) {
  const [url, setUrl] = React.useState<string | null>(null);
  const [err, setErr] = React.useState(false);
  const ok = !!(fig && fig.box && fig.page && fileId && fileKind && ["pdf", "image"].includes(fileKind));
  const page = fig?.page ?? null, boxKey = fig?.box?.join(",") ?? "";

  React.useEffect(() => {
    if (!ok || !fileId || !fileKind) return;
    const box = boxKey ? (boxKey.split(",").map(Number) as [number, number, number, number]) : null;
    let live = true, made: string | null = null;
    setUrl(null); setErr(false);
    void (async () => {
      try {
        const c = await cropFigure(sessionId, fileId, fileKind, { page, box });
        const blob = await canvasToPng(c);
        if (!live) return;
        made = URL.createObjectURL(blob); setUrl(made);
      } catch { if (live) setErr(true); }
    })();
    return () => { live = false; if (made) URL.revokeObjectURL(made); };
  }, [ok, sessionId, fileId, fileKind, page, boxKey]);

  const label = KIND[fig?.kind ?? "figure"] ?? "Rasm";
  // DOCX ichidagi rasm: fayldan olinib saqlangan, o'z joyida ko'rsatiladi
  if (fig?.src) {
    return (
      <span className="my-2 block rounded-xl border border-dashed border-primary/40 bg-primary/5 p-2">
        {/* Himoyalangan rasm: next/image sozlamalarisiz oddiy <img>. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`/api/figures/${fig.src}`} alt="Savoldagi rasm (asl fayldan)" loading="lazy" className="mx-auto block max-h-96 max-w-full rounded-lg bg-white object-contain" />
        <span className="mt-1 block text-xs text-muted-foreground">Rasm · asl fayldagi joyida</span>
      </span>
    );
  }
  return (
    <span className="my-2 block rounded-xl border border-dashed border-primary/40 bg-primary/5 p-2">
      {url ? (
        // Brauzerda yaratilgan blob: next/image kerak emas.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt={`${label}: asl fayldan kesilgan`} className="mx-auto block max-h-96 max-w-full rounded-lg bg-white object-contain" />
      ) : ok && !err ? (
        <span className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" aria-hidden />{label} tayyorlanmoqda…</span>
      ) : (
        <span className="flex items-center justify-center gap-2 py-4 text-center text-sm text-muted-foreground"><ImageOff className="h-4 w-4 shrink-0" aria-hidden />{label}{fig?.page ? ` (${fig.page}-bet)` : ""}: kesib bo'lmadi, asl faylga qarang.</span>
      )}
      <span className={cn("mt-1 flex items-center justify-between gap-2 text-xs text-muted-foreground")}>
        <span>{label}{fig?.page ? ` · asl fayl, ${fig.page}-bet` : ""}</span>
        {onOpenPage && fig?.page ? <button type="button" className="font-semibold text-primary hover:underline" onClick={() => onOpenPage(fig.page)}>Asl sahifani ochish</button> : null}
      </span>
    </span>
  );
}
