"use client";
import Link from "next/link";
import { ArrowRight, CalendarClock, CircleAlert, Play, Target, Timer, TrendingUp } from "lucide-react";
import { ModulesAndQuick } from "@/components/layout/dashboard-bits";
import { StatCard } from "@/components/layout/page";
import { LineChart } from "@/components/charts/charts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";

export type DashboardData = {
  name: string; daysLeft: number | null; examDate: string | null; dailyMinutes: number | null; level: number | null;
  lastTest: { score: number | null; total: number | null; mode: string; at: string } | null; history: number[];
  errors: { total: number; due: number; mastered: number };
  topics: { name: string; correct: number; total: number; confidence: "LOW" | "MEDIUM" | "HIGH"; percent: number }[];
  tasks: { id: string; title: string; hint: string; href: string }[];
};

export function LiveDashboard({ d }: { d: DashboardData }) {
  return (
    <>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div><h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">Salom, {d.name.split(" ")[0]}!</h1><p className="text-muted-foreground">Tayyorgarlik holati</p></div>
        <Button asChild><Link href="/ustoz-ai/diagnostika"><Play className="h-4 w-4" />Test boshlash</Link></Button>
      </div>

      <section aria-label="Ko'rsatkichlar" className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Imtihongacha" value={d.daysLeft !== null ? `${d.daysLeft} kun` : "Belgilanmagan"} delta={d.dailyMinutes ? `Kuniga ${d.dailyMinutes} daqiqa` : undefined} icon={Timer} tone="teal" />
        <StatCard label="Bilim darajasi" value={d.level !== null ? `${d.level}%` : "Ma'lumot kam"} icon={Target} tone="blue" />
        <StatCard label="Oxirgi test" value={d.lastTest && d.lastTest.total ? `${d.lastTest.score} / ${d.lastTest.total}` : "Hali yo'q"} icon={TrendingUp} tone="amber" />
        <StatCard label="Xatolar" value={String(d.errors.total)} delta={d.errors.due ? `${d.errors.due} tasi bugun takrorlanadi` : "Takrorlash shart emas"} icon={CircleAlert} tone="rose" />
      </section>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader><div><CardTitle>Bugungi vazifalar</CardTitle><CardDescription>Natijalaringiz asosida</CardDescription></div></CardHeader>
          <CardContent>
            {d.tasks.length === 0 ? <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">Hozircha vazifa yo'q. Yaxshi natija!</p> : (
              <ul className="space-y-2">{d.tasks.map((t) => (
                <li key={t.id}><Link href={t.href} className="flex items-center gap-3 rounded-xl border border-border p-3.5 hover:bg-muted">
                  <span className="flex-1"><span className="block text-sm font-semibold">{t.title}</span><span className="block text-xs text-muted-foreground">{t.hint}</span></span>
                  <ArrowRight className="h-4 w-4 text-muted-foreground" aria-hidden /></Link></li>))}</ul>)}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><div><CardTitle>Imtihongacha qolgan vaqt</CardTitle></div></CardHeader>
          <CardContent>
            {d.daysLeft !== null ? <><p className="text-5xl font-extrabold tracking-tight text-primary">{d.daysLeft}<span className="ml-1 text-lg font-bold text-muted-foreground">kun</span></p>
              <p className="mt-2 text-sm text-muted-foreground">Imtihon sanasi: {d.examDate ? new Date(d.examDate).toLocaleDateString("uz-UZ") : ""}</p></>
              : <p className="text-sm text-muted-foreground">Imtihon sanasi belgilanmagan yoki o'tib ketgan.</p>}
            <Button asChild variant="secondary" className="mt-4 w-full"><Link href="/profil"><CalendarClock className="h-4 w-4" />Sanani o'zgartirish</Link></Button>
          </CardContent>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader><div><CardTitle>Test natijalari dinamikasi</CardTitle><CardDescription>So'nggi {d.history.length} test, %</CardDescription></div></CardHeader>
          <CardContent>{d.history.length >= 2 ? <LineChart data={d.history} labels={d.history.map((_, i) => String(i + 1))} /> : <p className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">Dinamika uchun kamida 2 ta test kerak.</p>}</CardContent>
        </Card>
        <Card>
          <CardHeader><div><CardTitle>Mavzular</CardTitle><CardDescription>Zaiflaridan boshlab</CardDescription></div></CardHeader>
          <CardContent className="space-y-3.5">
            {d.topics.length === 0 ? <p className="text-sm text-muted-foreground">Diagnostika topshirsangiz mavzular shu yerda chiqadi.</p> : d.topics.slice(0, 4).map((t) => (
              <div key={t.name}>
                <div className="mb-1 flex items-center justify-between gap-2 text-sm"><span className="font-semibold">{t.name}</span>
                  {t.confidence === "LOW" ? <Badge variant="amber">Ma'lumot kam</Badge> : <span className="text-muted-foreground">{t.percent}%</span>}</div>
                <Progress value={t.percent} barClass={t.confidence === "LOW" ? "bg-muted-foreground/50" : t.percent < 50 ? "bg-danger" : "bg-amber"} label={t.name} />
              </div>))}
            <Button asChild variant="outline" className="w-full"><Link href="/ustoz-ai/bilim-xaritasi">Bilim xaritasi<ArrowRight className="h-4 w-4" /></Link></Button>
          </CardContent>
        </Card>
      </div>

      <ModulesAndQuick />
    </>
  );
}
