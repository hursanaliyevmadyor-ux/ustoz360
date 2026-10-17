"use client";
import * as React from "react";
import Link from "next/link";
import { Check, ChevronLeft, ChevronRight, Plus, Trash2, Wand2 } from "lucide-react";
import { api } from "@/lib/admin-client";
import { cn } from "@/lib/utils";
import type { Query } from "@/lib/use-query";
import type { toifaState } from "@/server/toifa";
import { monthGrid } from "@/server/planlogic";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/form";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/components/ui/toast";

export type ToifaState = Awaited<ReturnType<typeof toifaState>>;
type Q = Query<ToifaState>;
const MONTHS = ["Yanvar", "Fevral", "Mart", "Aprel", "May", "Iyun", "Iyul", "Avgust", "Sentabr", "Oktabr", "Noyabr", "Dekabr"];
const DAYS = ["Du", "Se", "Ch", "Pa", "Ju", "Sh", "Ya"];
export const longDate = (iso: string) => { const [y, m, d] = iso.split("-").map(Number); return `${d}-${MONTHS[m - 1].toLowerCase()}, ${y}`; };
const EXAMS = { ATTESTATSIYA: "Attestatsiya", MILLIY_SERTIFIKAT: "Milliy sertifikat" } as const;

/** Maqsad (profilda saqlanadi) va rejani qoidalar bilan yangilash. */
export function GoalCard({ q }: { q: Q }) {
  const toast = useToast();
  const s = q.data!;
  const [f, setF] = React.useState({ targetExam: s.goal.targetExam ?? "", examDate: s.goal.examDate ?? "", dailyMinutes: String(s.goal.dailyMinutes ?? 60) });
  const [busy, setBusy] = React.useState<"" | "goal" | "plan">("");
  const [basis, setBasis] = React.useState<string>("");
  const saveGoal = async () => {
    setBusy("goal");
    const r = await api("/api/profile", "PUT", { targetExam: f.targetExam || null, examDate: f.examDate || null, dailyMinutes: Number(f.dailyMinutes) || null });
    setBusy("");
    if (!r.ok) { toast("error", r.status === 400 ? "Qiymatlarni tekshiring (kunlik vaqt 10–480 daqiqa)." : r.error); return; }
    toast("success", "Maqsad saqlandi."); q.reload();
  };
  const regenerate = async () => {
    setBusy("plan");
    const r = await api<{ created: number; basis: { diagnostic: boolean; weak: number; thin: number; dueErrors: number; examDate: string | null } }>("/api/toifa/plan", "POST", {});
    setBusy("");
    if (!r.ok) { toast("error", r.error); return; }
    const b = r.data.basis;
    setBasis(`Tuzildi: ${r.data.created} ta band. Asos: ${b.diagnostic ? "diagnostika topshirilgan" : "diagnostika hali yo'q"}, ${b.weak} ta zaif mavzu, ${b.thin} ta natijasi kam mavzu, ${b.dueErrors} ta takrorlashga tayyor xato${b.examDate ? `, imtihon ${longDate(b.examDate)}` : ", imtihon sanasi kiritilmagan (7 kunlik reja)"}.`);
    toast("success", "Reja yangilandi."); q.reload();
  };
  return (
    <Card><CardHeader><div><CardTitle>Maqsad</CardTitle><CardDescription>{s.goal.daysLeft !== null ? `Imtihongacha ${s.goal.daysLeft} kun` : "Imtihon sanasi kiritilmagan"}</CardDescription></div></CardHeader>
      <CardContent className="space-y-4">
        <Field label="Imtihon turi"><Select value={f.targetExam} onChange={(e) => setF({ ...f, targetExam: e.target.value })}><option value="">Tanlanmagan</option><option value="ATTESTATSIYA">Attestatsiya</option><option value="MILLIY_SERTIFIKAT">Milliy sertifikat</option></Select></Field>
        <Field label="Imtihon sanasi" hint="Faqat rasmiy e'londan oling"><Input type="date" value={f.examDate} onChange={(e) => setF({ ...f, examDate: e.target.value })} /></Field>
        <Field label="Kunlik vaqt (daqiqa)"><Input type="number" min={10} max={480} value={f.dailyMinutes} onChange={(e) => setF({ ...f, dailyMinutes: e.target.value })} /></Field>
        <Button variant="outline" className="w-full" loading={busy === "goal"} onClick={saveGoal}>Maqsadni saqlash</Button>
        <Button className="w-full" loading={busy === "plan"} onClick={regenerate}><Wand2 className="h-4 w-4" />Rejani yangilash</Button>
        <p className="text-xs text-muted-foreground">Reja diagnostika va test natijalaringizga qarab qoidalar bilan tuziladi (AI ishlatilmaydi). Bajarilgan va o'zingiz qo'shgan bandlar saqlanadi.</p>
        {basis && <p role="status" className="rounded-xl bg-teal/10 p-3 text-xs">{basis}</p>}
      </CardContent></Card>
  );
}

