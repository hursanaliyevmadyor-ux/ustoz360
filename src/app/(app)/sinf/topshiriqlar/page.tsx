"use client";
import { modules } from "@/lib/modules";
import { PageHeader } from "@/components/layout/page";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { NoBackendNote } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";

const lv = ["Boshlang'ich", "O'rta", "Yuqori"];
export default function Page() {
  const toast = useToast();
  return (
    <>
      <PageHeader module={modules[4]} title="Individual topshiriqlar" description="Sinfdagi qiyinchilik asosida DARSYOR topshiriq yaratadi" demo />
      <Card className="mb-4 p-5"><p className="font-extrabold">Mavzu: Bo'lish amali</p><p className="text-sm text-muted-foreground">Sinfning katta qismi shu mavzuda qiynalmoqda (49%).</p>
        <div className="mt-3 flex flex-wrap gap-2"><Button onClick={() => toast("info", "Topshiriq yaratish AI ulangach ishlaydi. O'qituvchi tasdiqlamaguncha yuborilmaydi.")}>Topshiriq yaratish</Button><Badge variant="neutral">Tasdiqlash talab etiladi</Badge></div></Card>
      <div className="grid gap-4 sm:grid-cols-3">{lv.map((l) => <Card key={l} className="p-5"><Badge variant="blue">{l}</Badge><p className="mt-3 text-sm text-muted-foreground">Bu daraja topshirig'i AI yaratgandan keyin shu yerda ko'rinadi.</p></Card>)}</div>
      <div className="mt-4"><NoBackendNote /></div>
    </>
  );
}
