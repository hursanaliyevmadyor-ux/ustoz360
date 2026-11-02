"use client";
import * as React from "react";
import { Copy, Eye, EyeOff } from "lucide-react";
import { useQuery } from "@/lib/use-query";
import { persistDoc } from "@/components/darsyor/store";
import { Render, TEMPLATES, type Visual } from "@/components/darsyor/visuals";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";

type CatalogRow = { id: string; kind: string; title: string; subject: string | null; grade: string | null; data: Visual };

/** Tayyor ko'rgazmalar katalogi: ko'rish va o'z nusxasini «Mening ko'rgazmalarim»ga qoralama qilib olish. Katalogga admin qo'shadi. */
export function Catalog({ onCopied }: { onCopied: (id: string) => void }) {
  const toast = useToast();
  const q = useQuery<{ docs: CatalogRow[] }>("/api/docs/catalog?kind=visual");
  const [subject, setSubject] = React.useState("");
  const [openId, setOpenId] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState<string | null>(null);
  const docs = q.data?.docs ?? [];
  const subjects = [...new Set(docs.map((d) => d.subject).filter((s): s is string => Boolean(s)))];
  const shown = subject ? docs.filter((d) => d.subject === subject) : docs;

  const copy = async (d: CatalogRow) => {
    setBusy(d.id);
    const r = await persistDoc({ kind: "visual", title: d.title, subject: d.subject ?? undefined, grade: d.grade ?? undefined, status: "DRAFT", data: d.data });
    setBusy(null);
    if (!r.ok) { toast("error", r.error); return; }
    toast("success", "Nusxa «Mening ko'rgazmalarim»ga qoralama bo'lib qo'shildi."); onCopied(r.data.id);
  };

  if (q.loading && !q.data) return <p className="text-sm text-muted-foreground">Tayyor ko'rgazmalar yuklanmoqda...</p>;
  if (q.status === 401) return <p className="text-sm text-muted-foreground">Tayyor ko'rgazmalarni ko'rish uchun tizimga kiring.</p>;
  if (q.error) return <p role="alert" className="text-sm text-danger">{q.error} <button className="font-semibold underline" onClick={q.reload}>Qayta urinish</button></p>;
  if (docs.length === 0) return null;

  return (
    <section className="no-print space-y-4" aria-labelledby="katalog-sarlavha">
      <div>
        <h2 id="katalog-sarlavha" className="text-lg font-extrabold">Tayyor ko'rgazmalar ({docs.length})</h2>
        <p className="text-sm text-muted-foreground">Ko'rib chiqing va nusxa oling: nusxa sizniki bo'ladi, uni o'zgartirishingiz mumkin. Metodist ko'rigidan o'tmagan qoralamalar, darslik bilan solishtirib ishlating.</p>
      </div>
      {subjects.length > 1 && (
        <div className="flex flex-wrap gap-2" role="group" aria-label="Fan bo'yicha saralash">
          <Button size="sm" variant={subject === "" ? "primary" : "outline"} aria-pressed={subject === ""} onClick={() => setSubject("")}>Hammasi</Button>
          {subjects.map((s) => <Button key={s} size="sm" variant={subject === s ? "primary" : "outline"} aria-pressed={subject === s} onClick={() => setSubject(s)}>{s}</Button>)}
        </div>)}
      <div className="grid gap-3 sm:grid-cols-2">
        {shown.map((d) => {
          const meta = TEMPLATES.find((t) => t.key === d.data.template);
          const open = openId === d.id;
          return (
            <article key={d.id} className={`rounded-2xl border border-border bg-card p-4 shadow-soft ${open ? "sm:col-span-2" : ""}`}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0"><h3 className="font-extrabold">{d.title}</h3>
                  <p className="mt-0.5 text-xs text-muted-foreground">{[d.subject, d.grade ? `${d.grade}-sinf` : null, meta?.title].filter(Boolean).join(" · ")}</p></div>
                <Badge variant="amber">Tekshirilmagan qoralama</Badge>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button size="sm" variant="outline" aria-expanded={open} onClick={() => setOpenId(open ? null : d.id)}>{open ? <><EyeOff className="h-4 w-4" aria-hidden />Yopish</> : <><Eye className="h-4 w-4" aria-hidden />Ko'rish</>}</Button>
                <Button size="sm" loading={busy === d.id} onClick={() => copy(d)}><Copy className="h-4 w-4" aria-hidden />Nusxa olib tahrirlash</Button>
              </div>
              {open && <div className="mt-3 overflow-x-auto rounded-lg border border-border bg-white p-3 text-neutral-900"><div className="min-w-[320px]"><Render v={d.data} title={d.title} /></div></div>}
            </article>);
        })}
      </div>
    </section>
  );
}
