"use client";
import * as React from "react";
import { mistakes, topics } from "@/lib/demo";
import { modules } from "@/lib/modules";
import { PageHeader } from "@/components/layout/page";
import { Card } from "@/components/ui/card";
import { Select } from "@/components/ui/form";
import { Table, Th, Td } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/states";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { NoBackendNote } from "@/components/ui/states";

export function DemoErrors() {
  const [topic, setTopic] = React.useState("");
  const [open, setOpen] = React.useState<(typeof mistakes)[number] | null>(null);
  const rows = mistakes.filter((m) => !topic || m.topic === topic);
  return (
    <>
      <PageHeader module={modules[0]} title="Xatolar daftari" description="Xato qilingan savollar va takrorlash jadvali" demo />
      <Card>
        <div className="flex flex-wrap items-center gap-3 p-4">
          <Select className="max-w-xs" value={topic} onChange={(e) => setTopic(e.target.value)} aria-label="Mavzu bo'yicha filtr">
            <option value="">Barcha mavzular</option>{topics.map((t) => <option key={t.name}>{t.name}</option>)}
          </Select>
          <span className="text-sm text-muted-foreground">{rows.length} ta xato</span>
        </div>
        {rows.length === 0 ? <div className="p-4 pt-0"><EmptyState title="Xato topilmadi" text="Bu mavzu bo'yicha xatolar yo'q. Yaxshi natija!" /></div> : (
          <Table>
            <thead><tr><Th>Savol</Th><Th>Mavzu</Th><Th>Sana</Th><Th>Xato soni</Th><Th>Takrorlash</Th><Th>Holat</Th><Th><span className="sr-only">Amal</span></Th></tr></thead>
            <tbody>{rows.map((m) => (
              <tr key={m.id}>
                <Td className="max-w-xs font-semibold">{m.q}</Td><Td>{m.topic}</Td><Td>{m.date}</Td><Td>{m.count}</Td><Td>{m.next}</Td>
                <Td><Badge variant={m.status === "O'zlashtirildi" ? "success" : m.status === "Takrorlash kerak" ? "danger" : "amber"}>{m.status}</Badge></Td>
                <Td><Button size="sm" variant="outline" onClick={() => setOpen(m)}>Ochish</Button></Td>
              </tr>))}</tbody>
          </Table>)}
      </Card>
      <Dialog open={!!open} onOpenChange={(v) => !v && setOpen(null)}>
        {open && <DialogContent title="Xato kartochkasi" description={open.topic}>
          <p className="font-semibold">{open.q}</p>
          <div className="mt-3 space-y-2 text-sm">
            <p className="rounded-xl bg-muted p-3">To'g'ri javob, variantlar izohi, hayotiy misol va yodlash kaliti AI xizmati ulangach shu yerda paydo bo'ladi.</p>
            <NoBackendNote>AI xato murabbiyi ulanmagan.</NoBackendNote>
          </div>
        </DialogContent>}
      </Dialog>
    </>
  );
}
