"use client";
import * as React from "react";
import { FileText, Trash2 } from "lucide-react";
import { api } from "@/lib/admin-client";
import { useQuery, type Query } from "@/lib/use-query";
import { cn } from "@/lib/utils";
import type { DocKind } from "@/server/docsvalid";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";

export type DocRow = { id: string; kind: DocKind; title: string; subject: string | null; grade: string | null; status: "DRAFT" | "SAVED"; updatedAt: string };
export type DocFull<T> = DocRow & { data: T };

export const useDocList = (kind: DocKind): Query<{ docs: DocRow[] }> => useQuery<{ docs: DocRow[] }>(`/api/docs?kind=${kind}`);

export type SaveInput = { kind: DocKind; title: string; subject?: string; grade?: string; status: "DRAFT" | "SAVED"; data: unknown };
/** Yaratadi (id yo'q) yoki yangilaydi. Xato matnini qaytaradi. */
export async function persistDoc(input: SaveInput, id?: string | null) {
  return id ? api<{ id: string }>(`/api/docs/${id}`, "PUT", input) : api<{ id: string }>("/api/docs", "POST", input);
}
export const loadDoc = <T,>(id: string) => api<DocFull<T>>(`/api/docs/${id}`);

const when = (iso: string) => new Date(iso).toLocaleString("ru-RU", { dateStyle: "short", timeStyle: "short" });

/** Saqlangan hujjatlar ro'yxati (tarix): ochish va o'chirish. */
export function DocList({ list, activeId, onOpen, onDeleted, title = "Saqlanganlar", empty = "Hali saqlangan ish yo'q." }: { list: Query<{ docs: DocRow[] }>; activeId?: string | null; onOpen: (id: string) => void; onDeleted?: (id: string) => void; title?: string; empty?: string }) {
  const toast = useToast();
  const remove = async (d: DocRow) => {
    if (!window.confirm(`«${d.title}» o'chirilsinmi?`)) return;
    const r = await api(`/api/docs/${d.id}`, "DELETE");
    if (!r.ok) { toast("error", r.error); return; }
    toast("success", "O'chirildi."); onDeleted?.(d.id); list.reload();
  };
  return (
    <Card className="no-print"><CardHeader><CardTitle>{title}</CardTitle></CardHeader><CardContent className="space-y-2">
      {list.loading && !list.data && <p className="text-sm text-muted-foreground">Yuklanmoqda...</p>}
      {list.status === 401 && <p className="text-sm text-muted-foreground">Saqlash uchun tizimga kiring.</p>}
      {list.error && list.status !== 401 && <p role="alert" className="text-sm text-danger">{list.error} <button className="font-semibold underline" onClick={list.reload}>Qayta urinish</button></p>}
      {list.data && list.data.docs.length === 0 && <p className="text-sm text-muted-foreground">{empty}</p>}
      {list.data?.docs.map((d) => (
        <div key={d.id} className={cn("flex items-center gap-2 rounded-xl border border-border p-2.5", activeId === d.id && "border-primary bg-primary/5")}>
          <button className="flex min-h-11 min-w-0 flex-1 items-center gap-2.5 text-left" onClick={() => onOpen(d.id)} aria-label={`Ochish: ${d.title}`}>
            <FileText className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
            <span className="min-w-0"><span className="block truncate text-sm font-semibold">{d.title}</span>
              <span className="block text-xs text-muted-foreground">{when(d.updatedAt)}{d.grade ? ` · ${d.grade}-sinf` : ""}</span></span>
          </button>
          {d.status === "DRAFT" && <Badge variant="amber">Qoralama</Badge>}
          <Button variant="ghost" size="icon" aria-label="O'chirish" onClick={() => remove(d)}><Trash2 className="h-4 w-4 text-danger" /></Button>
        </div>))}
    </CardContent></Card>
  );
}
