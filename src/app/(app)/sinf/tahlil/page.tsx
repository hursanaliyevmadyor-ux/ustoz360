import Link from "next/link";
import { classTopics, classes } from "@/lib/demo";
import { modules } from "@/lib/modules";
import { PageHeader } from "@/components/layout/page";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { LineChart } from "@/components/charts/charts";

export default function Page() {
  const weak = classTopics.filter((t) => t.v < 55);
  return (
    <>
      <PageHeader module={modules[4]} title="Sinf tahlili" description="3-A sinf, Matematika" demo />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card><CardHeader><div><CardTitle>Mavzular bo'yicha o'zlashtirish</CardTitle></div></CardHeader><CardContent className="space-y-4">
          {classTopics.map((t) => <div key={t.name}><div className="mb-1 flex justify-between text-sm"><span className="font-semibold">{t.name}</span><b>{t.v}%</b></div>
            <Progress value={t.v} barClass={t.v < 55 ? "bg-danger" : t.v < 75 ? "bg-amber" : "bg-success"} label={t.name} /></div>)}</CardContent></Card>
        <Card><CardHeader><div><CardTitle>O'sish dinamikasi</CardTitle><CardDescription>O'rtacha natija, %</CardDescription></div></CardHeader>
          <CardContent><LineChart data={classes[0].trend} labels={["Sen", "Okt", "Noy", "Dek", "Yan"]} color="#E11D48" /></CardContent></Card>
      </div>
      <Card className="mt-6 p-5"><p className="font-extrabold">Qo'shimcha yordam kerak: {weak.map((w) => w.name).join(", ")}</p>
        <Button asChild className="mt-3"><Link href="/sinf/topshiriqlar">Topshiriq tayyorlash</Link></Button></Card>
    </>
  );
}
