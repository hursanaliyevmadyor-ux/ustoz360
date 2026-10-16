"use client";
import * as React from "react";
import { Check, Pencil, Plus, Trash2, X } from "lucide-react";
import { adminModule } from "@/lib/modules";
import { api } from "@/lib/admin-client";
import { PageHeader } from "@/components/layout/page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input, Textarea } from "@/components/ui/form";
import { EmptyState } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";

type Topic = { id: string; name: string; objectives: string[]; questionCount: number };

/** "Bu mavzuda nimalarni bilib olasiz?": har qatorga bitta maqsad (ko'pi bilan 5 ta). Bo'sh qoldirilsa, o'quvchiga ko'rsatilmaydi. */
function ObjectivesEditor({ topic, onSave }: { topic: Topic; onSave: (objectives: string[]) => Promise<boolean> }) {
  const [open, setOpen] = React.useState(false);
  const [v, setV] = React.useState(topic.objectives.join("\n"));
  const [busy, setBusy] = React.useState(false);
  return (
    <div className="mt-1.5">
      <button type="button" onClick={() => setOpen((x) => !x)} aria-expanded={open} className="text-xs font-semibold text-primary hover:underline">O'quv maqsadlari ({topic.objectives.length})</button>
      {open && (
        <div className="mt-1.5">
          <Textarea value={v} onChange={(e) => setV(e.target.value)} rows={4} maxLength={900} aria-label={`${topic.name}: o'quv maqsadlari`} placeholder={"Har qatorga bitta maqsad, masalan:\nFormativ va summativ baholashni farqlash"} />
          <Button size="sm" className="mt-2" loading={busy} onClick={async () => { setBusy(true); const ok = await onSave(v.split("\n").map((s) => s.trim()).filter(Boolean)); setBusy(false); if (ok) setOpen(false); }}>Saqlash</Button>
        </div>
      )}
    </div>
  );
}
type Subject = { id: string; name: string; topics: Topic[] };

/** Matnni joyida tahrirlash: qalam bosiladi, yoziladi, belgi bilan saqlanadi. */
function EditableName({ value, onSave, className }: { value: string; onSave: (v: string) => Promise<boolean>; className?: string }) {
  const [on, setOn] = React.useState(false); const [v, setV] = React.useState(value); const [busy, setBusy] = React.useState(false);
  if (!on) return <span className={`inline-flex min-w-0 items-center gap-1.5 ${className ?? ""}`}><span className="truncate">{value}</span><button type="button" onClick={() => { setV(value); setOn(true); }} className="rounded p-1 text-muted-foreground hover:bg-muted" aria-label="Nomini o'zgartirish"><Pencil className="h-3.5 w-3.5" /></button></span>;
  const save = async () => { if (!v.trim() || v.trim() === value) { setOn(false); return; } setBusy(true); const ok = await onSave(v.trim()); setBusy(false); if (ok) setOn(false); };
  return (
    <form className="inline-flex items-center gap-1.5" onSubmit={(e) => { e.preventDefault(); void save(); }}>
      <Input value={v} onChange={(e) => setV(e.target.value)} className="h-9 w-56" maxLength={120} autoFocus aria-label="Yangi nom" />
      <Button type="submit" size="icon" loading={busy} aria-label="Saqlash"><Check className="h-4 w-4" /></Button>
      <Button type="button" variant="ghost" size="icon" onClick={() => setOn(false)} aria-label="Bekor qilish"><X className="h-4 w-4" /></Button>
    </form>
  );
}

