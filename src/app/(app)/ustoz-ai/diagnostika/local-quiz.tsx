"use client";
import * as React from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Clock, Flag } from "lucide-react";
import { demoQuestions } from "@/lib/demo";
import { modules } from "@/lib/modules";
import { PageHeader } from "@/components/layout/page";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge, DemoBadge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { NoBackendNote } from "@/components/ui/states";
import { cn } from "@/lib/utils";

const TOTAL = 10 * 60;
export function LocalDiagnostics() {
  const [started, setStarted] = React.useState(false);
  const [finished, setFinished] = React.useState(false);
  const [i, setI] = React.useState(0);
  const [ans, setAns] = React.useState<Record<number, number>>({});
  const [left, setLeft] = React.useState(TOTAL);
  React.useEffect(() => {
    if (!started || finished) return;
    const t = setInterval(() => setLeft((s) => { if (s <= 1) { setFinished(true); return 0; } return s - 1; }), 1000);
    return () => clearInterval(t);
  }, [started, finished]);
  const q = demoQuestions[i];
  const mm = String(Math.floor(left / 60)).padStart(2, "0"), ss = String(left % 60).padStart(2, "0");
  const correct = demoQuestions.filter((x) => ans[x.id] === x.a).length;
  const answered = Object.keys(ans).length;

  if (!started) return (
    <>
      <PageHeader module={modules[0]} title="Diagnostika" description="Boshlang'ich bilim darajasini aniqlash" demo />
      <Card className="max-w-2xl"><CardContent className="space-y-4">
        <ul className="grid gap-2 text-sm sm:grid-cols-2">
          <li className="rounded-xl bg-muted p-3"><b>{demoQuestions.length} ta</b> namunaviy savol (haqiqiy MVP: 30 ta)</li>
          <li className="rounded-xl bg-muted p-3"><b>10 daqiqa</b> vaqt hisoblagichi</li>
          <li className="rounded-xl bg-muted p-3">Savollar orasida erkin yurish</li>
          <li className="rounded-xl bg-muted p-3">Natija mavzular bo'yicha</li>
        </ul>
        <NoBackendNote>Savollar DEMO va ekspert tekshirmagan. Javoblar serverga saqlanmaydi, faqat shu sahifada hisoblanadi.</NoBackendNote>
        <Button size="lg" onClick={() => setStarted(true)}>Diagnostikani boshlash</Button>
      </CardContent></Card>
    </>
  );

  if (finished) {
    const byTopic = Object.values(demoQuestions.reduce<Record<string, { t: string; ok: number; n: number }>>((acc, x) => {
      const e = (acc[x.topic] ??= { t: x.topic, ok: 0, n: 0 }); e.n++; if (ans[x.id] === x.a) e.ok++; return acc;
    }, {}));
    return (
      <>
        <PageHeader module={modules[0]} title="Natija" description="Namunaviy diagnostika yakunlandi" demo />
        <div className="grid gap-6 lg:grid-cols-3">
          <Card className="p-6 text-center">
            <p className="text-6xl font-extrabold text-primary">{correct}<span className="text-2xl text-muted-foreground">/{demoQuestions.length}</span></p>
            <p className="mt-1 text-muted-foreground">to'g'ri javob</p>
            <Badge variant="amber" className="mt-3">Ishonchlilik: past (savollar kam)</Badge>
            <p className="mt-3 text-sm text-muted-foreground">Har mavzuda 1–2 savol bor, shuning uchun "Qo'shimcha diagnostika kerak".</p>
          </Card>
          <Card className="lg:col-span-2"><CardContent className="space-y-4">
            <p className="font-bold">Mavzular bo'yicha</p>
            {byTopic.map((t) => (
              <div key={t.t}>
                <div className="mb-1 flex justify-between text-sm"><span className="font-semibold">{t.t}</span><span className="text-muted-foreground">{t.ok}/{t.n} · qo'shimcha diagnostika kerak</span></div>
                <Progress value={(t.ok / t.n) * 100} barClass={t.ok === t.n ? "bg-success" : "bg-danger"} label={t.t} />
              </div>
            ))}
            <p className="pt-2 font-bold">Xato qilingan savollar</p>
            {demoQuestions.filter((x) => ans[x.id] !== x.a).map((x) => (
              <div key={x.id} className="rounded-xl border border-border p-3.5 text-sm">
                <p className="font-semibold">{x.q}</p>
                <p className="mt-1 text-success">To'g'ri javob: {x.opts[x.a]}</p>
                <p className="text-muted-foreground">{x.why}</p>
              </div>
            ))}
            {correct === demoQuestions.length && <p className="text-sm text-success">Barcha javoblar to'g'ri.</p>}
            <div className="flex flex-wrap gap-2 pt-2">
              <Button onClick={() => { setStarted(false); setFinished(false); setAns({}); setI(0); setLeft(TOTAL); }}>Qayta urinish</Button>
              <Button asChild variant="outline"><Link href="/ustoz-ai/bilim-xaritasi">Bilim xaritasi</Link></Button>
            </div>
            <NoBackendNote>Xatolar "Xatolar daftari"ga avtomatik tushmaydi: bu serverda saqlashni talab qiladi.</NoBackendNote>
          </CardContent></Card>
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader module={modules[0]} title="Diagnostika" demo actions={<Badge variant={left < 60 ? "danger" : "blue"} className="px-3 py-1.5 text-sm"><Clock className="h-4 w-4" aria-label="Qolgan vaqt" />{mm}:{ss}</Badge>} />
      <div className="grid gap-6 lg:grid-cols-[1fr_260px]">
        <Card><CardContent>
          <div className="mb-3 flex items-center justify-between text-sm text-muted-foreground"><span>Savol {i + 1} / {demoQuestions.length}</span><span className="flex gap-2"><Badge variant="neutral">{q.topic}</Badge><Badge variant="blue">{q.level}</Badge></span></div>
          <Progress value={(answered / demoQuestions.length) * 100} className="mb-5" label="Javob berilgan savollar" />
          <h2 className="text-xl font-bold">{q.q}</h2>
          <fieldset className="mt-5 space-y-2.5"><legend className="sr-only">Javob variantlari</legend>
            {q.opts.map((o, k) => (
              <label key={k} className={cn("flex cursor-pointer items-start gap-3 rounded-xl border p-3.5 text-sm hover:bg-muted", ans[q.id] === k ? "border-primary bg-primary/5" : "border-border")}>
                <input type="radio" name={`q${q.id}`} checked={ans[q.id] === k} onChange={() => setAns((a) => ({ ...a, [q.id]: k }))} className="mt-0.5 h-4 w-4 accent-[#2563EB]" />{o}
              </label>
            ))}
          </fieldset>
          <div className="mt-6 flex justify-between gap-2">
            <Button variant="outline" disabled={i === 0} onClick={() => setI(i - 1)}><ChevronLeft className="h-4 w-4" />Oldingi</Button>
            {i < demoQuestions.length - 1
              ? <Button onClick={() => setI(i + 1)}>Keyingi<ChevronRight className="h-4 w-4" /></Button>
              : <Button variant="success" onClick={() => setFinished(true)}><Flag className="h-4 w-4" />Yakunlash</Button>}
          </div>
        </CardContent></Card>
        <Card><CardContent>
          <p className="mb-3 text-sm font-bold">Savollar</p>
          <div className="grid grid-cols-5 gap-2">
            {demoQuestions.map((x, k) => (
              <button key={x.id} onClick={() => setI(k)} aria-label={`${k + 1}-savol${ans[x.id] !== undefined ? ", javob berilgan" : ""}`} aria-current={k === i}
                className={cn("h-10 rounded-lg text-sm font-bold", k === i ? "bg-primary text-white" : ans[x.id] !== undefined ? "bg-primary/15 text-primary" : "bg-muted")}>{k + 1}</button>
            ))}
          </div>
          <Button variant="outline" size="sm" className="mt-4 w-full" onClick={() => setFinished(true)}>Testni yakunlash</Button>
        </CardContent></Card>
      </div>
    </>
  );
}