/** Yo'l xaritasi: bosqichlar haqiqiy holatdan hisoblanadi (qo'lda belgilanmaydi). */
export function RoadmapView({ q }: { q: Q }) {
  const s = q.data!;
  return (
    <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
      <GoalCard q={q} />
      <Card className="p-6"><ol className="space-y-0">
        {s.roadmap.map((st, i) => (
          <li key={st.key} className="relative flex gap-4 pb-6 last:pb-0">
            {i < s.roadmap.length - 1 && <span className="absolute left-[15px] top-8 h-full w-0.5 bg-border" aria-hidden />}
            <span className={cn("z-10 grid h-8 w-8 shrink-0 place-items-center rounded-full text-sm font-bold", st.done ? "bg-teal text-white" : "bg-muted text-muted-foreground")}>{st.done ? <Check className="h-4 w-4" aria-label="Bajarildi" /> : i + 1}</span>
            <div className="min-w-0 flex-1"><p className="font-bold">{st.title}</p><p className="text-sm text-muted-foreground">{st.desc}</p></div>
            {!st.done && <Button asChild size="sm" variant="outline" className="self-start"><Link href={st.href}>Ochish</Link></Button>}
          </li>))}
      </ol></Card>
    </div>
  );
}

type Ev = { id: string; kind: "plan" | "seminar" | "exam" | "official"; title: string; done?: boolean; verified?: boolean; planId?: string };

/** Tayyorgarlik kalendari: reja bandlari, seminarlar, imtihon sanasi va (tekshirilgan/tekshirilmagan) rasmiy sanalar. */
export function CalendarView({ q }: { q: Q }) {
  const s = q.data!; const toast = useToast();
  const [y, m] = s.today.split("-").map(Number);
  const [cur, setCur] = React.useState({ y, m: m - 1 });
  const [sel, setSel] = React.useState(s.today);
  const [title, setTitle] = React.useState("");
  const events = React.useMemo(() => {
    const map = new Map<string, Ev[]>(); const push = (d: string, e: Ev) => map.set(d, [...(map.get(d) ?? []), e]);
    s.plan.forEach((p) => push(p.date, { id: p.id, kind: "plan", title: p.title, done: p.done, planId: p.id }));
    s.seminars.forEach((x) => push(x.startsAt.slice(0, 10), { id: x.id, kind: "seminar", title: `Seminar: ${x.title}` }));
    if (s.goal.examDate) push(s.goal.examDate, { id: "exam", kind: "exam", title: "Imtihon (siz kiritgan sana)" });
    s.official.filter((o) => o.kind === "DATE" && o.date).forEach((o) => push(o.date!, { id: o.id, kind: "official", title: o.title, verified: o.verified }));
    return map;
  }, [s]);
  const cells = monthGrid(cur.y, cur.m);
  const shift = (d: number) => setCur((c) => { const n = c.m + d; return { y: c.y + Math.floor(n / 12), m: ((n % 12) + 12) % 12 }; });
  const day = events.get(sel) ?? [];
  const toggle = async (e: Ev) => { const r = await api(`/api/toifa/plan/${e.planId}`, "PATCH", { done: !e.done }); if (!r.ok) toast("error", r.error); else q.reload(); };
  const remove = async (e: Ev) => { const r = await api(`/api/toifa/plan/${e.planId}`, "DELETE"); if (!r.ok) toast("error", r.error); else q.reload(); };
  const add = async (ev: React.FormEvent) => {
    ev.preventDefault(); if (!title.trim()) return;
    const r = await api("/api/toifa/plan", "POST", { date: sel, title: title.trim(), kind: "TASK" });
    if (!r.ok) { toast("error", r.error); return; }
    setTitle(""); q.reload();
  };
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
      <Card className="p-4">
        <div className="mb-3 flex items-center justify-between"><Button variant="ghost" size="icon" aria-label="Oldingi oy" onClick={() => shift(-1)}><ChevronLeft className="h-5 w-5" /></Button>
          <p className="font-extrabold">{MONTHS[cur.m]} {cur.y}</p><Button variant="ghost" size="icon" aria-label="Keyingi oy" onClick={() => shift(1)}><ChevronRight className="h-5 w-5" /></Button></div>
        <div className="mb-2 grid grid-cols-7 gap-1 text-center text-xs font-bold text-muted-foreground">{DAYS.map((d) => <span key={d}>{d}</span>)}</div>
        <div className="grid grid-cols-7 gap-1">
          {cells.map((iso, i) => {
            if (!iso) return <span key={i} />;
            const ev = events.get(iso) ?? []; const dn = Number(iso.slice(8));
            return (
              <button key={iso} onClick={() => setSel(iso)} aria-pressed={sel === iso} aria-label={`${dn}-kun${ev.length ? `, ${ev.length} ta voqea` : ""}${iso === s.today ? ", bugun" : ""}`}
                className={cn("flex aspect-square min-h-11 flex-col items-center justify-center rounded-xl text-sm font-semibold hover:bg-muted", iso === s.today && "ring-2 ring-teal/50", sel === iso && "bg-teal text-white hover:bg-teal")}>
                {dn}{ev.length > 0 && <span className={cn("mt-0.5 h-1.5 w-1.5 rounded-full", sel === iso ? "bg-white" : ev.some((e) => e.kind === "exam") ? "bg-danger" : "bg-teal")} />}
              </button>);
          })}
        </div>
      </Card>
      <Card className="p-5"><p className="font-extrabold">{longDate(sel)}</p>
        {day.length ? <ul className="mt-3 space-y-2">{day.map((e) => (
          <li key={e.kind + e.id} className={cn("flex items-start gap-2 rounded-xl p-3 text-sm", e.kind === "plan" ? "bg-teal/10" : e.kind === "exam" ? "bg-danger/10" : "bg-muted")}>
            {e.kind === "plan" && <button aria-pressed={e.done} aria-label="Bajarildi belgisi" onClick={() => toggle(e)} className={cn("mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full border-2", e.done ? "border-success bg-success text-white" : "border-border")}>{e.done && <Check className="h-4 w-4" />}</button>}
            <span className={cn("flex-1 font-semibold", e.done && "line-through opacity-60")}>{e.title}
              {e.kind === "official" && <Badge className="ml-2" variant={e.verified ? "success" : "amber"}>{e.verified ? "Tekshirilgan" : "Tekshirilmagan"}</Badge>}</span>
            {e.kind === "plan" && <button aria-label="O'chirish" className="grid h-8 w-8 place-items-center" onClick={() => remove(e)}><Trash2 className="h-4 w-4 text-danger" /></button>}
          </li>))}</ul> : <p className="mt-3 text-sm text-muted-foreground">Bu kunga vazifa yo'q.</p>}
        <form onSubmit={add} className="mt-4 flex gap-2"><Input value={title} maxLength={160} onChange={(e) => setTitle(e.target.value)} placeholder="Shu kunga vazifa qo'shish" aria-label="Yangi vazifa" /><Button type="submit" size="icon" aria-label="Qo'shish"><Plus className="h-4 w-4" /></Button></form>
      </Card>
    </div>
  );
}

