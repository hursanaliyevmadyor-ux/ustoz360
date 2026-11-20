"use client";
import * as React from "react";
import Link from "next/link";
import { CheckCircle2, CheckSquare, ClipboardCheck, Flag, Pencil, Plus, Trash2, X } from "lucide-react";
import { adminModule } from "@/lib/modules";
import { api } from "@/lib/admin-client";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/layout/page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { EmptyState } from "@/components/ui/states";
import { Table, Td, Th } from "@/components/ui/table";
import { useToast } from "@/components/ui/toast";

type Row = { id: string; text: string; topicId: string; topic: string; subject: string; difficulty: string; status: string; source: string; sample: boolean; kind: string; skill: string | null; options: number; reports: number; verified: boolean };
type List = { counts: Record<string, number>; matching: number; review: { total: number; verified: number; remaining: number }; items: Row[] };
type Subject = { id: string; name: string; topics: { id: string; name: string }[] };
type Draft = { id?: string; topicId: string; text: string; options: string[]; correct: number; explanation: string; superKey: string; difficulty: string; status: string; sourceRef: string; kind: string; skill: string; reports?: { id: string; reason: string }[]; source?: string };

const STATUS: Record<string, string> = { DRAFT: "Qoralama", REVIEW: "Tekshiruvda", APPROVED: "Tasdiqlangan", REJECTED: "Rad etilgan", ARCHIVED: "Arxiv" };
const TONE = { DRAFT: "neutral", REVIEW: "amber", APPROVED: "success", REJECTED: "danger", ARCHIVED: "neutral" } as const;
const DIFF: Record<string, string> = { EASY: "Oson", MEDIUM: "O'rta", HARD: "Qiyin" };
const SOURCE: Record<string, string> = { MANUAL: "Admin kiritgan", AI: "AI yaratgan", SAMPLE: "Namunaviy" };
const blank = (topicId: string): Draft => ({ topicId, text: "", options: ["", "", "", ""], correct: 0, explanation: "", superKey: "", difficulty: "MEDIUM", status: "DRAFT", sourceRef: "", kind: "CLASSIC", skill: "" });

