"use client";
import * as React from "react";
import Link from "next/link";
import { Pencil, Plus, Trash2, UserPlus, Wand2 } from "lucide-react";
import { api } from "@/lib/admin-client";
import { cn } from "@/lib/utils";
import type { Query } from "@/lib/use-query";
import type { classDetail } from "@/server/sinf";
import { LineChart } from "@/components/charts/charts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { EmptyState } from "@/components/ui/states";
import { Progress } from "@/components/ui/progress";
import { Table, Td, Th } from "@/components/ui/table";
import { useToast } from "@/components/ui/toast";

export type Detail = Awaited<ReturnType<typeof classDetail>>;
type Q = Query<Detail>;
const KIND = { BEFORE: "Oldin", AFTER: "Keyin", CURRENT: "Joriy" } as const;
const dmy = (iso: string) => iso.split("-").reverse().join(".");
const LEVEL_BAR = { weak: "bg-danger", ok: "bg-amber", strong: "bg-success" } as const;
const sign = (n: number) => `${n > 0 ? "+" : ""}${n}`;

// ---------------- O'quvchilar ----------------
export function StudentsPanel({ d, q }: { d: Detail; q: Q }) {
  const toast = useToast();
  const [text, setText] = React.useState(""); const [busy, setBusy] = React.useState(false);
  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    const aliases = text.split(/[\n,;]+/).map((x) => x.trim()).filter(Boolean);
    if (!aliases.length) return;
    setBusy(true); const r = await api<{ added: number; skipped: number }>(`/api/sinf/${d.id}/students`, "POST", { aliases }); setBusy(false);
    if (!r.ok) { toast("error", r.error); return; }
    toast("success", `${r.data.added} ta qo'shildi${r.data.skipped ? `, ${r.data.skipped} tasi allaqachon bor` : ""}.`); setText(""); q.reload();
  };
  const rename = async (id: string, cur: string) => {
    const alias = window.prompt("Yangi taxallus", cur); if (!alias || alias.trim() === cur) return;
    const r = await api(`/api/sinf/${d.id}/students/${id}`, "PATCH", { alias }); if (!r.ok) toast("error", r.error); else q.reload();
  };
  const remove = async (id: string, alias: string) => {
    if (!window.confirm(`«${alias}» va uning barcha natijalari o'chirilsinmi?`)) return;
    const r = await api(`/api/sinf/${d.id}/students/${id}`, "DELETE"); if (!r.ok) toast("error", r.error); else q.reload();
  };
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      <Card><CardHeader><CardTitle>O'quvchilar ({d.students.length})</CardTitle></CardHeader><CardContent>
        {d.students.length === 0 ? <EmptyState icon={UserPlus} title="O'quvchi yo'q" text="O'ng tomondan taxalluslarni kiriting (har qatorda bittadan)." /> : (
          <ul className="grid gap-2 sm:grid-cols-2">{d.students.map((s) => (
            <li key={s.id} className="flex items-center justify-between rounded-xl border border-border px-3 py-1.5"><span className="font-semibold">{s.alias}</span>
              <span><Button variant="ghost" size="icon" aria-label={`${s.alias}: taxallusni o'zgartirish`} onClick={() => rename(s.id, s.alias)}><Pencil className="h-4 w-4" /></Button>
                <Button variant="ghost" size="icon" aria-label={`${s.alias}: o'chirish`} onClick={() => remove(s.id, s.alias)}><Trash2 className="h-4 w-4 text-danger" /></Button></span></li>))}</ul>)}
      </CardContent></Card>
      <Card><CardHeader><CardTitle>Taxallus qo'shish</CardTitle></CardHeader><CardContent>
        <form onSubmit={add} className="space-y-3">
          <Field label="Taxalluslar" hint="Har qatorda bittadan yoki vergul bilan. Ism-familiya, telefon yoki email yozmang: O-1, O-2 yoki Oybek kabi qisqa taxallus."><Textarea className="min-h-32" value={text} onChange={(e) => setText(e.target.value)} placeholder={"O-1\nO-2\nO-3"} /></Field>
          <Button type="submit" loading={busy}><UserPlus className="h-4 w-4" />Qo'shish</Button>
          <p className="text-xs text-muted-foreground">Taxallus va ball sizning akkauntingizda saqlanadi. Taxallus qaysi o'quvchi ekanini faqat siz bilasiz.</p>
        </form>
      </CardContent></Card>
    </div>
  );
}

