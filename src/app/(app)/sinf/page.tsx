import Link from "next/link";
import { Users } from "lucide-react";
import { classes } from "@/lib/demo";
import { modules } from "@/lib/modules";
import { PageHeader } from "@/components/layout/page";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Spark } from "@/components/charts/charts";

export default function Page() {
  return (
    <>
      <PageHeader module={modules[4]} title="Sinflar" description="Sinflaringiz va umumiy natijalar. O'quvchilar taxallus bilan yuritiladi." demo />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {classes.map((c) => (
          <Link key={c.id} href="/sinf/tahlil"><Card className="p-5 hover:shadow-pop">
            <div className="flex items-start justify-between"><div><p className="text-lg font-extrabold">{c.name}</p><p className="text-sm text-muted-foreground">{c.subject}</p></div><Spark data={c.trend} color="#E11D48" /></div>
            <p className="mt-3 flex items-center gap-1.5 text-sm text-muted-foreground"><Users className="h-4 w-4" aria-hidden />{c.students} o'quvchi</p>
            <div className="mt-3 flex justify-between text-sm"><span>O'rtacha natija</span><b>{c.avg}%</b></div>
            <Progress value={c.avg} barClass="bg-[#E11D48]" className="mt-1.5" label={`${c.name} o'rtacha natija`} />
          </Card></Link>))}
      </div>
    </>
  );
}
