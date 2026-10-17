"use client";
import * as React from "react";
import Link from "next/link";
import { ArrowDown, ArrowUp, CheckCircle2, Plus, Printer, Save, Trash2, Wand2 } from "lucide-react";
import { modules } from "@/lib/modules";
import { api } from "@/lib/admin-client";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/layout/page";
import { useShell } from "@/components/layout/shell-context";
import { DocList, loadDoc, persistDoc, useDocList } from "@/components/darsyor/store";
import { TaskSheet } from "@/components/darsyor/task-print";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { useToast } from "@/components/ui/toast";
import { TASK_LABEL, TASK_TYPES, taskProblems, type TaskItem, type TaskType } from "@/server/docsvalid";

type Level = "easy" | "medium" | "hard";
type Ctx = { classId?: string; topic?: string };
const LEVEL: Record<Level, string> = { easy: "Oson", medium: "O'rta", hard: "Murakkab" };
const blank = (type: TaskType): TaskItem => ({
  type, text: "", approved: false, source: "manual", explanation: "", answer: "",
  options: type === "single" || type === "multi" ? ["", "", "", ""] : type === "order" ? ["", "", ""] : [],
  correct: [], pairs: type === "match" ? [{ l: "", r: "" }, { l: "", r: "" }] : [],
});

