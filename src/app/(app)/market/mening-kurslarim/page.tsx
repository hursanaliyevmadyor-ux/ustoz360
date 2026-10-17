"use client";
import * as React from "react";
import Link from "next/link";
import { BookOpen, ExternalLink, Receipt } from "lucide-react";
import { api } from "@/lib/admin-client";
import { fmtUzs } from "@/lib/plans";
import { useQuery } from "@/lib/use-query";
import { QueryView } from "@/components/layout/query-view";
import { SectionHeader } from "@/components/layout/section-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/states";
import { Table, Td, Th } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/toast";

type Data = {
  payments: { id: string; title: string; amount: number; reference: string; status: string; createdAt: string }[];
  courses: { id: string; title: string; subject: string; kind: string; accessUrl: string | null; lessonCount: number; grantedAt: string }[];
};
const ST: Record<string, { t: string; v: "success" | "amber" | "danger" | "neutral" | "blue" }> = {
  PENDING: { t: "Kutilmoqda", v: "amber" }, PAID: { t: "To'langan", v: "success" }, FAILED: { t: "Muvaffaqiyatsiz", v: "danger" }, CANCELED: { t: "Bekor qilingan", v: "neutral" }, REFUNDED: { t: "Qaytarilgan", v: "blue" },
};

/** Sotib olingan kurslar va to'lov tarixi bitta bo'limda (faqat serverda tasdiqlangan to'lovdan keyin kirish ochiladi). */
export default function Page() {
  const toast = useToast();
  const q = useQuery<Data>("/api/market/purchases");
  const cancel = async (id: string) => {
    const r = await api(`/api/market/orders/${id}`, "DELETE");
    if (!r.ok) { toast("error", r.error); return; }
    toast("success", "Buyurtma bekor qilindi."); q.reload();
  };
  return (
    <div className="mx-auto max-w-6xl">
      <SectionHeader title="Kurslarim va xaridlar" lead="Sotib olingan kurslar, cheklar va to'lov tarixi." />
      <QueryView q={q}>{(d) => (
        <Tabs defaultValue="kurslar">
          <TabsList><TabsTrigger value="kurslar">Kurslarim ({d.courses.length})</TabsTrigger><TabsTrigger value="xaridlar">Xaridlar ({d.payments.length})</TabsTrigger></TabsList>
          <TabsContent value="kurslar">{d.courses.length === 0
            ? <EmptyState icon={BookOpen} title="Hali kurs yo'q" text="Sotib olingan kurslar shu yerda ko'rinadi. Katalogdan o'zingizga mosini tanlang." action={<Button asChild><Link href="/market">Katalogga o'tish</Link></Button>} />
            : <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{d.courses.map((c) => (
              <Card key={c.id} className="flex flex-col p-5">
                <Badge variant="blue" className="w-fit">{c.kind}</Badge>
                <p className="mt-2 font-extrabold leading-snug">{c.title}</p>
                <p className="text-sm text-muted-foreground">{c.subject}{c.lessonCount ? ` · ${c.lessonCount} dars` : ""}</p>
                <div className="mt-auto pt-4">{c.accessUrl
                  ? <Button asChild size="sm"><a href={c.accessUrl} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-4 w-4" />Kursni ochish</a></Button>
                  : <p className="text-sm text-muted-foreground">Muallif hali kurs havolasini kiritmagan.</p>}</div>
              </Card>))}</div>}</TabsContent>
          <TabsContent value="xaridlar">{d.payments.length === 0
            ? <EmptyState icon={Receipt} title="Xaridlar yo'q" text="Buyurtma bergach, uning holati va cheki shu yerda ko'rinadi." />
            : <Card><Table><thead><tr><Th>Sana</Th><Th>Nima uchun</Th><Th>Kod</Th><Th>Summa</Th><Th>Holat</Th><Th><span className="sr-only">Amal</span></Th></tr></thead><tbody>
              {d.payments.map((p) => (
                <tr key={p.id}><Td className="whitespace-nowrap">{new Date(p.createdAt).toLocaleDateString("ru-RU")}</Td><Td>{p.title}</Td><Td className="font-mono text-xs">{p.reference}</Td><Td className="whitespace-nowrap">{fmtUzs(p.amount)}</Td>
                  <Td><Badge variant={ST[p.status]?.v}>{ST[p.status]?.t ?? p.status}</Badge></Td>
                  <Td className="text-right">{p.status === "PENDING" && <Button size="sm" variant="outline" onClick={() => cancel(p.id)}>Bekor qilish</Button>}</Td></tr>))}
            </tbody></Table></Card>}</TabsContent>
        </Tabs>)}</QueryView>
    </div>
  );
}
