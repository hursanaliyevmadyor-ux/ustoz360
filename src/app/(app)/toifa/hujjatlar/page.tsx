"use client";
import * as React from "react";
import { ExternalLink, Plus, Trash2 } from "lucide-react";
import { modules } from "@/lib/modules";
import { api } from "@/lib/admin-client";
import { cn } from "@/lib/utils";
import { useQuery } from "@/lib/use-query";
import { longDate, type ToifaState } from "@/components/toifa/views";
import { QueryView } from "@/components/layout/query-view";
import { PageHeader } from "@/components/layout/page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/form";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/components/ui/toast";

export default function Page() {
  const toast = useToast();
  const q = useQuery<ToifaState>("/api/toifa");
  const [label, setLabel] = React.useState("");
  const call = async (p: Promise<{ ok: boolean; error?: string }>) => { const r = await p; if (!r.ok) toast("error", (r as { error: string }).error); else q.reload(); return r.ok; };
  const add = async (e: React.FormEvent) => { e.preventDefault(); if (!label.trim()) return; if (await call(api("/api/toifa/checklist", "POST", { label: label.trim() }))) setLabel(""); };
  return (
    <>
      <PageHeader module={modules[2]} title="Hujjatlar" description="Shaxsiy cheklist va rasmiy ma'lumotlar manbasi" />
      <QueryView q={q}>{(s) => {
        const done = s.checklist.filter((c) => c.done).length;
        return (
          <div className="grid gap-6 lg:grid-cols-2">
            <Card><CardHeader><div><CardTitle>Hujjatlar cheklisti</CardTitle><CardDescription>{s.checklist.length ? `${done}/${s.checklist.length} tayyor.` : "Hozircha bo'sh."} Hujjat yuklash shart emas: bu faqat eslatma.</CardDescription></div></CardHeader>
              <CardContent className="space-y-2">
                {s.checklist.length > 0 && <Progress value={(done / s.checklist.length) * 100} barClass="bg-teal" label="Cheklist" />}
                {s.checklist.length === 0 && (
                  <div className="rounded-xl border border-dashed border-border p-5 text-sm text-muted-foreground">
                    <p>O'zingizga kerak bandlarni qo'shing. Yoki umumiy namunani oling (u rasmiy ro'yxat emas: rasmiy talablarni o'ng tomondagi manbadan tekshiring).</p>
                    <Button className="mt-3" size="sm" variant="outline" onClick={() => call(api("/api/toifa/checklist", "POST", { seed: true }))}>Umumiy namunani qo'shish</Button>
                  </div>)}
                {s.checklist.map((c) => (
                  <div key={c.id} className="flex items-center gap-3 rounded-xl border border-border p-3 text-sm font-semibold hover:bg-muted/50">
                    <label className="flex min-h-9 min-w-0 flex-1 cursor-pointer items-center gap-3">
                      <input type="checkbox" className="h-5 w-5 shrink-0 accent-[#0D9488]" checked={c.done} onChange={() => call(api(`/api/toifa/checklist/${c.id}`, "PATCH", { done: !c.done }))} />
                      <span className={cn("min-w-0", c.done && "line-through opacity-60")}>{c.label}</span></label>
                    <button aria-label={`O'chirish: ${c.label}`} className="grid h-9 w-9 shrink-0 place-items-center" onClick={() => call(api(`/api/toifa/checklist/${c.id}`, "DELETE"))}><Trash2 className="h-4 w-4 text-danger" /></button>
                  </div>))}
                <form onSubmit={add} className="flex gap-2 pt-1"><Input value={label} maxLength={160} onChange={(e) => setLabel(e.target.value)} placeholder="Yangi band" aria-label="Yangi band" /><Button type="submit" size="icon" aria-label="Qo'shish"><Plus className="h-4 w-4" /></Button></form>
              </CardContent></Card>
            <Card><CardHeader><div><CardTitle>Rasmiy ma'lumotlar</CardTitle><CardDescription>Administrator manba bilan kiritadi. «Tekshirilmagan» belgisi bor ma'lumotga ishonishdan oldin manbadan tasdiqlang</CardDescription></div></CardHeader>
              <CardContent className="space-y-3">
                {s.official.length === 0 && <p className="rounded-xl border border-dashed border-border p-5 text-sm text-muted-foreground">Hozircha rasmiy havola yoki sana kiritilmagan. Rasmiy ma'lumotni taxmin qilmaymiz: administrator manba bilan kiritgach shu yerda ko'rinadi.</p>}
                {s.official.map((o) => (
                  <div key={o.id} className="rounded-xl border border-border p-4">
                    <div className="flex flex-wrap items-center gap-2"><p className="font-bold">{o.title}</p>
                      <Badge variant={o.verified ? "success" : "amber"}>{o.verified ? "Tekshirilgan" : "Tekshirilmagan"}</Badge></div>
                    {o.date && <p className="mt-1 text-sm">Sana: <b>{longDate(o.date)}</b></p>}
                    {o.note && <p className="mt-1 text-sm text-muted-foreground">{o.note}</p>}
                    <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                      {o.sourceName ? <span>Manba: {o.sourceName}</span> : <span>Manba ko'rsatilmagan</span>}
                      {o.verifiedAt && <span>Tekshirilgan: {longDate(o.verifiedAt.slice(0, 10))}</span>}
                      {o.url && <a href={o.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-semibold text-primary"><ExternalLink className="h-3.5 w-3.5" />Manbani ochish</a>}
                    </p>
                  </div>))}
              </CardContent></Card>
          </div>);
      }}</QueryView>
    </>
  );
}
