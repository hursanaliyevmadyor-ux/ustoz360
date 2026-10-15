"use client";
import Link from "next/link";
import { modules } from "@/lib/modules";
import { PageHeader } from "@/components/layout/page";
import { LiveGate } from "@/components/layout/live-gate";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/states";
import { Radar } from "@/components/charts/charts";
import { DemoMap } from "./demo";

type T = { name: string; correct: number; total: number; percent: number; confidence: "LOW" | "MEDIUM" | "HIGH" };
const CONF = { LOW: "past", MEDIUM: "o'rta", HIGH: "yuqori" } as const;

function Live({ topics }: { topics: T[] }) {
  const sorted = [...topics].sort((a, b) => a.percent - b.percent);
  return (
    <>
      <PageHeader module={modules[0]} title="Bilim xaritasi" description="Mavzular bo'yicha natija va ishonchlilik" />
      {topics.length === 0 ? <EmptyState title="Hali ma'lumot yo'q" text="Bilim xaritasi diagnostika natijasidan tuziladi." action={<Button asChild><Link href="/ustoz-ai/diagnostika">Diagnostikani boshlash</Link></Button>} /> : (
        <div className="grid gap-6 lg:grid-cols-5">
          {topics.length >= 3 && <Card className="lg:col-span-2"><CardHeader><CardTitle>Umumiy ko'rinish</CardTitle></CardHeader><CardContent><Radar items={topics.map((t) => ({ label: t.name.split(" ")[0], value: t.percent }))} /></CardContent></Card>}
          <Card className={topics.length >= 3 ? "lg:col-span-3" : "lg:col-span-5"}><CardHeader><div><CardTitle>Mavzular</CardTitle><CardDescription>Avval o'rganish tavsiya etiladigan tartibda</CardDescription></div></CardHeader>
            <CardContent className="space-y-4">
              {sorted.map((t) => {
                const low = t.confidence === "LOW";
                return (
                  <div key={t.name}>
                    <div className="mb-1 flex flex-wrap items-center justify-between gap-2 text-sm"><span className="font-semibold">{t.name}</span>
                      <span className="flex items-center gap-2 text-muted-foreground">{t.correct}/{t.total} savol
                        {low ? <Badge variant="amber">Qo'shimcha diagnostika kerak</Badge> : <Badge variant="neutral">ishonch: {CONF[t.confidence]}</Badge>}<b className="text-foreground">{t.percent}%</b></span></div>
                    <Progress value={t.percent} barClass={low ? "bg-muted-foreground/50" : t.percent < 50 ? "bg-danger" : t.percent < 70 ? "bg-amber" : "bg-success"} label={t.name} />
                  </div>);
              })}
              <p className="text-xs text-muted-foreground">Savollar kam bo'lsa mavzu o'zlashtirilgan deb hisoblanmaydi: ishonchlilik past mavzular kulrang ko'rsatiladi.</p>
              <Button asChild><Link href="/ustoz-ai/reja">Shu asosida reja</Link></Button>
            </CardContent></Card>
        </div>)}
    </>
  );
}

export default function Page() {
  return <LiveGate<{ topics: T[] }> url="/api/mastery" render={(d) => <Live topics={d.topics} />} demo={<DemoMap />} />;
}
