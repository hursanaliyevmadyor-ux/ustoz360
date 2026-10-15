"use client";
import * as React from "react";
import { Check } from "lucide-react";
import { plan } from "@/lib/demo";
import { modules } from "@/lib/modules";
import { PageHeader } from "@/components/layout/page";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { NoBackendNote } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

export default function Page() {
  const [done, setDone] = React.useState(plan.filter((p) => p.done).map((p) => p.day));
  const toast = useToast();
  return (
    <>
      <PageHeader module={modules[0]} title="Shaxsiy reja" description="Imtihon sanasi va kunlik vaqtga moslangan reja" demo />
      <div className="grid gap-6 lg:grid-cols-3">
        <Card><CardHeader><div><CardTitle>Reja sozlamalari</CardTitle></div></CardHeader><CardContent className="space-y-4">
          <Field label="Imtihon turi"><Select><option>Attestatsiya</option><option>Milliy sertifikat</option></Select></Field>
          <Field label="Imtihon sanasi"><Input type="date" /></Field>
          <Field label="Kunlik vaqt"><Select><option>30 daqiqa</option><option selected>60 daqiqa</option><option>90 daqiqa</option></Select></Field>
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
    </>
  );
}