// ---------------- Natijalar ----------------
export function ResultsPanel({ d, q }: { d: Detail; q: Q }) {
  const toast = useToast();
  const [edit, setEdit] = React.useState<Detail["assessments"][number] | "new" | null>(null);
  const [enter, setEnter] = React.useState<Detail["assessments"][number] | null>(null);
  const remove = async (a: Detail["assessments"][number]) => {
    if (!window.confirm(`«${a.title}» va undagi natijalar o'chirilsinmi?`)) return;
    const r = await api(`/api/sinf/${d.id}/assessments/${a.id}`, "DELETE"); if (!r.ok) toast("error", r.error); else { toast("success", "O'chirildi."); q.reload(); }
  };
  const count = (id: string) => d.scores.filter((s) => s.assessmentId === id).length;
  return (
    <div className="space-y-4">
      <div className="flex justify-end"><Button onClick={() => setEdit("new")}><Plus className="h-4 w-4" />Yangi baholash</Button></div>
      {d.assessments.length === 0 ? <EmptyState title="Baholash yo'q" text="Mavzu bo'yicha nazorat yoki test yarating, so'ng o'quvchilar ballarini kiriting." />
        : <div className="grid gap-3">{d.assessments.slice().reverse().map((a) => (
          <Card key={a.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
            <div><p className="font-extrabold">{a.title} <Badge variant={a.kind === "BEFORE" ? "amber" : a.kind === "AFTER" ? "success" : "blue"}>{KIND[a.kind]}</Badge></p>
              <p className="text-sm text-muted-foreground">{a.topic} · {dmy(a.date)} · eng yuqori ball {a.maxScore} · {count(a.id)}/{d.students.length} natija</p></div>
            <div className="flex flex-wrap gap-2"><Button size="sm" onClick={() => setEnter(a)} disabled={!d.students.length}>Natijalarni kiritish</Button>
              <Button size="sm" variant="outline" onClick={() => setEdit(a)}><Pencil className="h-4 w-4" />Tahrirlash</Button>
              <Button size="sm" variant="ghost" aria-label="O'chirish" onClick={() => remove(a)}><Trash2 className="h-4 w-4 text-danger" /></Button></div>
          </Card>))}</div>}
      {d.students.length === 0 && d.assessments.length > 0 && <p className="text-sm text-muted-foreground">Natija kiritish uchun avval «O'quvchilar» bo'limida taxalluslarni qo'shing.</p>}
      {edit && <AssessmentDialog classId={d.id} a={edit === "new" ? null : edit} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); q.reload(); }} />}
      {enter && <ScoresDialog d={d} a={enter} onClose={() => setEnter(null)} onSaved={() => { setEnter(null); q.reload(); }} />}
    </div>
  );
}

