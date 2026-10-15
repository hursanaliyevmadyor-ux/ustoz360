"use client";
import * as React from "react";
import { ExternalLink } from "lucide-react";
import { checklist, officialLinks } from "@/lib/demo";
import { modules } from "@/lib/modules";
import { PageHeader } from "@/components/layout/page";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { DemoBadge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { NoBackendNote } from "@/components/ui/states";

export default function Page() {
  const [done, setDone] = React.useState(checklist.filter((c) => c.done).map((c) => c.id));
  return (
    <>
      <PageHeader module={modules[2]} title="Hujjatlar" description="Cheklist va rasmiy ma'lumotlar" />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card><CardHeader><div><CardTitle>Hujjatlar cheklisti <DemoBadge /></CardTitle><CardDescription>{done.length}/{checklist.length} tayyor. Hujjat yuklash shart emas.</CardDescription></div></CardHeader>
          <CardContent className="space-y-2"><Progress value={(done.length / checklist.length) * 100} barClass="bg-teal" label="Cheklist" />
            {checklist.map((c) => <label key={c.id} className="flex cursor-pointer items-center gap-3 rounded-xl border border-border p-3 text-sm font-semibold hover:bg-muted">
              <input type="checkbox" className="h-5 w-5 accent-[#0D9488]" checked={done.includes(c.id)} onChange={() => setDone((s) => s.includes(c.id) ? s.filter((x) => x !== c.id) : [...s, c.id])} />{c.t}</label>)}
          </CardContent></Card>
        <Card><CardHeader><div><CardTitle>Rasmiy ma'lumotlar</CardTitle><CardDescription>Har birida manba va tekshirilgan sana ko'rsatiladi</CardDescription></div></CardHeader>
          <CardContent className="space-y-3">{officialLinks.map((l) => (
            <div key={l.title} className="rounded-xl border border-border p-4"><p className="flex items-center gap-2 font-bold">{l.title}<DemoBadge /></p>
              <p className="mt-1 flex items-center gap-1 text-sm text-muted-foreground"><ExternalLink className="h-3.5 w-3.5" />{l.source} · Tekshirilgan: {l.checked}</p></div>))}
            <NoBackendNote>Rasmiy sanalar va havolalarni admin manba bilan kiritadi. Men ularni taxmin qilmayman.</NoBackendNote></CardContent></Card>
      </div>
    </>
  );
}