/** Kunlik reja: bugungi va yaqin kunlardagi bandlar, bajarilganini belgilash, qoidalar bilan tuzilgan bandlarga havola. */
export function DailyPlanView({ q }: { q: Q }) {
  const s = q.data!; const toast = useToast();
  const upcoming = s.plan.filter((p) => p.date >= s.today);
  const days = Array.from(new Set(upcoming.map((p) => p.date))).slice(0, 10);
  const todayItems = s.plan.filter((p) => p.date === s.today);
  const total = upcoming.length, done = upcoming.filter((p) => p.done).length;
  const toggle = async (id: string, v: boolean) => { const r = await api(`/api/toifa/plan/${id}`, "PATCH", { done: v }); if (!r.ok) toast("error", r.error); else q.reload(); };
  return (
    <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
      <GoalCard q={q} />
      <Card><CardHeader><div><CardTitle>Kunlik reja</CardTitle><CardDescription>{total ? `${done}/${total} band bajarildi` : "Reja hali tuzilmagan"}</CardDescription></div></CardHeader>
        <CardContent className="space-y-3">
          {total === 0 ? <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">Chapdagi «Rejani yangilash» tugmasini bosing: reja natijalaringizga qarab tuziladi.</div> : <>
            <Progress value={(done / total) * 100} label="Reja progressi" barClass="bg-teal" />
            {todayItems.length === 0 && <p className="text-sm text-muted-foreground">Bugun bandlar yo'q.</p>}
            {days.map((d) => (
              <section key={d} aria-label={longDate(d)}>
                <p className="mb-1.5 text-xs font-bold uppercase text-muted-foreground">{d === s.today ? "Bugun" : longDate(d)}</p>
                <div className="space-y-2">{upcoming.filter((p) => p.date === d).map((p) => (
                  <div key={p.id} className={cn("flex items-center gap-3 rounded-xl border border-border p-3", p.done && "bg-success/5")}>
                    <button aria-pressed={p.done} aria-label={`${p.title}: bajarildi belgisi`} onClick={() => toggle(p.id, !p.done)} className={cn("grid h-6 w-6 shrink-0 place-items-center rounded-full border-2", p.done ? "border-success bg-success text-white" : "border-border")}>{p.done && <Check className="h-4 w-4" />}</button>
                    <span className={cn("min-w-0 flex-1 text-sm font-semibold", p.done && "line-through opacity-60")}>{p.title}{p.source === "AUTO" && <span className="ml-2 text-xs font-normal text-muted-foreground">avtomatik</span>}</span>
                    {p.href && !p.done && <Button asChild size="sm" variant="outline"><Link href={p.href}>Boshlash</Link></Button>}
                  </div>))}</div>
              </section>))}
          </>}
        </CardContent></Card>
    </div>
  );
}
