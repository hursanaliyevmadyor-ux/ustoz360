"use client";
import { modules } from "@/lib/modules";
import { PageHeader } from "@/components/layout/page";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";

const tpl = ["Didaktik kartochka", "Jadval", "Sxema", "Venn diagrammasi", "Frayer modeli", "Klaster", "Baliq skeleti", "Taqqoslash jadvali", "Tarqatma", "A4 bosma material"];
export default function Page() {
  const toast = useToast();
  return (
    <>
      <PageHeader module={modules[1]} title="Ko'rgazmali materiallar" description="Tahrirlanadigan shablonlar" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {tpl.map((t) => (
          <Card key={t} className="flex flex-col p-4">
            <div className="mb-3 grid h-24 place-items-center rounded-xl bg-muted text-xs text-muted-foreground" aria-hidden>namuna</div>
            <p className="flex-1 font-bold">{t}</p>
            <Button size="sm" variant="outline" className="mt-3" onClick={() => toast("info", "Shablon muharriri keyingi bosqichda qo'shiladi.")}>Ochish</Button>
          </Card>))}
      </div>
    </>
  );
}
