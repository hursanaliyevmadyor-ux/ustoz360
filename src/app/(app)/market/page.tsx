"use client";
import * as React from "react";
import Link from "next/link";
import { Search, CheckCircle2 } from "lucide-react";
import { fmtUzs } from "@/lib/plans";
import { modules } from "@/lib/modules";
import { useQuery } from "@/lib/use-query";
import { OrderButton } from "@/components/market/order";
import { QueryView } from "@/components/layout/query-view";
import { PageHeader } from "@/components/layout/page";
import { Card } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/states";

type C = { id: string; title: string; description: string; subject: string; kind: string; priceUzs: number; lessonCount: number; author: string; owned: boolean };
type Data = { courses: C[]; subjects: string[]; paymentsMode: "off" | "manual" | "provider"; loggedIn: boolean };

export default function Page() {
  const [q, setQ] = React.useState(""); const [term, setTerm] = React.useState(""); const [sub, setSub] = React.useState(""); const [sort, setSort] = React.useState("");
  React.useEffect(() => { const t = setTimeout(() => setTerm(q.trim()), 350); return () => clearTimeout(t); }, [q]);
  const data = useQuery<Data>(`/api/market/catalog?${new URLSearchParams({ ...(term && { q: term }), ...(sub && { subject: sub }), ...(sort && { sort }) })}`);
  return (
    <>
      <PageHeader module={modules[3]} title="USTOZ MARKET" description="Mualliflar tayyorlagan kurslar va elektron materiallar"
        actions={<><Button asChild variant="outline"><Link href="/market/mening-kurslarim">Kurslarim va xaridlar</Link></Button><Button asChild variant="outline"><Link href="/market/muallif">Muallif kabineti</Link></Button></>} />
      <div className="mb-5 grid gap-3 sm:grid-cols-[1fr_180px_180px]">
        <div className="relative"><Search className="absolute left-3.5 top-3.5 h-4 w-4 text-muted-foreground" aria-hidden /><Input className="pl-10" placeholder="Kurs qidirish" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Kurs qidirish" /></div>
        <Select value={sub} onChange={(e) => setSub(e.target.value)} aria-label="Fan"><option value="">Barcha fanlar</option>{(data.data?.subjects ?? []).map((s) => <option key={s}>{s}</option>)}</Select>
        <Select value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Saralash"><option value="">Yangilari</option><option value="asc">Narx: arzon</option><option value="desc">Narx: qimmat</option></Select>
      </div>
      <QueryView q={data}>{(d) => (
        <>
          {d.paymentsMode === "off" && <p className="mb-4 rounded-xl bg-amber/10 px-3.5 py-2.5 text-sm">To'lov tizimi hozircha ulanmagan: kurslarni ko'rish mumkin, sotib olish tez orada ochiladi. Bepul kurslar darhol ochiladi.</p>}
          {d.courses.length === 0 ? (
            <EmptyState title={term || sub ? "Kurs topilmadi" : "Hali kurs qo'shilmagan"} text={term || sub ? "Qidiruv yoki filtrni o'zgartirib ko'ring." : "Mualliflar kurslarini yuborgach va administrator tasdiqlagach, ular shu yerda paydo bo'ladi."}
              action={!term && !sub ? <Button asChild variant="outline"><Link href="/market/muallif">Muallif bo'lish</Link></Button> : undefined} />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {d.courses.map((c) => (
                <Card key={c.id} className="flex flex-col overflow-hidden">
                  <div className="grid h-24 place-items-center bg-gradient-to-br from-[#7C3AED]/15 to-primary/10"><Badge variant="blue">{c.kind}</Badge></div>
                  <div className="flex flex-1 flex-col p-5">
                    <p className="font-extrabold leading-snug">{c.title}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{c.author} · {c.subject}{c.lessonCount > 0 && ` · ${c.lessonCount} dars`}</p>
                    <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">{c.description}</p>
                    <div className="mt-auto flex items-center justify-between gap-3 pt-4"><b>{c.priceUzs ? fmtUzs(c.priceUzs) : "Bepul"}</b>
                      {c.owned ? <Button asChild size="sm" variant="outline"><Link href="/market/mening-kurslarim"><CheckCircle2 className="h-4 w-4 text-success" />Sizda bor</Link></Button>
                        : d.paymentsMode === "off" && c.priceUzs > 0 ? <Button size="sm" variant="outline" disabled>Tez orada</Button>
                        : <OrderButton size="sm" input={{ kind: "COURSE", courseId: c.id }} label={c.priceUzs ? "Sotib olish" : "Ochish"} onDone={data.reload} />}
                    </div>
                  </div>
                </Card>))}
            </div>)}
        </>)}</QueryView>
    </>
  );
}
