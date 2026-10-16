"use client";
import * as React from "react";
import Link from "next/link";
import { FileText, Search, Star, MessageSquare } from "lucide-react";
import { documents } from "@/lib/demo";
import { modules } from "@/lib/modules";
import { PageHeader } from "@/components/layout/page";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/states";

export default function Page() {
  const [q, setQ] = React.useState(""); const [fav, setFav] = React.useState<string[]>([]);
  const list = documents.filter((d) => d.name.toLowerCase().includes(q.toLowerCase()));
  return (
    <>
      <PageHeader module={modules[5]} title="BILIMXONA" description="Elektron kutubxona va manbali AI suhbat" demo actions={<><Button asChild variant="outline"><Link href="/bilimxona/suhbat">Hujjat bilan suhbat</Link></Button><Button asChild><Link href="/bilimxona/yuklash">Fayl yuklash</Link></Button></>} />
      <div className="relative mb-5 max-w-md"><Search className="absolute left-3.5 top-3.5 h-4 w-4 text-muted-foreground" aria-hidden /><Input className="pl-10" placeholder="Kutubxonadan qidirish" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Kutubxonadan qidirish" /></div>
      {list.length === 0 ? <EmptyState title="Fayl topilmadi" text="Boshqa so'z bilan qidiring yoki yangi fayl yuklang." /> :
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{list.map((d) => (
          <Card key={d.id} className="p-5">
            <div className="flex items-start gap-3"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#4F46E5]/10 text-[#4F46E5]"><FileText className="h-5 w-5" aria-hidden /></span>
              <div className="min-w-0 flex-1"><p className="truncate font-bold" title={d.name}>{d.name}</p><p className="text-sm text-muted-foreground">{d.size} · {d.pages} bet · {d.date}</p></div>
              <button aria-pressed={fav.includes(d.id)} aria-label="Sevimlilarga qo'shish" onClick={() => setFav((f) => f.includes(d.id) ? f.filter((x) => x !== d.id) : [...f, d.id])}><Star className={fav.includes(d.id) ? "h-5 w-5 fill-amber text-amber" : "h-5 w-5 text-muted-foreground"} /></button></div>
            <div className="mt-4 flex items-center justify-between"><Badge variant="neutral">{d.type}</Badge><Button asChild size="sm" variant="outline"><Link href="/bilimxona/suhbat"><MessageSquare className="h-4 w-4" />Suhbat</Link></Button></div>
          </Card>))}</div>}
    </>
  );
}
