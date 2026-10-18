"use client";
import * as React from "react";
import { adminModule } from "@/lib/modules";
import { cn } from "@/lib/utils";
import { useQuery } from "@/lib/use-query";
import { QueryView } from "@/components/layout/query-view";
import { PageHeader } from "@/components/layout/page";
import { BarChart } from "@/components/charts/charts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, Td, Th } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/states";
import type { Section } from "@/server/adminsections";

const TABS = [
  ["users", "Ustozlar"], ["admins", "Adminlar"], ["ustoz-ai", "USTOZ AI"], ["darsyor", "DARSYOR"], ["toifa", "TOIFA"],
  ["sinf", "SINF"], ["market", "MARKET"], ["bilimxona", "BILIMXONA"], ["ai", "AI"], ["seminarlar", "Seminarlar"],
] as const;
const RANGES = [7, 30, 90] as const;

function View({ s }: { s: Section }) {
  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">{s.description}</p>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {s.kpis.map((k) => (
          <Card key={k.label} className="p-4"><p className="text-sm text-muted-foreground">{k.label}</p><p className="mt-1 break-words text-xl font-extrabold leading-tight sm:text-2xl">{k.value}</p>{k.hint && <p className="mt-0.5 text-xs text-muted-foreground">{k.hint}</p>}</Card>))}
      </div>
      {s.series.map((x) => (
        <Card key={x.title}><CardHeader><CardTitle>{x.title}</CardTitle></CardHeader><CardContent>
          {x.data.every((v) => v === 0) ? <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">Bu davrda ma'lumot yo'q.</p>
            : <BarChart data={[x.data]} labels={x.labels.length > 14 ? x.labels.map((l, i) => (i % Math.ceil(x.labels.length / 8) === 0 ? l : " ")) : x.labels} colors={["#2563EB"]} />}
        </CardContent></Card>))}
      <div className="grid gap-6 xl:grid-cols-2">
        {s.tables.map((t) => (
          <Card key={t.title}><CardHeader><CardTitle>{t.title}</CardTitle></CardHeader><CardContent className="px-0">
            {t.rows.length === 0 ? <p className="px-5 text-sm text-muted-foreground">Ma'lumot yo'q.</p> : (
              <Table><thead><tr>{t.columns.map((c) => <Th key={c}>{c}</Th>)}</tr></thead><tbody>
                {t.rows.map((r, i) => <tr key={i}>{r.map((v, j) => <Td key={j} className={j === 0 ? "font-semibold" : undefined}>{v}</Td>)}</tr>)}
              </tbody></Table>)}
          </CardContent></Card>))}
      </div>
      {s.note && <p className="rounded-xl bg-muted px-4 py-3 text-sm">{s.note}</p>}
    </div>
  );
}

export default function Page() {
  const [tab, setTab] = React.useState<(typeof TABS)[number][0]>("users");
  const [days, setDays] = React.useState<number>(30);
  React.useEffect(() => { const t = new URLSearchParams(window.location.search).get("tab"); if (t && TABS.some((x) => x[0] === t)) setTab(t as typeof tab); }, []);
  const q = useQuery<Section>(`/api/admin/stats/section?name=${tab}&days=${days}`);
  return (
    <>
      <PageHeader module={adminModule} title="Statistika" description="Yo'nalishlar, adminlar va ustozlar bo'yicha alohida. Faqat yig'ma raqamlar, shaxsiy ma'lumotsiz"
        actions={<div className="flex gap-1 rounded-xl bg-muted p-1" role="group" aria-label="Davr">{RANGES.map((r) => <button key={r} aria-pressed={days === r} onClick={() => setDays(r)} className={cn("min-h-9 rounded-lg px-3 text-sm font-semibold", days === r ? "bg-card shadow-soft" : "text-muted-foreground")}>{r} kun</button>)}</div>} />
      <div className="-mx-1 mb-6 overflow-x-auto px-1"><div className="inline-flex gap-1 rounded-xl bg-muted p-1" role="tablist" aria-label="Yo'nalishlar">
        {TABS.map(([k, l]) => <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={cn("min-h-9 whitespace-nowrap rounded-lg px-3.5 py-1.5 text-sm font-semibold", tab === k ? "bg-card shadow-soft" : "text-muted-foreground hover:text-foreground")}>{l}</button>)}
      </div></div>
      <QueryView q={q} skeleton={<div className="space-y-4"><div className="grid grid-cols-2 gap-4 lg:grid-cols-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-24" />)}</div><Skeleton className="h-48" /></div>}>{(s) => <View s={s} />}</QueryView>
    </>
  );
}
