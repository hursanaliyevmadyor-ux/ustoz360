"use client";
import * as React from "react";
import { Download } from "lucide-react";
import { adminModule } from "@/lib/modules";
import { useQuery } from "@/lib/use-query";
import { QueryView } from "@/components/layout/query-view";
import { PageHeader } from "@/components/layout/page";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/states";
import { Table, Td, Th } from "@/components/ui/table";

const TYPES = [
  { id: "users", t: "Foydalanuvchilar", d: "Ro'yxatdan o'tganlar, rollar, bloklanganlar" },
  { id: "payments", t: "To'lovlar", d: "Buyurtmalar, summalar, holatlar" },
  { id: "courses", t: "Kurslar", d: "Mualliflar, narx, holat, sotuv soni" },
  { id: "tests", t: "Test faolligi", d: "Boshlangan testlar, rejim, ball" },
  { id: "ai", t: "AI so'rovlari", d: "Model, token, kechikish, narx (matnsiz)" },
];
type Rep = { title: string; columns: { key: string; label: string }[]; rows: Record<string, unknown>[]; total: number };
const cell = (v: unknown) => (v == null ? "—" : typeof v === "string" && /^\d{4}-\d\d-\d\dT/.test(v) ? new Date(v).toLocaleString("ru-RU", { dateStyle: "short", timeStyle: "short" }) : String(v));

export default function Page() {
  const [type, setType] = React.useState("users");
  const q = useQuery<Rep>(`/api/admin/reports?type=${type}&format=json`);
  return (
    <>
      <PageHeader module={adminModule} title="Hisobotlar" description="Haqiqiy ma'lumotlar: ko'rib chiqing va CSV sifatida yuklab oling" />
      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {TYPES.map((x) => (
          <button key={x.id} onClick={() => setType(x.id)} aria-pressed={type === x.id}
            className={`min-h-11 rounded-2xl border p-4 text-left transition ${type === x.id ? "border-primary bg-primary/5" : "border-border bg-card hover:border-primary/50"}`}>
            <p className="font-bold">{x.t}</p><p className="mt-0.5 text-xs text-muted-foreground">{x.d}</p>
          </button>))}
      </div>
      <Card>
        <CardHeader><CardTitle>{TYPES.find((x) => x.id === type)?.t}</CardTitle>
          <Button asChild size="sm" variant="outline"><a href={`/api/admin/reports?type=${type}&format=csv`} download><Download className="h-4 w-4" />CSV yuklab olish</a></Button></CardHeader>
        <CardContent className="px-0">
          <QueryView q={q}>{(d) => d.rows.length === 0 ? <div className="px-5"><EmptyState title="Ma'lumot yo'q" text="Bu hisobot uchun hali yozuv yo'q." /></div> : (
            <>
              <Table><thead><tr>{d.columns.map((c) => <Th key={c.key}>{c.label}</Th>)}</tr></thead><tbody>
                {d.rows.slice(0, 50).map((r, i) => <tr key={i}>{d.columns.map((c) => <Td key={c.key}>{cell(r[c.key])}</Td>)}</tr>)}
              </tbody></Table>
              <p className="px-5 pt-3 text-xs text-muted-foreground">Ko'rsatilgan: {Math.min(50, d.rows.length)} / {d.total}. To'liq ro'yxat CSV faylda.</p>
            </>)}</QueryView>
        </CardContent>
      </Card>
    </>
  );
}