export default function Page() {
  const toast = useToast(); const { pub } = useShell();
  const list = useDocList("taskset");
  const [p, setP] = React.useState({ subject: "Matematika", grade: "3", topic: "", level: "medium" as Level, count: "8", passage: "" });
  const [types, setTypes] = React.useState<TaskType[]>(["single"]);
  const [items, setItems] = React.useState<TaskItem[]>([]);
  const [ctx, setCtx] = React.useState<Ctx>({});
  const [docId, setDocId] = React.useState<string | null>(null);
  const [dirty, setDirty] = React.useState(false);
  const [busy, setBusy] = React.useState<"" | "ai" | "save">("");
  const [aiNote, setAiNote] = React.useState("");

  // SINF tahlilidan kelgan kontekst: ?topic=&classId=&subject=&grade=
  React.useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    setP((x) => ({ ...x, topic: q.get("topic") ?? x.topic, subject: q.get("subject") ?? x.subject, grade: q.get("grade") ?? x.grade }));
    if (q.get("classId") || q.get("topic")) setCtx({ classId: q.get("classId") ?? undefined, topic: q.get("topic") ?? undefined });
  }, []);

  const set = (k: keyof typeof p) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => { setP({ ...p, [k]: e.target.value }); setDirty(true); };
  const title = `${p.topic.trim() || "Topshiriqlar"} (${p.grade}-sinf)`;
  const upd = (i: number, patch: Partial<TaskItem>) => { setItems((s) => s.map((t, k) => (k === i ? { ...t, ...patch, approved: patch.approved ?? false } : t))); setDirty(true); };
  const approved = items.filter((t) => t.approved).length;

  const generate = async () => {
    if (!p.topic.trim()) { toast("error", "Mavzuni kiriting."); return; }
    if (!types.length) { toast("error", "Kamida bitta tur tanlang."); return; }
    setBusy("ai"); setAiNote("");
    const r = await api<{ items: TaskItem[]; note: string | null }>("/api/ai/taskset", "POST", { subject: p.subject, grade: p.grade, topic: p.topic, level: p.level, count: Number(p.count) || 8, types, passage: types.includes("text") ? p.passage : undefined });
    setBusy("");
    if (!r.ok) { toast(r.status === 503 ? "info" : "error", r.status === 401 ? "AI uchun tizimga kiring." : r.status === 503 ? "AI hozir ulanmagan. Topshiriqlarni «Qo'lda qo'shish» orqali kiritishingiz mumkin." : r.error); return; }
    setItems((s) => [...s, ...r.data.items]); setDirty(true); setAiNote(r.data.note ?? "");
    toast(r.data.items.length ? "success" : "info", r.data.items.length ? `${r.data.items.length} ta qoralama qo'shildi. Tekshirib, tasdiqlang.` : r.data.note ?? "Topshiriq qaytmadi.");
  };

  const save = async (status: "DRAFT" | "SAVED") => {
    setBusy("save");
    const data = { params: { subject: p.subject, grade: p.grade, topic: p.topic, level: p.level }, items, ...(ctx.classId || ctx.topic ? { context: ctx } : {}) };
    const r = await persistDoc({ kind: "taskset", title, subject: p.subject, grade: p.grade, status, data }, docId);
    setBusy("");
    if (!r.ok) { toast("error", r.status === 401 ? "Saqlash uchun tizimga kiring." : r.error); return; }
    setDocId(r.data.id); setDirty(false); list.reload(); toast("success", "Saqlandi.");
  };

  const open = async (id: string) => {
    if (dirty && !window.confirm("Saqlanmagan o'zgarishlar yo'qoladi. Davom etasizmi?")) return;
    const r = await loadDoc<{ params: { subject: string; grade: string; topic: string; level: Level }; items: TaskItem[]; context?: Ctx }>(id);
    if (!r.ok) { toast("error", r.error); return; }
    const d = r.data.data;
    setP((x) => ({ ...x, subject: d.params.subject, grade: d.params.grade, topic: d.params.topic, level: d.params.level }));
    setItems(d.items); setCtx(d.context ?? {}); setDocId(id); setDirty(false);
  };

  React.useEffect(() => { const id = new URLSearchParams(window.location.search).get("doc"); if (id) void open(id); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const printSheet = (mode: "student" | "teacher") => {
    if (!approved) { toast("error", "Chop etish uchun kamida bitta topshiriqni tasdiqlang."); return; }
    document.body.dataset.print = mode;
    const done = () => { delete document.body.dataset.print; window.removeEventListener("afterprint", done); };
    window.addEventListener("afterprint", done);
    window.print();
  };

  const meta = `${p.subject}, ${p.grade}-sinf · ${LEVEL[p.level]} daraja`;
  return (
    <>
      <PageHeader module={modules[1]} title="Test va topshiriq generatori" description="O'quvchilar uchun topshiriqlar: har birida javob va izoh. AI qoralamasi siz tasdiqlamaguncha o'quvchi varag'iga kirmaydi" />
      {ctx.classId && <p className="no-print mb-4 rounded-xl bg-amber/10 px-3.5 py-2.5 text-sm">Sinf tahlilidan: «{ctx.topic ?? p.topic}» mavzusidagi qiyinchilik uchun. Topshiriqlarni berib bo'lgach, <Link className="font-semibold underline" href={`/sinf/tahlil?classId=${ctx.classId}`}>natijalarni SINF ANALITIKA'ga kiriting</Link>.</p>}
      <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
        <div className="no-print space-y-6">
          <Card><CardHeader><CardTitle>Parametrlar</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <Field label="Fan"><Input value={p.subject} onChange={set("subject")} maxLength={80} /></Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Sinf"><Select value={p.grade} onChange={set("grade")}>{[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((g) => <option key={g}>{g}</option>)}</Select></Field>
                <Field label="Qiyinlik"><Select value={p.level} onChange={set("level")}>{(Object.keys(LEVEL) as Level[]).map((l) => <option key={l} value={l}>{LEVEL[l]}</option>)}</Select></Field>
              </div>
              <Field label="Mavzu"><Input value={p.topic} onChange={set("topic")} placeholder="Mavzu nomi" maxLength={200} /></Field>
              <Field label="AI nechta topshiriq yozsin"><Input type="number" min={1} max={15} value={p.count} onChange={set("count")} /></Field>
              <fieldset><legend className="mb-2 text-sm font-semibold">Topshiriq turlari</legend>
                <div className="flex flex-wrap gap-2">{TASK_TYPES.map((t) => (
                  <label key={t} className={cn("min-h-9 cursor-pointer rounded-full border px-3.5 py-1.5 text-sm font-semibold", types.includes(t) ? "border-primary bg-primary/10 text-primary" : "border-border")}>
                    <input type="checkbox" className="sr-only" checked={types.includes(t)} onChange={() => setTypes((s) => (s.includes(t) ? s.filter((x) => x !== t) : [...s, t]))} />{TASK_LABEL[t]}</label>))}</div></fieldset>
              {types.includes("text") && <Field label="Matn (asos uchun)" hint="Savollar shu matn asosida yoziladi"><Textarea value={p.passage} onChange={set("passage")} maxLength={3000} /></Field>}
              <Button className="w-full" loading={busy === "ai"} onClick={generate}><Wand2 className="h-4 w-4" />{busy === "ai" ? "AI yozmoqda..." : "AI bilan yaratish"}</Button>
              <Button className="w-full" variant="outline" onClick={() => { setItems((s) => [...s, blank(types[0] ?? "single")]); setDirty(true); }}><Plus className="h-4 w-4" />Qo'lda qo'shish</Button>
              <p className="rounded-xl bg-amber/10 px-3.5 py-2.5 text-xs">{pub?.aiDisclaimer ?? "AI matni noto'g'ri bo'lishi mumkin."} Qoralamalar sizning tasdig'ingizsiz o'quvchilarga berilmaydi.</p>
            </CardContent></Card>
          <DocList list={list} activeId={docId} onOpen={open} onDeleted={(id) => { if (id === docId) { setDocId(null); setItems([]); } }} title="Mening to'plamlarim" empty="Hali saqlangan to'plam yo'q." />
        </div>

        <div className="space-y-4">
          <Card className="no-print"><CardContent className="flex flex-wrap items-center justify-between gap-3">
            <div><p className="font-extrabold">{title}</p><p className="text-sm text-muted-foreground">{items.length} ta topshiriq · {approved} ta tasdiqlangan {dirty && "· saqlanmagan"}</p></div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" loading={busy === "save"} disabled={!items.length} onClick={() => save("DRAFT")}>Qoralama</Button>
              <Button size="sm" loading={busy === "save"} disabled={!items.length} onClick={() => save("SAVED")}><Save className="h-4 w-4" />Saqlash</Button>
              <Button size="sm" variant="outline" disabled={!approved} onClick={() => printSheet("student")}><Printer className="h-4 w-4" />O'quvchi varag'i</Button>
              <Button size="sm" variant="outline" disabled={!approved} onClick={() => printSheet("teacher")}><Printer className="h-4 w-4" />O'qituvchi kaliti</Button>
            </div></CardContent></Card>
          {aiNote && <p role="status" className="no-print rounded-xl bg-amber/10 px-3.5 py-2.5 text-sm">{aiNote}</p>}
          {items.length === 0 && <p className="no-print rounded-2xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">Hali topshiriq yo'q. Chapdan AI bilan yarating yoki qo'lda qo'shing.</p>}
          <div className="no-print space-y-4">
            {items.map((t, i) => <TaskEditor key={i} t={t} i={i} onChange={(patch) => upd(i, patch)} onRemove={() => { setItems((s) => s.filter((_, k) => k !== i)); setDirty(true); }} onMove={(d) => { setItems((s) => { const a = s.slice(); const j = i + d; if (j < 0 || j >= a.length) return s; [a[i], a[j]] = [a[j], a[i]]; return a; }); setDirty(true); }} />)}
          </div>
          <div className="print-only print-area">
            <TaskSheet items={items} title={title} meta={meta} teacher={false} />
            <TaskSheet items={items} title={title} meta={meta} teacher />
          </div>
        </div>
      </div>
    </>
  );
}

function TaskEditor({ t, i, onChange, onRemove, onMove }: { t: TaskItem; i: number; onChange: (p: Partial<TaskItem>) => void; onRemove: () => void; onMove: (d: number) => void }) {
  const problems = taskProblems(t);
  const setOpt = (k: number, v: string) => onChange({ options: t.options.map((o, x) => (x === k ? v : o)) });
  const toggleCorrect = (k: number) => onChange({ correct: t.type === "single" ? [k] : t.correct.includes(k) ? t.correct.filter((x) => x !== k) : [...t.correct, k] });
  const removeOpt = (k: number) => onChange({ options: t.options.filter((_, x) => x !== k), correct: t.correct.filter((x) => x !== k).map((x) => (x > k ? x - 1 : x)) });
  return (
    <Card className={cn(t.approved && "border-success/50")}><CardContent className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2"><span className="grid h-7 w-7 place-items-center rounded-lg bg-muted text-sm font-bold">{i + 1}</span><Badge variant="blue">{TASK_LABEL[t.type]}</Badge>
          {t.source === "ai" && <Badge variant="amber">AI qoralamasi</Badge>}{t.approved && <Badge variant="success"><CheckCircle2 className="h-3.5 w-3.5" />Tasdiqlangan</Badge>}</div>
        <div className="flex gap-1">
          <Button variant="ghost" size="icon" aria-label="Yuqoriga" onClick={() => onMove(-1)}><ArrowUp className="h-4 w-4" /></Button>
          <Button variant="ghost" size="icon" aria-label="Pastga" onClick={() => onMove(1)}><ArrowDown className="h-4 w-4" /></Button>
          <Button variant="ghost" size="icon" aria-label="O'chirish" onClick={onRemove}><Trash2 className="h-4 w-4 text-danger" /></Button>
        </div>
      </div>
      <Field label="Savol"><Textarea value={t.text} onChange={(e) => onChange({ text: e.target.value })} maxLength={1500} /></Field>

      {(t.type === "single" || t.type === "multi") && (
        <fieldset><legend className="mb-1 text-sm font-semibold">Variantlar <span className="font-normal text-muted-foreground">({t.type === "single" ? "to'g'risini belgilang" : "to'g'ri variantlarni belgilang"})</span></legend>
          <div className="space-y-2">{t.options.map((o, k) => (
            <div key={k} className="flex items-center gap-2">
              <input type={t.type === "single" ? "radio" : "checkbox"} name={`c${i}`} className="h-5 w-5 shrink-0" checked={t.correct.includes(k)} onChange={() => toggleCorrect(k)} aria-label={`${k + 1}-variant to'g'ri`} />
              <Input value={o} onChange={(e) => setOpt(k, e.target.value)} maxLength={300} aria-label={`${k + 1}-variant`} />
              {t.options.length > 2 && <Button variant="ghost" size="icon" aria-label="Variantni o'chirish" onClick={() => removeOpt(k)}><Trash2 className="h-4 w-4" /></Button>}
            </div>))}</div>
          {t.options.length < 8 && <Button size="sm" variant="outline" className="mt-2" onClick={() => onChange({ options: [...t.options, ""] })}><Plus className="h-4 w-4" />Variant</Button>}
        </fieldset>)}

      {t.type === "order" && (
        <fieldset><legend className="mb-1 text-sm font-semibold">Bandlar <span className="font-normal text-muted-foreground">(to'g'ri tartibda yozing; varaqda aralash chiqadi)</span></legend>
          <div className="space-y-2">{t.options.map((o, k) => (
            <div key={k} className="flex items-center gap-2"><span className="w-5 text-sm text-muted-foreground">{k + 1}.</span><Input value={o} onChange={(e) => setOpt(k, e.target.value)} maxLength={300} aria-label={`${k + 1}-band`} />
              {t.options.length > 3 && <Button variant="ghost" size="icon" aria-label="Bandni o'chirish" onClick={() => onChange({ options: t.options.filter((_, x) => x !== k) })}><Trash2 className="h-4 w-4" /></Button>}</div>))}</div>
          {t.options.length < 8 && <Button size="sm" variant="outline" className="mt-2" onClick={() => onChange({ options: [...t.options, ""] })}><Plus className="h-4 w-4" />Band</Button>}
        </fieldset>)}

      {t.type === "match" && (
        <fieldset><legend className="mb-1 text-sm font-semibold">Juftliklar</legend>
          <div className="space-y-2">{t.pairs.map((pr, k) => (
            <div key={k} className="flex items-center gap-2">
              <Input value={pr.l} onChange={(e) => onChange({ pairs: t.pairs.map((x, y) => (y === k ? { ...x, l: e.target.value } : x)) })} maxLength={200} aria-label={`${k + 1}-chap`} />
              <span aria-hidden>↔</span>
              <Input value={pr.r} onChange={(e) => onChange({ pairs: t.pairs.map((x, y) => (y === k ? { ...x, r: e.target.value } : x)) })} maxLength={200} aria-label={`${k + 1}-o'ng`} />
              {t.pairs.length > 2 && <Button variant="ghost" size="icon" aria-label="Juftlikni o'chirish" onClick={() => onChange({ pairs: t.pairs.filter((_, y) => y !== k) })}><Trash2 className="h-4 w-4" /></Button>}
            </div>))}</div>
          {t.pairs.length < 8 && <Button size="sm" variant="outline" className="mt-2" onClick={() => onChange({ pairs: [...t.pairs, { l: "", r: "" }] })}><Plus className="h-4 w-4" />Juftlik</Button>}
        </fieldset>)}

      {(t.type === "open" || t.type === "situation" || t.type === "logic" || t.type === "text") && (
        <Field label="Namunaviy javob yoki baholash mezoni"><Textarea value={t.answer} onChange={(e) => onChange({ answer: e.target.value })} maxLength={1500} /></Field>)}

      <Field label="Izoh (nima uchun shunday)"><Textarea className="min-h-16" value={t.explanation} onChange={(e) => onChange({ explanation: e.target.value })} maxLength={1000} /></Field>

      {problems.length > 0 && <ul role="alert" className="list-disc rounded-xl bg-danger/10 py-2 pl-7 pr-3 text-sm text-danger">{problems.map((x) => <li key={x}>{x}</li>)}</ul>}
      <div className="flex justify-end">
        <Button size="sm" variant={t.approved ? "outline" : "success"} disabled={!t.approved && (problems.length > 0 || !t.text.trim())} onClick={() => onChange({ approved: !t.approved })}>
          {t.approved ? "Tasdiqni bekor qilish" : "Tekshirdim, tasdiqlayman"}</Button>
      </div>
    </CardContent></Card>
  );
}
