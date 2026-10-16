"use client";
import * as React from "react";
import { Check } from "lucide-react";
import { events, plan, roadmapSteps } from "@/lib/demo";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { NoBackendNote } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

/** Yo'l xaritasi (namunaviy bosqichlar). */
export function RoadmapView() {
  return (
    <Card className="max-w-2xl p-6"><ol className="space-y-0">
      {roadmapSteps.map((s, i) => (
        <li key={s.t} className="relative flex gap-4 pb-6 last:pb-0">
          {i < roadmapSteps.length - 1 && <span className="absolute left-[15px] top-8 h-full w-0.5 bg-border" aria-hidden />}
          <span className={cn("z-10 grid h-8 w-8 shrink-0 place-items-center rounded-full text-sm font-bold", s.done ? "bg-teal text-white" : "bg-muted text-muted-foreground")}>{s.done ? <Check className="h-4 w-4" aria-label="Bajarildi" /> : i + 1}</span>
          <div><p className="font-bold">{s.t}</p><p className="text-sm text-muted-foreground">{s.d}</p></div>
        </li>))}
    </ol></Card>
  );
}

/** Tayyorgarlik kalendari (namunaviy oy: sanalar misol uchun). */
export function CalendarView() {
  const [sel, setSel] = React.useState<number | null>(14);
  const days = Array.from({ length: 31 }, (_, i) => i + 1);
  const ev = (d: number) => events.filter((e) => e.d === d);
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
      <Card className="p-4">
        <div className="mb-2 grid grid-cols-7 gap-1 text-center text-xs font-bold text-muted-foreground">{["Du", "Se", "Ch", "Pa", "Ju", "Sh", "Ya"].map((d) => <span key={d}>{d}</span>)}</div>
        <div className="grid grid-cols-7 gap-1">
          {days.map((d) => (
            <button key={d} onClick={() => setSel(d)} aria-pressed={sel === d} aria-label={`${d}-kun${ev(d).length ? `, ${ev(d).length} ta voqea` : ""}`}
              className={cn("flex aspect-square flex-col items-center justify-center rounded-xl text-sm font-semibold hover:bg-muted", sel === d && "bg-teal text-white hover:bg-teal")}>
              {d}{ev(d).length > 0 && <span className={cn("mt-0.5 h-1.5 w-1.5 rounded-full", sel === d ? "bg-white" : "bg-teal")} />}
            </button>))}
        </div>
      </Card>
      <Card className="p-5"><p className="font-extrabold">{sel}-kun</p>
        {sel && ev(sel).length ? <ul className="mt-3 space-y-2">{ev(sel).map((e) => <li key={e.t} className="rounded-xl bg-teal/10 p-3 text-sm font-semibold text-teal">{e.t}</li>)}</ul>
          : <p className="mt-3 text-sm text-muted-foreground">Bu kunga vazifa yo'q.</p>}
      </Card>
    </div>
  );
}

/** Kunlik reja sozlamalari va bajarilgan kunlar (namunaviy). */
export function DailyPlanView() {
  const [done, setDone] = React.useState(plan.filter((p) => p.done).map((p) => p.day));
  const toast = useToast();
  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <Card><CardHeader><div><CardTitle>Reja sozlamalari</CardTitle></div></CardHeader><CardContent className="space-y-4">
        <Field label="Imtihon turi"><Select><option>Attestatsiya</option><option>Milliy sertifikat</option></Select></Field>
        <Field label="Imtihon sanasi"><Input type="date" /></Field>
        <Field label="Kunlik vaqt"><Select defaultValue="60 daqiqa"><option>30 daqiqa</option><option>60 daqiqa</option><option>90 daqiqa</option></Select></Field>
        <Button className="w-full" onClick={() => toast("info", "Reja avtomatik tuzilishi uchun backend va AI kerak. Hozir namunaviy reja ko'rsatilgan.")}>Rejani yangilash</Button>
        <NoBackendNote />
      </CardContent></Card>
      <Card className="lg:col-span-2"><CardHeader><div><CardTitle>Kunlik reja</CardTitle><CardDescription>{done.length}/{plan.length} kun bajarildi</CardDescription></div></CardHeader>
        <CardContent className="space-y-3">
          <Progress value={(done.length / plan.length) * 100} label="Reja progressi" />
          {plan.map((p) => {
            const d = done.includes(p.day);
            return (
              <div key={p.day} className={cn("flex items-start gap-3 rounded-xl border border-border p-4", d && "bg-success/5")}>
                <button aria-pressed={d} aria-label={`${p.day} bajarildi belgisi`} onClick={() => setDone((s) => d ? s.filter((x) => x !== p.day) : [...s, p.day])}
                  className={cn("mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full border-2", d ? "border-success bg-success text-white" : "border-border")}>{d && <Check className="h-4 w-4" />}</button>
                <div><p className="text-xs font-bold uppercase text-muted-foreground">{p.day}</p><p className="font-bold">{p.title}</p>
                  <p className="text-sm text-muted-foreground">{p.parts.join(" · ")}</p></div>
              </div>);
          })}
        </CardContent></Card>
    </div>
  );
}
