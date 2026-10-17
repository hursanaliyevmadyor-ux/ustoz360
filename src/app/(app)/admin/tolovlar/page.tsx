"use client";
import * as React from "react";
import { adminModule } from "@/lib/modules";
import { api } from "@/lib/admin-client";
import { fmtUzs } from "@/lib/plans";
import { useQuery } from "@/lib/use-query";
import { QueryView } from "@/components/layout/query-view";
import { PageHeader, StatCard } from "@/components/layout/page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select } from "@/components/ui/form";
import { EmptyState } from "@/components/ui/states";
import { Table, Td, Th } from "@/components/ui/table";
import { useToast } from "@/components/ui/toast";
import { Wallet, Clock, Undo2 } from "lucide-react";

type P = { id: string; user: string; title: string; amount: number; reference: string; status: string; provider: string; createdAt: string; paidAt: string | null };
type Data = { payments: P[]; totals: Record<string, { count: number; amount: number }>; provider: { providers: { id: string; name: string; ready: boolean; note?: string }[] } };
const ST: Record<string, { t: string; v: "success" | "amber" | "danger" | "neutral" | "blue" }> = {
  PENDING: { t: "Kutilmoqda", v: "amber" }, PAID: { t: "To'langan", v: "success" }, FAILED: { t: "Muvaffaqiyatsiz", v: "danger" }, CANCELED: { t: "Bekor qilingan", v: "neutral" }, REFUNDED: { t: "Qaytarilgan", v: "blue" },
};
const when = (iso: string) => new Date(iso).toLocaleString("ru-RU", { dateStyle: "short", timeStyle: "short" });

export default function Page() {
  const toast = useToast();
  const [status, setStatus] = React.useState("");
  const q = useQuery<Data>(`/api/admin/payments${status ? `?status=${status}` : ""}`);
  const [busy, setBusy] = React.useState("");
  const act = async (p: P, action: "confirm" | "cancel" | "refund", ok: string, ask?: string) => {
    if (ask && !window.confirm(ask)) return;
    setBusy(p.id);
    const r = await api(`/api/admin/payments/${p.id}`, "PATCH", { action });
    setBusy("");
    if (!r.ok) { toast("error", r.error); return; }
    toast("success", ok); q.reload();
  };
  return (
    <>
      <PageHeader module={adminModule} title="To'lovlar" description="Buyurtmalar va to'lovlar. Kirish faqat tasdiqlangan to'lovdan keyin beriladi" />
      <QueryView q={q}>{(d) => (
        <>
          <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-3">
            <StatCard label="To'langan" value={fmtUzs(d.totals.PAID?.amount ?? 0)} delta={`${d.totals.PAID?.count ?? 0} ta`} icon={Wallet} tone="teal" />
            <StatCard label="Kutilmoqda" value={String(d.totals.PENDING?.count ?? 0)} delta={fmtUzs(d.totals.PENDING?.amount ?? 0)} icon={Clock} tone="amber" />
            <StatCard label="Qaytarilgan" value={String(d.totals.REFUNDED?.count ?? 0)} icon={Undo2} tone="violet" />
          </div>
          <Card className="mb-6 p-4"><p className="mb-2 text-sm font-bold">To'lov usullari</p>
            <ul className="grid gap-2 sm:grid-cols-2">{d.provider.providers.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-3 rounded-xl border border-border px-3 py-2 text-sm">
                <span>{p.name}{p.note && <span className="block text-xs text-muted-foreground">{p.note}</span>}</span>
                <Badge variant={p.ready ? "success" : "neutral"}>{p.ready ? "Tayyor" : "Ulanmagan"}</Badge>
              </li>))}</ul>
            <p className="mt-2 text-xs text-muted-foreground">To'lov rejimi va ko'rsatma «Sozlamalar → To'lov» bo'limida. Kalitlar bu yerda ko'rsatilmaydi.</p>
          </Card>
          <Card>
            <div className="p-4"><Select className="w-56" value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Holat"><option value="">Barcha holatlar</option>{Object.entries(ST).map(([k, v]) => <option key={k} value={k}>{v.t}</option>)}</Select></div>
            {d.payments.length === 0 ? <div className="p-4 pt-0"><EmptyState title="To'lov yo'q" text="Foydalanuvchilar kurs yoki tarif buyurtma qilganda shu yerda ko'rinadi." /></div> : (
              <Table><thead><tr><Th>Sana</Th><Th>Kod</Th><Th>Foydalanuvchi</Th><Th>Nima uchun</Th><Th>Summa</Th><Th>Holat</Th><Th><span className="sr-only">Amallar</span></Th></tr></thead><tbody>
                {d.payments.map((p) => (
                  <tr key={p.id}>
                    <Td className="whitespace-nowrap">{when(p.createdAt)}</Td><Td className="font-mono text-xs">{p.reference}</Td><Td>{p.user}</Td><Td>{p.title}</Td>
                    <Td className="whitespace-nowrap">{fmtUzs(p.amount)}</Td>
                    <Td><Badge variant={ST[p.status]?.v}>{ST[p.status]?.t ?? p.status}</Badge></Td>
                    <Td className="whitespace-nowrap text-right">
                      {p.status === "PENDING" && <>
                        <Button size="sm" variant="success" loading={busy === p.id} onClick={() => act(p, "confirm", "To'lov tasdiqlandi, kirish ochildi.", `${p.reference}: ${fmtUzs(p.amount)} haqiqatan tushganini tekshirdingizmi?`)}>Tasdiqlash</Button>{" "}
                        <Button size="sm" variant="outline" onClick={() => act(p, "cancel", "Buyurtma bekor qilindi.")}>Bekor</Button></>}
                      {p.status === "PAID" && <Button size="sm" variant="outline" loading={busy === p.id} onClick={() => act(p, "refund", "To'lov qaytarildi, kirish yopildi.", "Kirish olib tashlanadi. Pul bank/provayder orqali alohida qaytariladi. Davom etasizmi?")}>Qaytarish</Button>}
                    </Td>
                  </tr>))}
              </tbody></Table>)}
          </Card>
        </>)}</QueryView>
    </>
  );
}