function AssessmentDialog({ classId, a, onClose, onSaved }: { classId: string; a: Detail["assessments"][number] | null; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [f, setF] = React.useState({ title: a?.title ?? "", topic: a?.topic ?? "", kind: a?.kind ?? "CURRENT", maxScore: String(a?.maxScore ?? 10), date: a?.date ?? new Date(Date.now() + 5 * 3600_000).toISOString().slice(0, 10) });
  const [busy, setBusy] = React.useState(false); const [err, setErr] = React.useState("");
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setErr("");
    const body = { ...f, maxScore: Number(f.maxScore) };
    const r = a ? await api(`/api/sinf/${classId}/assessments/${a.id}`, "PUT", body) : await api(`/api/sinf/${classId}/assessments`, "POST", body);
    setBusy(false);
    if (!r.ok) { setErr(r.error); return; }
    toast("success", "Saqlandi."); onSaved();
  };
  return (
    <Dialog open onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent title={a ? "Baholashni tahrirlash" : "Yangi baholash"} description="Oldin/keyin taqqoslash uchun bir xil mavzu nomini ishlating">
        <form onSubmit={submit} className="space-y-4">
          <Field label="Nomi"><Input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} required maxLength={80} autoFocus placeholder="Masalan: Bo'lish bo'yicha nazorat" /></Field>
          <Field label="Mavzu" hint="Tahlil mavzu bo'yicha guruhlanadi"><Input value={f.topic} onChange={(e) => setF({ ...f, topic: e.target.value })} required maxLength={80} /></Field>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Turi"><Select value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value as typeof f.kind })}><option value="BEFORE">Oldin (kirish)</option><option value="CURRENT">Joriy</option><option value="AFTER">Keyin (yakun)</option></Select></Field>
            <Field label="Eng yuqori ball"><Input type="number" min={1} max={1000} value={f.maxScore} onChange={(e) => setF({ ...f, maxScore: e.target.value })} required /></Field>
            <Field label="Sana"><Input type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} required /></Field>
          </div>
          {err && <p role="alert" className="rounded-xl bg-danger/10 p-3 text-sm text-danger">{err}</p>}
          <div className="flex justify-end gap-3"><Button type="button" variant="outline" onClick={onClose}>Bekor qilish</Button><Button type="submit" loading={busy}>Saqlash</Button></div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ScoresDialog({ d, a, onClose, onSaved }: { d: Detail; a: Detail["assessments"][number]; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const init = React.useMemo(() => Object.fromEntries(d.students.map((s) => [s.id, String(d.scores.find((x) => x.assessmentId === a.id && x.studentId === s.id)?.score ?? "")])), [d, a]);
  const [v, setV] = React.useState<Record<string, string>>(init);
  const [busy, setBusy] = React.useState(false); const [err, setErr] = React.useState("");
  const bad = (s: string) => s !== "" && (!Number.isFinite(Number(s)) || Number(s) < 0 || Number(s) > a.maxScore);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (Object.values(v).some(bad)) { setErr(`Ball 0 dan ${a.maxScore} gacha bo'lishi kerak.`); return; }
    // Faqat o'zgargan kataklar yuboriladi.
    const scores: Record<string, number | null> = {};
    for (const s of d.students) if (v[s.id] !== init[s.id]) scores[s.id] = v[s.id] === "" ? null : Number(v[s.id]);
    if (!Object.keys(scores).length) { onClose(); return; }
    setBusy(true); setErr("");
    const r = await api(`/api/sinf/${d.id}/assessments/${a.id}/scores`, "PUT", { scores });
    setBusy(false);
    if (!r.ok) { setErr(r.error); return; }
    toast("success", "Natijalar saqlandi."); onSaved();
  };
  return (
    <Dialog open onOpenChange={(x) => { if (!x) onClose(); }}>
      <DialogContent title={a.title} description={`${a.topic} · eng yuqori ball ${a.maxScore}. Bo'sh qoldirsangiz natija yo'q hisoblanadi.`} className="max-h-[90vh] overflow-y-auto">
        <form onSubmit={submit} className="space-y-3">
          <div className="grid gap-2 sm:grid-cols-2">{d.students.map((s) => (
            <label key={s.id} className="flex items-center justify-between gap-3 rounded-xl border border-border px-3 py-1.5 text-sm font-semibold">{s.alias}
              <Input type="number" inputMode="decimal" step="any" min={0} max={a.maxScore} className={cn("h-10 w-24", bad(v[s.id]) && "border-danger")} value={v[s.id] ?? ""} onChange={(e) => setV({ ...v, [s.id]: e.target.value })} aria-label={`${s.alias} bali`} /></label>))}</div>
          {err && <p role="alert" className="rounded-xl bg-danger/10 p-3 text-sm text-danger">{err}</p>}
          <div className="flex justify-end gap-3"><Button type="button" variant="outline" onClick={onClose}>Bekor qilish</Button><Button type="submit" loading={busy}>Saqlash</Button></div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ---------------- Tahlil ----------------
export function AnalysisPanel({ d }: { d: Detail }) {
  const a = d.analysis;
  if (!d.assessments.length || a.classAvg === null) return <EmptyState title="Tahlil uchun natija yo'q" text="«Natijalar» bo'limida baholash yarating va o'quvchilar ballarini kiriting." />;
  const trend = a.trend.filter((t) => t.avg !== null);
  const ctx = (topic: string) => `/darsyor/test-generator?${new URLSearchParams({ topic, classId: d.id, subject: d.subject, ...(d.grade && { grade: d.grade }) })}`;
  return (
    <div className="space-y-6">
      <Card className="p-5"><p className="text-sm text-muted-foreground">Sinf o'rtachasi</p><p className="text-3xl font-extrabold">{a.classAvg}%</p>
        {d.insights.length > 0 && <ul className="mt-3 list-disc space-y-1 pl-5 text-sm">{d.insights.map((x, i) => <li key={i}>{x}</li>)}</ul>}</Card>
      <div className="grid gap-6 xl:grid-cols-2">
        <Card><CardHeader><CardTitle>Mavzular bo'yicha</CardTitle></CardHeader><CardContent className="space-y-4">
          {a.topics.map((t) => (
            <div key={t.topic}>
              <div className="flex flex-wrap items-center justify-between gap-2 text-sm"><span className="font-semibold">{t.topic}{t.lowData && <Badge className="ml-2" variant="amber">Natija kam ({t.n})</Badge>}</span><b>{t.avg === null ? "—" : `${t.avg}%`}</b></div>
              {t.avg !== null && <Progress value={t.avg} barClass={t.level ? LEVEL_BAR[t.level] : undefined} className="mt-1" label={`${t.topic} o'zlashtirish`} />}
              {t.level === "weak" && <Button asChild size="sm" variant="outline" className="mt-2"><Link href={ctx(t.topic)}><Wand2 className="h-4 w-4" />DARSYOR'da topshiriq yaratish</Link></Button>}
            </div>))}
          <p className="text-xs text-muted-foreground">Mavzu bahosi shu mavzudagi eng so'nggi baholashdan olinadi. 60% dan past — qiyin, 80% va undan yuqori — yaxshi o'zlashtirilgan.</p>
        </CardContent></Card>
        <Card><CardHeader><CardTitle>Vaqt bo'yicha</CardTitle></CardHeader><CardContent>
          {trend.length >= 2 ? <LineChart data={trend.map((t) => t.avg!)} labels={trend.map((t) => dmy(t.date).slice(0, 5))} color="#E11D48" />
            : <p className="text-sm text-muted-foreground">Dinamika uchun kamida 2 ta baholash natijasi kerak.</p>}
        </CardContent></Card>
      </div>
      <Card><CardHeader><CardTitle>O'quvchilar</CardTitle></CardHeader><CardContent className="px-0">
        <Table><thead><tr><Th>Taxallus</Th><Th>O'rtacha</Th><Th>Natijalar</Th><Th>Qiyinalayotgan mavzular</Th><Th>Holat</Th></tr></thead><tbody>
          {a.students.map((s) => (
            <tr key={s.studentId}><Td className="font-semibold">{s.alias}</Td><Td>{s.avg === null ? "—" : `${s.avg}%`}</Td><Td>{s.n}</Td><Td>{s.weakTopics.join(", ") || "—"}</Td>
              <Td>{s.needsHelp ? <Badge variant="danger">Yordam kerak</Badge> : s.n < 2 ? <Badge variant="neutral">Ma'lumot kam</Badge> : <Badge variant="success">Barqaror</Badge>}</Td></tr>))}
        </tbody></Table></CardContent></Card>
    </div>
  );
}

// ---------------- Oldin / keyin ----------------
export function ComparePanel({ d }: { d: Detail }) {
  const c = d.analysis.comparisons;
  if (!c.length) return <EmptyState title="Taqqoslash uchun ma'lumot yo'q" text="Bir xil mavzu nomi bilan «Oldin» va undan keyingi «Keyin» baholash yarating va ikkalasiga ham natija kiriting." />;
  return (
    <div className="space-y-6">
      {c.map((x) => (
        <Card key={x.topic}><CardHeader><div><CardTitle>{x.topic}</CardTitle><p className="mt-0.5 text-sm text-muted-foreground">{x.common} ta o'quvchi ikkala marta ham qatnashgan</p></div>
          <Badge variant={x.delta > 0 ? "success" : x.delta < 0 ? "danger" : "neutral"}>{sign(x.delta)} punkt</Badge></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div><p className="text-sm text-muted-foreground">Oldin</p><Progress value={x.before} label={`${x.topic}: oldin`} barClass="bg-amber" /><p className="mt-1 font-bold">{x.before}%</p></div>
              <div><p className="text-sm text-muted-foreground">Keyin</p><Progress value={x.after} label={`${x.topic}: keyin`} barClass="bg-success" /><p className="mt-1 font-bold">{x.after}%</p></div>
            </div>
            {x.lowData && <p role="note" className="rounded-xl bg-amber/10 px-3.5 py-2.5 text-sm">Qatnashganlar soni kam ({x.common} ta): bu natijadan umumiy xulosa chiqarmang, ko'proq o'quvchi natijasini kiriting.</p>}
            <details><summary className="min-h-11 cursor-pointer py-2 text-sm font-semibold">O'quvchilar kesimi</summary>
              <Table><thead><tr><Th>Taxallus</Th><Th>Oldin</Th><Th>Keyin</Th><Th>O'zgarish</Th></tr></thead><tbody>
                {x.students.map((s) => <tr key={s.alias}><Td className="font-semibold">{s.alias}</Td><Td>{s.before}%</Td><Td>{s.after}%</Td><Td className={cn("font-bold", s.delta > 0 ? "text-success" : s.delta < 0 ? "text-danger" : "")}>{sign(s.delta)}</Td></tr>)}</tbody></Table></details>
          </CardContent></Card>))}
    </div>
  );
}