export default function Page() {
  const toast = useToast();
  const [list, setList] = React.useState<List | null>(null);
  const [subjects, setSubjects] = React.useState<Subject[]>([]);
  const [err, setErr] = React.useState("");
  const [status, setStatus] = React.useState("");
  const [source, setSource] = React.useState("");
  const [topicId, setTopicId] = React.useState("");
  const [q, setQ] = React.useState("");
  const [verified, setVerified] = React.useState("");
  const [sel, setSel] = React.useState<Set<string>>(new Set());
  const [allMode, setAllMode] = React.useState(false);
  const [bulkBusy, setBulkBusy] = React.useState(false);
  const [draft, setDraft] = React.useState<Draft | null>(null);
  const [formErr, setFormErr] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  const load = React.useCallback(async () => {
    const qs = new URLSearchParams(Object.entries({ status, source, topicId, q, verified }).filter(([, v]) => v));
    const r = await api<List>(`/api/admin/qbank?${qs}`);
    if (r.ok) { setList(r.data); setErr(""); } else setErr(r.error);
  }, [status, source, topicId, q, verified]);
  React.useEffect(() => { const t = setTimeout(() => void load(), q ? 300 : 0); return () => clearTimeout(t); }, [load, q]);
  React.useEffect(() => { void api<{ subjects: Subject[] }>("/api/admin/subjects").then((r) => { if (r.ok) setSubjects(r.data.subjects); }); }, []);

  // Filtr o'zgarsa, belgilash tozalanadi: aks holda ko'rinmayotgan savollar tasdiqlanib ketishi mumkin.
  React.useEffect(() => { setSel(new Set()); setAllMode(false); }, [status, source, topicId, q, verified]);
  const items = list?.items ?? [];
  const allVisible = items.length > 0 && items.every((r) => allMode || sel.has(r.id));
  const count = allMode ? (list?.matching ?? 0) : sel.size;
  const toggleRow = (id: string) => {
    if (allMode) { setAllMode(false); setSel(new Set(items.filter((r) => r.id !== id).map((r) => r.id))); return; }
    setSel((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  };
  const toggleAll = () => { if (allVisible) { setSel(new Set()); setAllMode(false); } else setSel(new Set(items.map((r) => r.id))); };
  const clearSel = () => { setSel(new Set()); setAllMode(false); };
  const bulkApprove = async () => {
    if (!list || count === 0) return;
    if (!window.confirm(`${count} ta savol «Tasdiqlangan» va «Tekshirilgan» deb belgilansinmi?\n\nTasdiqlangan savollar o'quvchilarga mashqda ko'rinadi. Faqat ularni tekshirib chiqqan bo'lsangiz davom eting.`)) return;
    setBulkBusy(true);
    const filter = Object.fromEntries(Object.entries({ status, source, topicId, q, verified }).filter(([, v]) => v));
    const r = await api<{ updated: number }>("/api/admin/qbank/bulk", "POST", allMode ? { all: true, filter } : { ids: [...sel] });
    setBulkBusy(false);
    if (r.ok) { toast("success", `${r.data.updated} ta savol tasdiqlandi.`); clearSel(); void load(); } else toast("error", r.error);
  };

  const firstTopic = subjects.flatMap((s) => s.topics)[0]?.id ?? "";
  const total = list ? Object.values(list.counts).reduce((a, b) => a + b, 0) : 0;

  const edit = async (id: string) => {
    const r = await api<Draft & { options: string[] }>(`/api/admin/qbank/${id}`);
    if (!r.ok) { toast("error", r.error); return; }
    setFormErr(""); setDraft({ ...r.data, options: r.data.options.length >= 2 ? r.data.options : ["", ""] });
  };
  const save = async () => {
    if (!draft) return;
    setSaving(true); setFormErr("");
    const body = { topicId: draft.topicId, text: draft.text, options: draft.options.map((o) => o.trim()).filter(Boolean), correct: draft.correct, explanation: draft.explanation, superKey: draft.superKey, difficulty: draft.difficulty, status: draft.status, sourceRef: draft.sourceRef, kind: draft.kind, skill: draft.skill };
    // Bo'sh variantlar olib tashlanganda to'g'ri variant indeksi ham siljiydi.
    const kept = draft.options.map((o, i) => [o.trim(), i] as const).filter(([o]) => o);
    body.correct = Math.max(0, kept.findIndex(([, i]) => i === draft.correct));
    const r = draft.id ? await api(`/api/admin/qbank/${draft.id}`, "PUT", body) : await api("/api/admin/qbank", "POST", body);
    setSaving(false);
    if (!r.ok) { setFormErr(r.error); return; }
    toast("success", draft.id ? "Savol saqlandi." : "Savol qo'shildi."); setDraft(null); void load();
  };
  const changeStatus = async (id: string, s: string) => {
    const r = await api(`/api/admin/qbank/${id}`, "PATCH", { status: s });
    if (r.ok) { toast("success", `Holat: ${STATUS[s]}`); void load(); } else toast("error", r.error);
  };
  const remove = async (row: Row) => {
    if (!window.confirm(`«${row.text.slice(0, 60)}» savolini o'chirasizmi?`)) return;
    const r = await api<{ archived: boolean }>(`/api/admin/qbank/${row.id}`, "DELETE");
    if (r.ok) { toast("success", r.data.archived ? "Savolga foydalanuvchi javoblari bog'langan: arxivga olindi." : "Savol o'chirildi."); void load(); } else toast("error", r.error);
  };
  const setOpt = (i: number, v: string) => setDraft((d) => d && ({ ...d, options: d.options.map((o, k) => (k === i ? v : o)) }));

  return (
    <>
      <PageHeader module={adminModule} title="Savollar banki" description="Mashq (Bilim laboratoriyasi) savollari: faqat «Tasdiqlangan» savollar o'quvchilarga ko'rinadi"
        actions={<Button onClick={() => { setFormErr(""); setDraft(blank(topicId || firstTopic)); }} disabled={subjects.length === 0}><Plus className="h-4 w-4" />Savol qo'shish</Button>} />
      {err && <p role="alert" className="mb-4 rounded-xl bg-danger/10 p-3 text-sm text-danger">{err}</p>}
      <p className="mb-4 rounded-xl bg-primary/5 p-3 text-sm text-muted-foreground">AI yaratgan savollar «Qoralama» holatida keladi va hech qachon o'z-o'zidan tasdiqlanmaydi. Tekshirib, ma'qul bo'lsa «Tasdiqlangan» qiling. Namunaviy savollar ekspert tekshirmagan.</p>

      {list && (
        <Card className="mb-4 flex flex-wrap items-center justify-between gap-3 border-primary/30 p-4">
          <div className="min-w-0">
            <p className="font-extrabold">Savollarni bitalab tekshirish</p>
            <p className="text-sm text-muted-foreground"><b className="text-foreground">{list.review.verified}</b> / {list.review.total} savol tekshirilgan, <b className="text-foreground">{list.review.remaining}</b> tasi qoldi. Har birini o'qib, tasdiqlaysiz, tuzatasiz yoki rad etasiz.</p>
          </div>
          <Button asChild disabled={list.review.remaining === 0}><Link href="/admin/savollar/tekshiruv"><ClipboardCheck className="h-4 w-4" aria-hidden />{list.review.remaining === 0 ? "Hammasi tekshirilgan" : "Tekshirishni boshlash"}</Link></Button>
        </Card>
      )}

      <div className="mb-3 flex flex-wrap gap-2" role="tablist" aria-label="Holat bo'yicha">
        {[["", `Hammasi`, total], ...Object.entries(STATUS).map(([k, v]) => [k, v, list?.counts[k] ?? 0] as const)].map(([k, label, n]) => (
          <button key={String(k)} type="button" role="tab" aria-selected={status === k} onClick={() => setStatus(String(k))}
            className={cn("h-10 rounded-full border px-4 text-sm font-semibold transition-colors", status === k ? "border-primary bg-primary text-white" : "border-border bg-card hover:bg-muted")}>{label} <span className="opacity-70">{n}</span></button>
        ))}
      </div>
      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Select value={verified} onChange={(e) => setVerified(e.target.value)} aria-label="Tekshiruv"><option value="">Tekshiruv: hammasi</option><option value="0">Tekshirilmagan</option><option value="1">Tekshirilgan</option></Select>
        <Select value={source} onChange={(e) => setSource(e.target.value)} aria-label="Manba"><option value="">Barcha manbalar</option>{Object.entries(SOURCE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select>
        <Select value={topicId} onChange={(e) => setTopicId(e.target.value)} aria-label="Mavzu"><option value="">Barcha mavzular</option>{subjects.map((s) => <optgroup key={s.id} label={s.name}>{s.topics.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</optgroup>)}</Select>
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Savol matnidan qidirish..." aria-label="Qidirish" maxLength={100} />
      </div>

      {list && items.length > 0 && (
        count > 0 ? (
          <div className="sticky top-16 z-10 mb-3 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-primary/40 bg-card p-3 shadow-soft" role="region" aria-label="Belgilangan savollar">
            <p className="text-sm">
              <b className="text-base">{count}</b> ta savol belgilandi{allMode && " (filtrga mos hammasi)"}
              {!allMode && allVisible && list.matching > items.length && <> · <button type="button" onClick={() => setAllMode(true)} className="font-semibold text-primary underline-offset-2 hover:underline">Filtrga mos hamma {list.matching} tasini belgilash</button></>}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button variant="ghost" onClick={clearSel} disabled={bulkBusy}>Belgini olib tashlash</Button>
              <Button variant="success" loading={bulkBusy} onClick={() => void bulkApprove()}><CheckCircle2 className="h-4 w-4" aria-hidden />Belgilanganlarni tasdiqlash</Button>
            </div>
          </div>
        ) : (
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-muted-foreground">Bir nechta savolni birdan tasdiqlash uchun ularni belgilang.</p>
            <Button variant="outline" onClick={() => setAllMode(true)}><CheckSquare className="h-4 w-4" aria-hidden />Hammasini belgilash ({list.matching})</Button>
          </div>
        )
      )}

      <Card>
        {!list ? <p className="p-6 text-sm text-muted-foreground">Yuklanmoqda...</p> : list.items.length === 0 ? <div className="p-4"><EmptyState title="Savollar yo'q" text="Bu filtrga mos savol topilmadi. Yangi savol qo'shing." /></div> : (
          <Table className="min-w-[900px]"><thead><tr><Th className="w-10"><input type="checkbox" checked={allVisible} onChange={toggleAll} className="h-5 w-5 accent-[hsl(var(--primary))]" aria-label="Ko'ringan hamma savollarni belgilash" /></Th><Th>Savol</Th><Th>Mavzu</Th><Th>Qiyinlik</Th><Th>Manba</Th><Th>Holat</Th><Th><span className="sr-only">Amallar</span></Th></tr></thead><tbody>
            {list.items.map((r) => (
              <tr key={r.id} className={cn((allMode || sel.has(r.id)) && "bg-primary/5")}>
                <Td className="w-10"><input type="checkbox" checked={allMode || sel.has(r.id)} onChange={() => toggleRow(r.id)} className="h-5 w-5 accent-[hsl(var(--primary))]" aria-label={`Belgilash: ${r.text.slice(0, 40)}`} /></Td>
                <Td className="max-w-[320px]"><p className="line-clamp-2 font-semibold">{r.text}</p>{r.kind === "SITUATIONAL" && <Badge variant="blue" className="mr-1 mt-1">Vaziyatli</Badge>}{r.skill && <span className="mt-1 mr-1 inline-block text-xs text-muted-foreground">{r.skill}</span>}{r.verified ? <Badge variant="success" className="mr-1 mt-1">Tekshirilgan</Badge> : !r.sample && <Badge variant="neutral" className="mr-1 mt-1">Tekshirilmagan</Badge>}{r.reports > 0 && <Badge variant="danger" className="mt-1"><Flag className="h-3 w-3" aria-hidden />{r.reports} ta xato xabari</Badge>}</Td>
                <Td><p>{r.topic}</p><p className="text-xs text-muted-foreground">{r.subject}</p></Td>
                <Td>{DIFF[r.difficulty]}</Td>
                <Td><Badge variant={r.source === "AI" ? "blue" : "neutral"}>{SOURCE[r.source] ?? r.source}</Badge></Td>
                <Td><Select className="h-9 w-40" value={r.status} onChange={(e) => void changeStatus(r.id, e.target.value)} aria-label={`Holat: ${r.text.slice(0, 30)}`}>{Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select></Td>
                <Td><span className="flex justify-end gap-1">
                  <Button variant="ghost" size="icon" aria-label="Tahrirlash" onClick={() => void edit(r.id)}><Pencil className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" aria-label="O'chirish" onClick={() => void remove(r)}><Trash2 className="h-4 w-4 text-danger" /></Button></span></Td>
              </tr>
            ))}
          </tbody></Table>
        )}
      </Card>
      {list && list.items.length >= 200 && <p className="mt-2 text-xs text-muted-foreground">Eng so'nggi 200 ta savol ko'rsatilmoqda. Qidiruv yoki filtrdan foydalaning.</p>}

      <Dialog open={!!draft} onOpenChange={(o) => { if (!o) setDraft(null); }}>
        <DialogContent title={draft?.id ? "Savolni tahrirlash" : "Yangi savol"} description="Savol mavzuga biriktiriladi. To'g'ri variantni belgilang va sodda izoh yozing." className="max-h-[92vh] max-w-2xl overflow-y-auto">
          {draft && (
            <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); void save(); }}>
              <div className="grid gap-3 sm:grid-cols-3">
                <Field label="Mavzu" className="sm:col-span-3"><Select value={draft.topicId} onChange={(e) => setDraft({ ...draft, topicId: e.target.value })} required>{subjects.map((s) => <optgroup key={s.id} label={s.name}>{s.topics.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</optgroup>)}</Select></Field>
              </div>
              <Field label="Savol matni"><Textarea value={draft.text} onChange={(e) => setDraft({ ...draft, text: e.target.value })} maxLength={1000} required /></Field>
              <fieldset>
                <legend className="mb-1.5 text-sm font-semibold">Variantlar <span className="font-normal text-muted-foreground">(to'g'ri variantni doira bilan belgilang)</span></legend>
                <div className="space-y-2">
                  {draft.options.map((o, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <input type="radio" name="correct" checked={draft.correct === i} onChange={() => setDraft({ ...draft, correct: i })} className="h-5 w-5 shrink-0 accent-[hsl(var(--success))]" aria-label={`${i + 1}-variant to'g'ri`} />
                      <Input value={o} onChange={(e) => setOpt(i, e.target.value)} placeholder={`${String.fromCharCode(65 + i)} variant`} maxLength={300} aria-label={`${i + 1}-variant`} />
                      {draft.options.length > 2 && <Button type="button" variant="ghost" size="icon" aria-label="Variantni olib tashlash" onClick={() => setDraft({ ...draft, options: draft.options.filter((_, k) => k !== i), correct: draft.correct === i ? 0 : draft.correct > i ? draft.correct - 1 : draft.correct })}><X className="h-4 w-4" /></Button>}
                    </div>
                  ))}
                </div>
                {draft.options.length < 6 && <Button type="button" variant="outline" size="sm" className="mt-2" onClick={() => setDraft({ ...draft, options: [...draft.options, ""] })}><Plus className="h-4 w-4" />Variant qo'shish</Button>}
              </fieldset>
              <Field label="Izoh" hint="Nega bu javob to'g'ri? 2–4 qisqa gap. Mashqda javobdan keyin ko'rsatiladi."><Textarea value={draft.explanation} onChange={(e) => setDraft({ ...draft, explanation: e.target.value })} maxLength={1500} required /></Field>
              <Field label="Super kalit (ixtiyoriy)" hint="Eslab qolish uchun bitta qisqa qoida."><Input value={draft.superKey} onChange={(e) => setDraft({ ...draft, superKey: e.target.value })} maxLength={250} /></Field>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Qiyinlik"><Select value={draft.difficulty} onChange={(e) => setDraft({ ...draft, difficulty: e.target.value })}>{Object.entries(DIFF).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select></Field>
                <Field label="Holat" hint="Faqat «Tasdiqlangan» savollar mashqda chiqadi."><Select value={draft.status} onChange={(e) => setDraft({ ...draft, status: e.target.value })}>{Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select></Field>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Savol turi" hint="Vaziyatli: dars vaziyati va to'rtta yaqin variant, bittasi eng maqbul."><Select value={draft.kind} onChange={(e) => setDraft({ ...draft, kind: e.target.value })}><option value="CLASSIC">Oddiy savol</option><option value="SITUATIONAL">Murakkab vaziyatli</option></Select></Field>
                <Field label="Ko'nikma / tushuncha (ixtiyoriy)" hint="Masalan: formativ va summativ baholashni farqlash. Xatolar testi shu bo'yicha yangi savollarni topadi."><Input value={draft.skill} onChange={(e) => setDraft({ ...draft, skill: e.target.value })} maxLength={120} /></Field>
              </div>
              <Field label="Manba (ixtiyoriy)" hint="Masalan, darslik yoki hujjat nomi. Aniq bo'lmasa, bo'sh qoldiring."><Input value={draft.sourceRef} onChange={(e) => setDraft({ ...draft, sourceRef: e.target.value })} maxLength={250} /></Field>
              {draft.source === "AI" && <p className="rounded-xl bg-primary/5 p-3 text-sm">Bu savolni AI yaratgan. Javob kaliti va izohni diqqat bilan tekshiring.</p>}
              {draft.reports && draft.reports.length > 0 && (
                <div className="rounded-xl bg-danger/5 p-3"><p className="text-sm font-bold">Foydalanuvchilar xabarlari</p><ul className="mt-1 list-disc space-y-1 pl-5 text-sm">{draft.reports.map((r) => <li key={r.id}>{r.reason}</li>)}</ul></div>
              )}
              {formErr && <p role="alert" className="rounded-xl bg-danger/10 p-3 text-sm text-danger">{formErr}</p>}
              <div className="flex justify-end gap-2"><Button type="button" variant="ghost" onClick={() => setDraft(null)}>Bekor qilish</Button><Button type="submit" loading={saving}>Saqlash</Button></div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
