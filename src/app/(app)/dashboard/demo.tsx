"use client";
import * as React from "react";
import Link from "next/link";
import { ArrowRight, CalendarClock, CircleAlert, FileText, Target, Timer, Upload, Play, MessageSquare, BookOpen, TrendingUp } from "lucide-react";
import { modules } from "@/lib/modules";
import { todayTasks, topics, user } from "@/lib/demo";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge, DemoBadge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { StatCard } from "@/components/layout/page";
import { ModulesAndQuick } from "@/components/layout/dashboard-bits";
import { LineChart } from "@/components/charts/charts";
import { cn } from "@/lib/utils";

export function DemoDashboard() {
  const [done, setDone] = React.useState<string[]>([]);
  const toggle = (id: string) => setDone((d) => (d.includes(id) ? d.filter((x) => x !== id) : [...d, id]));
  return (
    <>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">Salom, {user.name.split(" ")[0]}! <DemoBadge className="align-middle" /></h1>
          <p className="text-muted-foreground">Bugungi vazifalar va tayyorgarlik holati</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild><Link href="/ustoz-ai/diagnostika"><Play className="h-4 w-4" />Test boshlash</Link></Button>
          <Button asChild variant="outline"><Link href="/darsyor/dars-ishlanmasi"><FileText className="h-4 w-4" />Dars ishlanmasi</Link></Button>
        </div>
      </div>

      <section aria-label="Ko'rsatkichlar" className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Imtihongacha" value="28 kun" delta="Namunaviy sana" icon={Timer} tone="teal" />
        <StatCard label="Bilim darajasi" value="61%" delta="+4% o'tgan haftaga" icon={Target} tone="blue" />
        <StatCard label="Oxirgi test" value="23 / 30" delta="+2 ball" icon={TrendingUp} tone="amber" />
        <StatCard label="Xatolar" value="12" delta="4 tasi bugun takrorlanadi" icon={CircleAlert} tone="rose" />
      </section>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader><div><CardTitle>Bugungi vazifalar</CardTitle><CardDescription>Shaxsiy rejangiz bo'yicha (namunaviy)</CardDescription></div><Badge variant="blue">{done.length}/{todayTasks.length} bajarildi</Badge></CardHeader>
          <CardContent>
            <Progress value={(done.length / todayTasks.length) * 100} className="mb-4" label="Bugungi vazifalar progressi" />
            <ul className="space-y-2">
              {todayTasks.map((t) => (
                <li key={t.id}>
                  <label className={cn("flex cursor-pointer items-center gap-3 rounded-xl border border-border p-3.5 hover:bg-muted", done.includes(t.id) && "bg-muted/60")}>
                    <input type="checkbox" checked={done.includes(t.id)} onChange={() => toggle(t.id)} className="h-5 w-5 accent-[#2563EB]" />
                    <span className={cn("flex-1 text-sm font-semibold", done.includes(t.id) && "text-muted-foreground line-through")}>{t.title}</span>
                    <span className="text-xs text-muted-foreground">{t.meta}</span>
                  </label>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><div><CardTitle>Imtihongacha qolgan vaqt</CardTitle><CardDescription>Namunaviy: 28 kun, kuniga 60 daqiqa</CardDescription></div></CardHeader>
          <CardContent>
            <p className="text-5xl font-extrabold tracking-tight text-primary">28<span className="ml-1 text-lg font-bold text-muted-foreground">kun</span></p>
            <Progress value={32} className="mt-4" label="Tayyorgarlik" />
            <p className="mt-2 text-sm text-muted-foreground">Reja bo'yicha 32% bajarildi</p>
            <Button asChild variant="secondary" className="mt-4 w-full"><Link href="/toifa/kalendar"><CalendarClock className="h-4 w-4" />Kalendarni ochish</Link></Button>
          </CardContent>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader><div><CardTitle>Test natijalari dinamikasi</CardTitle><CardDescription>So'nggi 6 test, % (namunaviy)</CardDescription></div><DemoBadge /></CardHeader>
          <CardContent><LineChart data={[48, 52, 55, 58, 57, 63]} labels={["1", "2", "3", "4", "5", "6"]} /></CardContent>
        </Card>
        <Card>
          <CardHeader><div><CardTitle>Takrorlash kerak</CardTitle><CardDescription>Zaif mavzular</CardDescription></div></CardHeader>
          <CardContent className="space-y-3.5">
            {[...topics].sort((a, b) => a.score - b.score).slice(0, 3).map((t) => (
              <div key={t.name}>
                <div className="mb-1 flex justify-between text-sm"><span className="font-semibold">{t.name}</span><span className="text-muted-foreground">{t.score}%</span></div>
                <Progress value={t.score} barClass={t.score < 50 ? "bg-danger" : "bg-amber"} label={t.name} />
              </div>
            ))}
            <Button asChild variant="outline" className="w-full"><Link href="/ustoz-ai/xatolar">Xatolar daftari<ArrowRight className="h-4 w-4" /></Link></Button>
          </CardContent>
        </Card>
      </div>

      <ModulesAndQuick />
    </>
  );
}
