"use client";
import * as React from "react";
import { ArrowLeft, Download, FileDown, Printer, Save, Shapes } from "lucide-react";
import { modules } from "@/lib/modules";
import { downloadBlob, downloadDoc, safeName } from "@/lib/download";
import { PageHeader } from "@/components/layout/page";
import { DocList, loadDoc, persistDoc, useDocList } from "@/components/darsyor/store";
import { Editor, Render, starter, TEMPLATES, toHtml, type Template, type Visual } from "@/components/darsyor/visuals";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/form";
import { useToast } from "@/components/ui/toast";

export default function Page() {
  const toast = useToast();
  const list = useDocList("visual");
  const [v, setV] = React.useState<Visual | null>(null);
  const [title, setTitle] = React.useState("");
  const [docId, setDocId] = React.useState<string | null>(null);
  const [dirty, setDirty] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const svgRef = React.useRef<SVGSVGElement | HTMLDivElement>(null);
  const meta = v ? TEMPLATES.find((t) => t.key === v.template)! : null;

  const start = (t: Template) => { setV(starter(t)); setTitle(TEMPLATES.find((x) => x.key === t)!.title); setDocId(null); setDirty(false); };
  const back = () => { if (dirty && !window.confirm("Saqlanmagan o'zgarishlar yo'qoladi. Davom etasizmi?")) return; setV(null); setDocId(null); setDirty(false); };
  const change = (n: Visual) => { setV(n); setDirty(true); };

  const save = async (status: "DRAFT" | "SAVED") => {
    if (!v) return;
    setBusy(true);
    const r = await persistDoc({ kind: "visual", title: title.trim() || meta!.title, status, data: v }, docId);
    setBusy(false);
    if (!r.ok) { toast("error", r.status === 401 ? "Saqlash uchun tizimga kiring." : r.error); return; }
    setDocId(r.data.id); setDirty(false); list.reload(); toast("success", "Saqlandi.");
  };
  const open = async (id: string) => {
    if (dirty && !window.confirm("Saqlanmagan o'zgarishlar yo'qoladi. Davom etasizmi?")) return;
    const r = await loadDoc<Visual>(id);
    if (!r.ok) { toast("error", r.error); return; }
    setV(r.data.data); setTitle(r.data.title); setDocId(id); setDirty(false);
  };
  React.useEffect(() => { const id = new URLSearchParams(window.location.search).get("doc"); if (id) void open(id); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const svg = () => {
    const el = svgRef.current as SVGSVGElement | null;
    if (!el || el.tagName.toLowerCase() !== "svg") return;
    downloadBlob(`${safeName(title)}.svg`, '<?xml version="1.0" encoding="UTF-8"?>\n' + new XMLSerializer().serializeToString(el), "image/svg+xml;charset=utf-8");
  };

  return (
    <>
      <PageHeader module={modules[1]} title="Ko'rgazmali materiallar" description="Shablonni tanlang, to'ldiring, saqlang va chop eting" />
      {!v ? (
        <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {TEMPLATES.map((t) => (
              <button key={t.key} onClick={() => start(t.key)} className="group flex min-h-[150px] flex-col rounded-2xl border border-border bg-card p-5 text-left shadow-soft transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-pop">
                <span className="grid h-11 w-11 place-items-center rounded-xl bg-[#7C3AED]/10 text-[#7C3AED]"><Shapes className="h-5 w-5" aria-hidden /></span>
                <span className="mt-3 font-extrabold">{t.title}</span><span className="mt-1 text-sm text-muted-foreground">{t.desc}</span>
                <span className="mt-auto pt-3 text-sm font-bold text-primary">Ochish →</span>
              </button>))}
          </div>
          <DocList list={list} onOpen={open} title="Mening ko'rgazmalarim" empty="Hali saqlangan material yo'q." />
        </div>
      ) : (
        <div className="space-y-4">
          <div className="no-print flex flex-wrap items-center justify-between gap-3">
            <Button variant="ghost" onClick={back}><ArrowLeft className="h-4 w-4" />Shablonlar</Button>
            <div className="flex flex-wrap items-center gap-2">
              {dirty && <Badge variant="neutral">Saqlanmagan</Badge>}
              <Button size="sm" variant="outline" loading={busy} onClick={() => save("DRAFT")}>Qoralama</Button>
              <Button size="sm" loading={busy} onClick={() => save("SAVED")}><Save className="h-4 w-4" />Saqlash</Button>
              {meta?.svg
                ? <Button size="sm" variant="outline" onClick={svg}><Download className="h-4 w-4" />SVG</Button>
                : <Button size="sm" variant="outline" onClick={() => downloadDoc(`${safeName(title)}.doc`, title, toHtml(v, title))}><FileDown className="h-4 w-4" />Word</Button>}
              <Button size="sm" variant="outline" onClick={() => window.print()}><Printer className="h-4 w-4" />Chop etish / PDF</Button>
            </div>
          </div>
          <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
            <Card className="no-print"><CardHeader><CardTitle>{meta?.title}</CardTitle></CardHeader><CardContent className="space-y-4">
              <Field label="Material nomi"><Input value={title} maxLength={120} onChange={(e) => { setTitle(e.target.value); setDirty(true); }} /></Field>
              <Editor v={v} onChange={change} />
            </CardContent></Card>
            <Card className="print-area"><CardContent><Render ref={svgRef} v={v} title={title} /></CardContent></Card>
          </div>
        </div>
      )}
    </>
  );
}
