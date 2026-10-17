"use client";
import Link from "next/link";
import { FileText } from "lucide-react";
import { useQuery } from "@/lib/use-query";
import { DOC_LABEL, type DocKind } from "@/server/docsvalid";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { DocRow } from "./store";

const HREF: Record<DocKind, (id: string) => string> = {
  lesson_plan: (id) => `/darsyor/dars-ishlanmasi?doc=${id}`,
  taskset: (id) => `/darsyor/test-generator?doc=${id}`,
  visual: (id) => `/darsyor/korgazma?doc=${id}`,
  rubric: (id) => `/darsyor/baholash?tab=rubrika&doc=${id}`,
  observation: (id) => `/darsyor/baholash?tab=kuzatuv&doc=${id}`,
};

/** DARSYOR bosh sahifasi: so'nggi saqlangan ishlar (kirmagan foydalanuvchiga ko'rsatilmaydi). */
export function RecentDocs() {
  const q = useQuery<{ docs: DocRow[] }>("/api/docs?limit=6");
  if (q.status === 401 || (q.loading && !q.data) || q.error || !q.data) return null;
  return (
    <Card className="mt-8"><CardHeader><CardTitle>So'nggi ishlarim</CardTitle></CardHeader><CardContent>
      {q.data.docs.length === 0 ? <p className="text-sm text-muted-foreground">Saqlangan ishlaringiz shu yerda ko'rinadi.</p> : (
        <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{q.data.docs.map((d) => (
          <li key={d.id}><Link href={HREF[d.kind](d.id)} className="flex min-h-14 items-center gap-3 rounded-xl border border-border p-3 hover:border-primary/40 hover:bg-muted">
            <FileText className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
            <span className="min-w-0"><span className="block truncate text-sm font-semibold">{d.title}</span><span className="block text-xs text-muted-foreground">{DOC_LABEL[d.kind]}{d.status === "DRAFT" ? " · qoralama" : ""} · {new Date(d.updatedAt).toLocaleDateString("ru-RU")}</span></span>
          </Link></li>))}</ul>)}
    </CardContent></Card>
  );
}
