"use client";
import * as React from "react";
import Link from "next/link";
import { Plus, Users } from "lucide-react";
import { modules } from "@/lib/modules";
import { useQuery } from "@/lib/use-query";
import { QueryView } from "@/components/layout/query-view";
import { PageHeader } from "@/components/layout/page";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/states";
import { Progress } from "@/components/ui/progress";
import { Spark } from "@/components/charts/charts";
import { ClassDialog } from "@/components/sinf/class-dialog";
import type { listClasses } from "@/server/sinf";

type Data = Awaited<ReturnType<typeof listClasses>>;

export default function Page() {
  const q = useQuery<Data>("/api/sinf");
  const [open, setOpen] = React.useState(false);
  return (
    <>
      <PageHeader module={modules[4]} title="SINF ANALITIKA" description="Sinflaringiz va natijalar. O'quvchilar faqat taxallus bilan yuritiladi."
        actions={<><Button asChild variant="outline"><Link href="/sinf/tahlil">Tahlil va natijalar</Link></Button><Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" />Yangi sinf</Button></>} />
      <QueryView q={q}>{(d) => d.classes.length === 0 ? (
        <EmptyState icon={Users} title="Hali sinf yo'q" text="Sinf yarating, o'quvchilarni taxallus bilan qo'shing va baholash natijalarini kiriting: tahlil shundan hisoblanadi." action={<Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" />Birinchi sinfni yaratish</Button>} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {d.classes.map((c) => (
            <Link key={c.id} href={`/sinf/tahlil?classId=${c.id}`}><Card className="p-5 hover:shadow-pop">
              <div className="flex items-start justify-between"><div><p className="text-lg font-extrabold">{c.name}</p><p className="text-sm text-muted-foreground">{c.subject}{c.grade ? ` · ${c.grade}-sinf` : ""}</p></div>
                {c.trend.length > 1 && <Spark data={c.trend} color="#E11D48" />}</div>
              <p className="mt-3 flex items-center gap-1.5 text-sm text-muted-foreground"><Users className="h-4 w-4" aria-hidden />{c.students} o'quvchi · {c.assessments} baholash</p>
              {c.avg !== null ? <><div className="mt-3 flex justify-between text-sm"><span>So'nggi baholash o'rtachasi</span><b>{c.avg}%</b></div><Progress value={c.avg} barClass="bg-[#E11D48]" className="mt-1.5" label={`${c.name} o'rtacha natija`} /></>
                : <p className="mt-3 text-sm text-muted-foreground">Natija hali kiritilmagan.</p>}
            </Card></Link>))}
        </div>)}</QueryView>
      {open && <ClassDialog onClose={() => setOpen(false)} onSaved={() => { setOpen(false); q.reload(); }} />}
    </>
  );
}