export default function Page() {
  const toast = useToast();
  const [subjects, setSubjects] = React.useState<Subject[] | null>(null);
  const [err, setErr] = React.useState("");
  const [newSubject, setNewSubject] = React.useState("");
  const [newTopic, setNewTopic] = React.useState<Record<string, string>>({});

  const load = React.useCallback(async () => {
    const r = await api<{ subjects: Subject[] }>("/api/admin/subjects");
    if (r.ok) setSubjects(r.data.subjects); else setErr(r.error);
  }, []);
  React.useEffect(() => { void load(); }, [load]);

  const act = async (p: Promise<{ ok: boolean; error?: string }>, okMsg: string) => {
    const r = await p; if (!r.ok) { toast("error", (r as { error: string }).error); return false; }
    toast("success", okMsg); void load(); return true;
  };

  return (
    <>
      <PageHeader module={adminModule} title="Mavzular" description="Fanlar va ularning mavzulari: savollar shu mavzularga biriktiriladi" />
      {err && <p role="alert" className="mb-4 rounded-xl bg-danger/10 p-3 text-sm text-danger">{err}</p>}

      <Card className="mb-6"><CardContent>
        <form className="flex flex-wrap gap-3" onSubmit={async (e) => { e.preventDefault(); if (await act(api("/api/admin/subjects", "POST", { name: newSubject }), "Fan qo'shildi.")) setNewSubject(""); }}>
          <Input className="min-w-[220px] flex-1" value={newSubject} onChange={(e) => setNewSubject(e.target.value)} placeholder="Yangi fan nomi (masalan: Matematika)" maxLength={120} required aria-label="Yangi fan nomi" />
          <Button type="submit"><Plus className="h-4 w-4" />Fan qo'shish</Button>
        </form>
      </CardContent></Card>

      {subjects === null && !err ? <p className="text-sm text-muted-foreground">Yuklanmoqda...</p>
        : subjects && subjects.length === 0 ? <EmptyState title="Fanlar yo'q" text="Yuqoridan birinchi fanni qo'shing." />
        : (
          <div className="grid gap-4 lg:grid-cols-2">
            {subjects?.map((s) => (
              <Card key={s.id} className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <EditableName className="text-lg font-extrabold" value={s.name} onSave={(name) => act(api(`/api/admin/subjects/${s.id}`, "PUT", { name }), "Nomi o'zgardi.")} />
                  <Button variant="ghost" size="icon" aria-label="Fanni o'chirish" onClick={() => { if (window.confirm(`«${s.name}» fanini o'chirasizmi?`)) void act(api(`/api/admin/subjects/${s.id}`, "DELETE"), "Fan o'chirildi."); }}><Trash2 className="h-4 w-4 text-danger" /></Button>
                </div>
                <ul className="mt-3 space-y-1.5">
                  {s.topics.length === 0 && <li className="text-sm text-muted-foreground">Mavzular yo'q.</li>}
                  {s.topics.map((t) => (
                    <li key={t.id} className="rounded-xl bg-muted px-3 py-2 text-sm">
                      <div className="flex items-center justify-between gap-2">
                        <EditableName value={t.name} onSave={(name) => act(api(`/api/admin/topics/${t.id}`, "PUT", { name }), "Nomi o'zgardi.")} />
                        <span className="flex shrink-0 items-center gap-2"><Badge variant="neutral">{t.questionCount} savol</Badge>
                          <button type="button" className="rounded p-1 text-muted-foreground hover:bg-card" aria-label="Mavzuni o'chirish" onClick={() => { if (window.confirm(`«${t.name}» mavzusini o'chirasizmi?`)) void act(api(`/api/admin/topics/${t.id}`, "DELETE"), "Mavzu o'chirildi."); }}><Trash2 className="h-4 w-4 text-danger" /></button></span>
                      </div>
                      <ObjectivesEditor topic={t} onSave={(objectives) => act(api(`/api/admin/topics/${t.id}`, "PATCH", { objectives }), "Maqsadlar saqlandi.")} />
                    </li>
                  ))}
                </ul>
                <form className="mt-3 flex gap-2" onSubmit={async (e) => { e.preventDefault(); if (await act(api("/api/admin/topics", "POST", { subjectId: s.id, name: newTopic[s.id] ?? "" }), "Mavzu qo'shildi.")) setNewTopic((m) => ({ ...m, [s.id]: "" })); }}>
                  <Input value={newTopic[s.id] ?? ""} onChange={(e) => setNewTopic((m) => ({ ...m, [s.id]: e.target.value }))} placeholder="Yangi mavzu nomi" maxLength={120} required aria-label={`${s.name}: yangi mavzu`} />
                  <Button type="submit" variant="outline"><Plus className="h-4 w-4" />Qo'shish</Button>
                </form>
              </Card>
            ))}
          </div>
        )}
    </>
  );
}