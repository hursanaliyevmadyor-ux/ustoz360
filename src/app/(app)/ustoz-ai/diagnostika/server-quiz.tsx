"use client";
import * as React from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Clock, Flag } from "lucide-react";
import { modules } from "@/lib/modules";
import { PageHeader } from "@/components/layout/page";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge, DemoBadge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

type Q = { id: string; text: string; difficulty: string; isDemo: boolean; topic: { name: string }; options: { id: string; text: string }[] };
type Started = { sessionId: string; expiresAt: string; questions: Q[] };
type Result = {
  score: number; total: number;
  topics: { name: string; correct: number; total: number; confidence: string; needsMoreData: boolean }[];
  review: { questionId: string; text: string; isCorrect: boolean; correctOptionId: string | null; explanation?: string; options: { id: string; text: string }[]; next?: { intervalDays: number; mastered: boolean } }[];
};
const LEVEL: Record<string, string> = { EASY: "Oson", MEDIUM: "O'rta", HARD: "Murakkab" };

type QuizProps = { startUrl?: string; submitUrl?: string; title?: string; intro?: string; startLabel?: string; emptyTitle?: string; emptyText?: string };

export function ServerQuiz({
  startUrl = "/api/diagnostic/start", submitUrl = "/api/diagnostic/submit", title = "Diagnostika", startLabel = "Diagnostikani boshlash",
  intro = "Maqsad: hozirgi bilim darajangizni mavzular bo'yicha aniqlash. Test davomida ishora, izoh va AI yordam berilmaydi, to'g'ri javoblar test tugagandan keyin ko'rsatiladi. Javoblar serverda saqlanadi va natija mavzular bo'yicha hisoblanadi.",
  emptyTitle = "Hozircha takrorlash shart emas", emptyText = "Muddati kelgan xatolar yo'q.",
}: QuizProps) {
  const toast = useToast();
  const [me, setMe] = React.useState<"loading" | "anon" | "user">("loading");
  const [busy, setBusy] = React.useState(false);
  const [s, setS] = React.useState<Started | null>(null);
  const [i, setI] = React.useState(0);
  const [ans, setAns] = React.useState<Record<string, string>>({});
  const [left, setLeft] = React.useState(0);
  const [res, setRes] = React.useState<Result | null>(null);
  const [empty, setEmpty] = React.useState(false);

  React.useEffect(() => { fetch("/api/me").then((r) => r.json()).then((d) => setMe(d.user ? "user" : "anon")).catch(() => setMe("anon")); }, []);

  const submit = React.useCallback(async (started: Started, answers: Record<string, string>) => {
    setBusy(true);
    const r = await fetch(submitUrl, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ sessionId: started.sessionId, answers }) });
    const d = await r.json(); setBusy(false);
    if (!r.ok) { toast("error", d.error ?? "Topshirib bo'lmadi."); return; }
    setRes(d);
  }, [toast, submitUrl]);

  React.useEffect(() => {
    if (!s || res) return;
    const end = new Date(s.expiresAt).getTime();
    const t = setInterval(() => { const l = Math.max(0, Math.round((end - Date.now()) / 1000)); setLeft(l); if (l === 0) { clearInterval(t); submit(s, ans); } }, 1000);
    return () => clearInterval(t);
  }, [s, res, ans, submit]);

  const start = async () => {
    setBusy(true);
    const r = await fetch(startUrl, { method: "POST" }); const d = await r.json(); setBusy(false);
    if (r.ok && d.empty) { setEmpty(true); return; }
    if (!r.ok || d.error) { toast("error", d.error ?? "Boshlab bo'lmadi."); return; }
    setS(d); setI(0); setAns({}); setRes(null); setLeft(Math.round((new Date(d.expiresAt).getTime() - Date.now()) / 1000));
  };

  if (me === "loading") return <Skeleton className="h-48 w-full" />;
  if (me === "anon") return (
    <>
      <PageHeader module={modules[0]} title={title} description="Natijalar hisobingizga saqlanishi uchun tizimga kiring" />
      <Card className="max-w-xl"><CardContent className="space-y-3"><p className="text-sm text-muted-foreground">Diagnostika natijalari, xatolar daftari va reja sizning akkauntingizga bog'lanadi.</p>
        <Button asChild><Link href="/kirish">Kirish / Ro'yxatdan o'tish</Link></Button></CardContent></Card>
    </>
  );

  if (res) return (
    <>
      <PageHeader module={modules[0]} title="Natija" description="Server tomonida hisoblangan" />
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="p-6 text-center">
          <p className="text-6xl font-extrabold text-primary">{res.score}<span className="text-2xl text-muted-foreground">/{res.total}</span></p><p className="mt-1 text-muted-foreground">to'g'ri javob</p>
        </Card>
        <Card className="lg:col-span-2"><CardContent className="space-y-4">
          {res.topics.length > 0 && <p className="font-bold">Mavzular bo'yicha (jami, barcha urinishlar)</p>}
          {res.topics.map((t) => (
            <div key={t.name}>
              <div className="mb-1 flex flex-wrap items-center justify-between gap-2 text-sm"><span className="font-semibold">{t.name}</span>
                <span className="flex items-center gap-2 text-muted-foreground">{t.correct}/{t.total}{t.needsMoreData && <Badge variant="amber">Qo'shimcha diagnostika kerak</Badge>}</span></div>
              <Progress value={t.total ? (t.correct / t.total) * 100 : 0} barClass={t.needsMoreData ? "bg-muted-foreground/50" : undefined} label={t.name} />
            </div>))}
          {res.topics.length > 0 && (() => {
            const strong = res.topics.filter((t) => !t.needsMoreData && t.total > 0 && t.correct / t.total >= 0.75).map((t) => t.name);
            const weak = res.topics.filter((t) => !t.needsMoreData && t.total > 0 && t.correct / t.total < 0.75).map((t) => t.name);
            const thin = res.topics.filter((t) => t.needsMoreData).map((t) => t.name);
            return (
              <div className="grid gap-3 rounded-xl bg-muted/50 p-3.5 text-sm sm:grid-cols-2">
                <div><p className="font-bold text-success">Kuchli yo'nalishlar</p><p className="text-muted-foreground">{strong.length ? strong.join(", ") : "Hozircha aniq ko'rinmayapti."}</p></div>
                <div><p className="font-bold text-danger">Mustahkamlash kerak</p><p className="text-muted-foreground">{weak.length ? weak.join(", ") : "Yo'q."}</p></div>
                {thin.length > 0 && <p className="sm:col-span-2 text-warning">Aniqroq xulosa uchun qo'shimcha diagnostika kerak: {thin.join(", ")} bo'yicha savollar kam.</p>}
              </div>
            );
          })()}
          <p className="pt-2 font-bold">Xato qilingan savollar</p>
          {res.review.filter((r) => !r.isCorrect).map((r) => (
            <div key={r.questionId} className="rounded-xl border border-border p-3.5 text-sm"><p className="font-semibold">{r.text}</p>
              <p className="mt-1 text-success">To'g'ri javob: {r.options.find((o) => o.id === r.correctOptionId)?.text}</p><p className="text-muted-foreground">{r.explanation}</p></div>))}
          {res.review.some((r) => r.next) && (<>
            <p className="pt-2 font-bold">Keyingi takrorlash</p>
            {res.review.filter((r) => r.next).map((r) => (
              <p key={r.questionId} className="flex flex-wrap items-center gap-2 text-sm"><span className="font-semibold">{r.text}</span>
                {r.next!.mastered ? <Badge variant="success">O'zlashtirildi</Badge> : <Badge variant={r.isCorrect ? "blue" : "danger"}>{r.next!.intervalDays} kundan so'ng</Badge>}</p>))}
          </>)}
          {res.review.every((r) => r.isCorrect) && <p className="text-sm text-success">Barcha javoblar to'g'ri.</p>}
          <div className="flex flex-wrap gap-2 pt-2"><Button onClick={() => { setS(null); setRes(null); }}>Qayta urinish</Button>
            <Button asChild variant="outline"><Link href="/ustoz-ai/testlar/sozlash?mode=errors">Xatolar testi</Link></Button>
            <Button asChild variant="outline"><Link href="/ustoz-ai/xatolar">Xatolar daftari</Link></Button>
            <Button asChild variant="outline"><Link href="/ustoz-ai/bilim-xaritasi">Bilim xaritasi</Link></Button></div>
        </CardContent></Card>
      </div>
    </>
  );

  if (!s) return (
    <>
      <PageHeader module={modules[0]} title={title} description={startUrl.includes("review") ? "Muddati kelgan xatolar bo'yicha" : "Tasdiqlangan savollar bankidan"} />
      <Card className="max-w-2xl"><CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">{intro}</p>
        {empty && <p role="status" className="rounded-xl bg-success/10 p-3 text-sm"><b>{emptyTitle}.</b> {emptyText}</p>}
        <Button size="lg" loading={busy} onClick={start}>{startLabel}</Button></CardContent></Card>
    </>
  );

  const q = s.questions[i]; const mm = String(Math.floor(left / 60)).padStart(2, "0"), ss = String(left % 60).padStart(2, "0");
  return (
    <>
      <PageHeader module={modules[0]} title={title} actions={<Badge variant={left < 60 ? "danger" : "blue"} className="px-3 py-1.5 text-sm"><Clock className="h-4 w-4" aria-label="Qolgan vaqt" />{mm}:{ss}</Badge>} />
      <div className="grid gap-6 lg:grid-cols-[1fr_260px]">
        <Card><CardContent>
          <div className="mb-3 flex items-center justify-between text-sm text-muted-foreground"><span>Savol {i + 1} / {s.questions.length}</span>
            <span className="flex gap-2">{q.isDemo && <DemoBadge />}<Badge variant="neutral">{q.topic.name}</Badge><Badge variant="blue">{LEVEL[q.difficulty]}</Badge></span></div>
          <Progress value={(Object.keys(ans).length / s.questions.length) * 100} className="mb-5" label="Javob berilgan savollar" />
          <h2 className="text-xl font-bold">{q.text}</h2>
          <fieldset className="mt-5 space-y-2.5"><legend className="sr-only">Javob variantlari</legend>
            {q.options.map((o) => (
              <label key={o.id} className={cn("flex cursor-pointer items-start gap-3 rounded-xl border p-3.5 text-sm hover:bg-muted", ans[q.id] === o.id ? "border-primary bg-primary/5" : "border-border")}>
                <input type="radio" name={`q${q.id}`} checked={ans[q.id] === o.id} onChange={() => setAns((a) => ({ ...a, [q.id]: o.id }))} className="mt-0.5 h-4 w-4 accent-[#2563EB]" />{o.text}</label>))}
          </fieldset>
          <div className="mt-6 flex justify-between gap-2">
            <Button variant="outline" disabled={i === 0} onClick={() => setI(i - 1)}><ChevronLeft className="h-4 w-4" />Oldingi</Button>
            {i < s.questions.length - 1 ? <Button onClick={() => setI(i + 1)}>Keyingi<ChevronRight className="h-4 w-4" /></Button>
              : <Button variant="success" loading={busy} onClick={() => submit(s, ans)}><Flag className="h-4 w-4" />Yakunlash</Button>}
          </div>
        </CardContent></Card>
        <Card><CardContent>
          <p className="mb-3 text-sm font-bold">Savollar</p>
          <div className="grid grid-cols-5 gap-2">{s.questions.map((x, k) => (
            <button key={x.id} onClick={() => setI(k)} aria-label={`${k + 1}-savol${ans[x.id] ? ", javob berilgan" : ""}`} aria-current={k === i}
              className={cn("h-10 rounded-lg text-sm font-bold", k === i ? "bg-primary text-white" : ans[x.id] ? "bg-primary/15 text-primary" : "bg-muted")}>{k + 1}</button>))}</div>
          <Button variant="outline" size="sm" className="mt-4 w-full" loading={busy} onClick={() => submit(s, ans)}>Testni yakunlash</Button>
        </CardContent></Card>
      </div>
    </>
  );
}
