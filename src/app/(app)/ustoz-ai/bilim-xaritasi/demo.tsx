import Link from "next/link";
import { topics } from "@/lib/demo";
import { modules } from "@/lib/modules";
import { PageHeader } from "@/components/layout/page";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Radar } from "@/components/charts/charts";

export function DemoMap() {
  const sorted = [...topics].sort((a, b) => a.score - b.score);
  return (
    <>
      <PageHeader module={modules[0]} title="Bilim xaritasi" description="Mavzular bo'yicha natija va ishonchlilik" demo />
      <div className="grid gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-2"><CardHeader><CardTitle>Umumiy ko'rinish</CardTitle></CardHeader>
          <CardContent><Radar items={topics.map((t) => ({ label: t.name.split(" ")[0], value: t.score }))} /></CardContent></Card>
        <Card className="lg:col-span-3"><CardHeader><div><CardTitle>Mavzular</CardTitle><CardDescription>Avval o'rganish tavsiya etiladigan tartibda</CardDescription></div></CardHeader>
          <CardContent className="space-y-4">
            {sorted.map((t) => (
              <div key={t.name}>
                <div className="mb-1 flex flex-wrap items-center justify-between gap-2 text-sm">
                  <span className="font-semibold">{t.name}</span>
                  <span className="flex items-center gap-2 text-muted-foreground">{t.answered} savol
                    {t.conf === "past" ? <Badge variant="amber">Qo'shimcha diagnostika kerak</Badge> : <Badge variant="neutral">ishonch: {t.conf}</Badge>}
                    <b className="text-foreground">{t.score}%</b></span>
                </div>
                <Progress value={t.score} barClass={t.conf === "past" ? "bg-muted-foreground/50" : t.score < 50 ? "bg-danger" : t.score < 70 ? "bg-amber" : "bg-success"} label={t.name} />
              </div>
            ))}
            <p className="text-xs text-muted-foreground">2–3 ta savol asosida mavzu o'zlashtirilgan deb hisoblanmaydi: ishonchlilik past bo'lsa mavzu kulrang ko'rsatiladi.</p>
            <Button asChild><Link href="/ustoz-ai/reja">Shu asosida reja</Link></Button>
          </CardContent></Card>
      </div>
    </>
  );
}
