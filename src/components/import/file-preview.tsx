"use client";
import * as React from "react";
import { ExternalLink, FileText } from "lucide-react";
import { useQuery } from "@/lib/use-query";
import { type FileView, type Preview } from "@/lib/import-client";
import { Select } from "@/components/ui/form";
import { Skeleton } from "@/components/ui/states";

/** Asl fayl ko'rinishi: PDF/rasm — qisqa muddatli imzolangan havola orqali, matnli formatlar — ajratilgan matn. Savol sahifasiga o'tadi. */
export function FilePreview({ sessionId, files, fileId, page, onPickFile }: { sessionId: string; files: FileView[]; fileId: string | null; page: string | null; onPickFile: (id: string) => void }) {
  const current = files.find((f) => f.id === fileId) ?? files[0] ?? null;
  const q = useQuery<Preview>(current ? `/api/import/${sessionId}/files/${current.id}/preview${page ? `?page=${encodeURIComponent(page)}` : ""}` : null);
  return (
    <div className="space-y-2">
      <h3 className="flex items-center gap-2 text-base font-bold"><FileText className="h-5 w-5 text-primary" aria-hidden />Asl fayl</h3>
      {files.length > 1 && (
        <Select value={current?.id ?? ""} onChange={(e) => onPickFile(e.target.value)} aria-label="Faylni tanlang" className="h-9 text-sm">
          {files.map((f) => <option key={f.id} value={f.id}>{f.fileName}</option>)}
        </Select>
      )}
      {!current ? <p className="text-sm text-muted-foreground">Fayl yo'q.</p>
        : q.loading && !q.data ? <Skeleton className="h-72" />
        : q.error || !q.data ? <p role="alert" className="rounded-xl bg-muted px-3 py-2 text-sm text-muted-foreground">{q.error ?? "Faylni ko'rsatib bo'lmadi."}</p>
        : (
          <div className="space-y-2">
            {q.data.label && <p className="text-xs text-muted-foreground">Savol joylashgan joy: {q.data.label}</p>}
            {q.data.url && q.data.kind === "image" && (
              // Imzolangan havola: next/image domenlari talab qilinmasligi uchun oddiy <img>.
              // eslint-disable-next-line @next/next/no-img-element
              <img src={q.data.url} alt={q.data.fileName} className="max-h-[60vh] w-full rounded-xl border border-border object-contain" />
            )}
            {q.data.url && q.data.kind === "pdf" && <iframe key={q.data.url} src={q.data.url} title={q.data.fileName} className="h-[60vh] w-full rounded-xl border border-border bg-muted" />}
            {q.data.text !== null && <pre className="max-h-[60vh] overflow-auto whitespace-pre-wrap rounded-xl border border-border bg-muted/50 p-3 text-xs leading-relaxed">{q.data.text || "Matn bo'sh."}</pre>}
            {q.data.url && <a href={q.data.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"><ExternalLink className="h-3.5 w-3.5" aria-hidden />Yangi oynada ochish</a>}
          </div>
        )}
    </div>
  );
}
