"use client";
import { Check } from "lucide-react";
import { PageHeader } from "@/components/layout/page";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { NoBackendNote } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

const plans = [
  { n: "FREE", p: "0", f: ["Cheklangan testlar", "Cheklangan AI so'rovlar", "Namuna dars materiallari", "Asosiy kabinet"] },
  { n: "PRO", p: "39 000", f: ["Diagnostika", "Shaxsiy reja", "Xatolar daftari", "Kengaytirilgan testlar", "Cheklangan AI dars generatori"], cur: true },
  { n: "PREMIUM", p: "69 000", f: ["Pro funksiyalari", "Ko'proq AI limitlari", "BILIMXONA", "Kengaytirilgan generator"] },
  { n: "MENTOR / MARKAZ", p: "Kelishuv", f: ["Guruh boshqaruvi", "Kurslar", "Hisobotlar", "Jamoaviy foydalanuvchilar"] },
];
export default function Page() {
  const toast = useToast();
  return (
    <>
      <PageHeader title="Obuna va to'lovlar" description="Narxlar sinov uchun belgilangan, yakuniy emas" demo />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{plans.map((p) => (
        <Card key={p.n} className={cn("flex flex-col p-5", p.cur && "ring-2 ring-primary")}>
          <div className="flex items-center justify-between"><p className="font-extrabold">{p.n}</p>{p.cur && <Badge variant="blue">Joriy (demo)</Badge>}</div>
          <p className="mt-2 text-3xl font-extrabold">{p.p}{p.p !== "Kelishuv" && <span className="text-sm font-semibold text-muted-foreground"> so'm/oy</span>}</p>
          <ul className="mt-4 flex-1 space-y-2 text-sm">{p.f.map((x) => <li key={x} className="flex gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden />{x}</li>)}</ul>
          <Button variant={p.cur ? "secondary" : "primary"} className="mt-5" disabled={p.cur} onClick={() => toast("info", "To'lov tizimi (Click/Payme) ulanmagan.")}>{p.cur ? "Joriy tarif" : "Tanlash"}</Button></Card>))}</div>
      <div className="mt-4 max-w-2xl"><NoBackendNote>Haqiqiy tizimda obuna faqat provayderdan serverga kelgan tasdiqlangan to'lov xabaridan keyin faollashadi.</NoBackendNote></div>
    </>
  );
}
