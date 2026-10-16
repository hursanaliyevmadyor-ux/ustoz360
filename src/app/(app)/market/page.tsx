"use client";
import * as React from "react";
import Link from "next/link";
import { Search, Star } from "lucide-react";
import { courses, fmt } from "@/lib/demo";
import { modules } from "@/lib/modules";
import { PageHeader } from "@/components/layout/page";
import { Card } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/form";
import { Badge, DemoBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";

export default function Page() {
  const [q, setQ] = React.useState(""); const [sub, setSub] = React.useState(""); const [sort, setSort] = React.useState("");
  const toast = useToast();
  const list = courses.filter((c) => c.title.toLowerCase().includes(q.toLowerCase()) && (!sub || c.subject === sub))
    .sort((a, b) => sort === "asc" ? a.price - b.price : sort === "desc" ? b.price - a.price : 0);
  return (
    <>
      <PageHeader module={modules[3]} title="USTOZ MARKET" description="Kurslar, elektron materiallar va mentorlik" demo
        actions={<><Button asChild variant="outline"><Link href="/market/mening-kurslarim">Kurslarim va xaridlar</Link></Button><Button asChild variant="outline"><Link href="/market/muallif">Muallif kabineti</Link></Button></>} />
      <div className="mb-5 grid gap-3 sm:grid-cols-[1fr_180px_180px]">
        <div className="relative"><Search className="absolute left-3.5 top-3.5 h-4 w-4 text-muted-foreground" aria-hidden /><Input className="pl-10" placeholder="Kurs qidirish" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Kurs qidirish" /></div>
        <Select value={sub} onChange={(e) => setSub(e.target.value)} aria-label="Fan"><option value="">Barcha fanlar</option><option>Umumiy</option><option>Matematika</option><option>Ona tili</option></Select>
        <Select value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Saralash"><option value="">Saralash</option><option value="asc">Narx: arzon</option><option value="desc">Narx: qimmat</option></Select>
      </div>
      {list.length === 0 ? <EmptyState title="Kurs topilmadi" text="Qidiruv yoki filtrni o'zgartirib ko'ring." /> :
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {list.map((c) => (
            <Card key={c.id} className="flex flex-col overflow-hidden">
              <div className="grid h-28 place-items-center bg-gradient-to-br from-[#7C3AED]/15 to-primary/10"><Badge variant="blue">{c.tag}</Badge></div>
              <div className="flex flex-1 flex-col p-5">
                <p className="font-extrabold leading-snug">{c.title}</p><p className="mt-1 text-sm text-muted-foreground">{c.author} <DemoBadge /></p>
                <p className="mt-2 flex items-center gap-1 text-sm"><Star className="h-4 w-4 fill-amber text-amber" aria-hidden />{c.rating}{c.lessons > 0 && <span className="text-muted-foreground"> · {c.lessons} dars</span>}</p>
                <div className="mt-auto flex items-center justify-between pt-4"><b>{fmt(c.price)}</b>
                  <Button size="sm" onClick={() => toast("info", "To'lov tizimi ulanmagan, xarid amalga oshmaydi.")}>Sotib olish</Button></div>
              </div>
            </Card>))}
        </div>}
    </>
  );
}
