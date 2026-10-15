"use client";
import Link from "next/link";
import { Dumbbell, Timer, Tags, Shuffle, Brain, RotateCcw, ClipboardCheck, GraduationCap } from "lucide-react";
import { modules } from "@/lib/modules";
import { PageHeader } from "@/components/layout/page";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";

const modes = [
  { i: Dumbbell, t: "Oddiy mashq", d: "Vaqtsiz, izoh bilan." }, { i: Timer, t: "Vaqtli test", d: "Taymer bilan." },
  { i: Tags, t: "Mavzuli test", d: "Tanlangan mavzu bo'yicha." }, { i: Shuffle, t: "Aralash test", d: "Barcha mavzulardan." },
  { i: Brain, t: "Murakkab vaziyatli", d: "Amaliy vaziyatlar." }, { i: RotateCcw, t: "Xatolar testi", d: "Faqat xato qilinganlar." },
  { i: ClipboardCheck, t: "Diagnostika", d: "Bilim darajasini aniqlash.", href: "/ustoz-ai/diagnostika" },
  { i: GraduationCap, t: "Imtihon simulyatsiyasi", d: "Rasmiy spetsifikatsiyaga mos (spetsifikatsiya kiritilgach)." },
];
export default function Page() {
  const toast = useToast();
  return (
    <>
      <PageHeader module={modules[0]} title="Test rejimlari" description="Maqsadingizga mos rejimni tanlang" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {modes.map((m) => (
          <Card key={m.t} className="flex flex-col p-5">
            <span className="grid h-11 w-11 place-items-center rounded-xl bg-primary/10 text-primary"><m.i className="h-5 w-5" aria-hidden /></span>
            <p className="mt-3 font-extrabold">{m.t}</p><p className="flex-1 text-sm text-muted-foreground">{m.d}</p>
            {m.href ? <Button asChild size="sm" className="mt-4"><Link href={m.href}>Boshlash</Link></Button>
              : <Button size="sm" variant="outline" className="mt-4" onClick={() => toast("info", "Bu rejim savollar banki (backend) ulangach ishlaydi.")}>Boshlash</Button>}
          </Card>
        ))}
      </div>
    </>
  );
}
