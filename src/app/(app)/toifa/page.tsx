import Link from "next/link";
import { ArrowRight, Route, CalendarDays, FolderCheck } from "lucide-react";
import { modules } from "@/lib/modules";
import { PageHeader } from "@/components/layout/page";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge, DemoBadge } from "@/components/ui/badge";

const m = modules[2];
export default function Page() {
  return (
    <>
      <PageHeader module={m} title="TOIFA NAVIGATOR" description="Attestatsiya va sertifikatlash jarayonini boshqaring" />
      <Card className="mb-6 p-5"><div className="flex items-center justify-between"><p className="font-extrabold">Tayyorgarlik <DemoBadge /></p><Badge variant="teal">2 / 6 bosqich</Badge></div><Progress value={33} barClass="bg-teal" className="mt-3" label="Yo'l xaritasi" /></Card>
      <div className="grid gap-4 sm:grid-cols-3">
        {[{ h: "/toifa/yol-xaritasi", i: Route, t: "Yo'l xaritasi", d: "Bosqichma-bosqich reja" }, { h: "/toifa/kalendar", i: CalendarDays, t: "Kalendar", d: "Vazifalar va eslatmalar" }, { h: "/toifa/hujjatlar", i: FolderCheck, t: "Hujjatlar", d: "Cheklist va rasmiy havolalar" }].map((f) => (
          <Link key={f.h} href={f.h}><Card className="h-full p-5 hover:shadow-pop"><span className={`grid h-11 w-11 place-items-center rounded-xl ${m.soft} ${m.text}`}><f.i className="h-5 w-5" aria-hidden /></span>
            <p className="mt-3 flex items-center font-extrabold">{f.t}<ArrowRight className="ml-auto h-4 w-4 text-muted-foreground" /></p><p className="text-sm text-muted-foreground">{f.d}</p></Card></Link>))}
      </div>
    </>
  );
}
