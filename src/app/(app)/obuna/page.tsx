"use client";
import * as React from "react";
import { Check } from "lucide-react";
import { PLAN_KEYS, PLANS, fmtUzs } from "@/lib/plans";
import { api } from "@/lib/admin-client";
import { useQuery } from "@/lib/use-query";
import { cn } from "@/lib/utils";
import { OrderButton } from "@/components/market/order";
import { useShell } from "@/components/layout/shell-context";
import { QueryView } from "@/components/layout/query-view";
import { PageHeader } from "@/components/layout/page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState, NoBackendNote } from "@/components/ui/states";
import { Table, Td, Th } from "@/components/ui/table";
import { useToast } from "@/components/ui/toast";

type P = { id: string; title: string; amount: number; reference: string; status: string; createdAt: string };
const ST: Record<string, { t: string; v: "success" | "amber" | "danger" | "neutral" | "blue" }> = {
  PENDING: { t: "Kutilmoqda", v: "amber" }, PAID: { t: "To'langan", v: "success" }, FAILED: { t: "Muvaffaqiyatsiz", v: "danger" }, CANCELED: { t: "Bekor qilingan", v: "neutral" }, REFUNDED: { t: "Qaytarilgan", v: "blue" },
};

export default function Page() {
  const { me, pub } = useShell();
  const toast = useToast();
  const hist = useQuery<{ payments: P[] }>(me ? "/api/market/purchases" : null);
  const mode = pub?.paymentsMode ?? "off";
  const cancel = async (id: string) => {
    const r = await api(`/api/market/orders/${id}`, "DELETE");
    if (!r.ok) { toast("error", r.error); return; }
    toast("success", "Buyurtma bekor qilindi."); hist.reload();
  };
  return (
    <>
      <PageHeader title="Obuna va to'lovlar" description="Narxlar sinov uchun belgilangan, yakuniy emas" />
      {mode === "off" && <div className="mb-4 max-w-2xl"><NoBackendNote>To'lov tizimi hozircha ulanmagan, shuning uchun tarifni o'zingiz sotib ola olmaysiz. Tarifni administrator qo'lda berishi mumkin{pub?.supportContact ? `: ${pub.supportContact}` : ""}.</NoBackendNote></div>}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{PLAN_KEYS.map((k) => {
        const p = PLANS[k]; const cur = me?.plan === k;
        return (
          <Card key={k} className={cn("flex flex-col p-5", cur && "ring-2 ring-primary")}>
            <div className="flex items-center justify-between"><p className="font-extrabold">{p.name}</p>{cur && <Badge variant="blue">Joriy</Badge>}</div>
            <p className="mt-2 text-3xl font-extrabold">{p.priceUzs === null ? "Kelishuv" : p.priceUzs === 0 ? "0" : fmtUzs(p.priceUzs).replace(" so'm", "")}{p.priceUzs ? <span className="text-sm font-semibold text-muted-foreground"> so'm/oy</span> : null}</p>
            <ul className="mt-4 flex-1 space-y-2 text-sm">{p.features.map((x) => <li key={x} className="flex gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden />{x}</li>)}</ul>
            <div className="mt-5">
              {cur ? <Button variant="secondary" className="w-full" disabled>Joriy tarif</Button>
                : p.priceUzs && p.priceUzs > 0
                  ? (me && mode !== "off" ? <OrderButton input={{ kind: "PLAN", planKey: k }} label="Tanlash" className="w-full" onDone={hist.reload} />
                    : <Button className="w-full" disabled>{me ? "Hozircha mavjud emas" : "Kirish kerak"}</Button>)
                  : <Button variant="outline" className="w-full" disabled>{k === "FREE" ? "Asosiy tarif" : "Admin bilan kelishiladi"}</Button>}
            </div>
          </Card>);
      })}</div>
      {me && (
        <Card className="mt-6"><CardHeader><CardTitle>To'lov tarixi</CardTitle></CardHeader><CardContent className="px-0">
          <QueryView q={hist} skeleton={<p className="px-5 text-sm text-muted-foreground">Yuklanmoqda...</p>}>{(d) => d.payments.length === 0
            ? <div className="px-5"><EmptyState title="To'lovlar yo'q" text="Buyurtma bergach, uning holati shu yerda ko'rinadi." /></div>
            : <Table><thead><tr><Th>Sana</Th><Th>Nima uchun</Th><Th>Kod</Th><Th>Summa</Th><Th>Holat</Th><Th><span className="sr-only">Amal</span></Th></tr></thead><tbody>
              {d.payments.map((p) => (
                <tr key={p.id}><Td className="whitespace-nowrap">{new Date(p.createdAt).toLocaleDateString("ru-RU")}</Td><Td>{p.title}</Td><Td className="font-mono text-xs">{p.reference}</Td><Td className="whitespace-nowrap">{fmtUzs(p.amount)}</Td>
                  <Td><Badge variant={ST[p.status]?.v}>{ST[p.status]?.t ?? p.status}</Badge></Td>
                  <Td className="text-right">{p.status === "PENDING" && <Button size="sm" variant="outline" onClick={() => cancel(p.id)}>Bekor qilish</Button>}</Td></tr>))}
            </tbody></Table>}</QueryView>
        </CardContent></Card>)}
    </>
  );
}
