"use client";
import * as React from "react";
import { CalendarPlus, ExternalLink, Pencil, Trash2 } from "lucide-react";
import { adminModule } from "@/lib/modules";
import { api } from "@/lib/admin-client";
import { PageHeader } from "@/components/layout/page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Field, Input, Textarea } from "@/components/ui/form";
import { EmptyState } from "@/components/ui/states";
import { Switch } from "@/components/ui/switch";
import { Table, Td, Th } from "@/components/ui/table";
import { useToast } from "@/components/ui/toast";

type S = { id: string; title: string; description: string | null; speaker: string | null; startsAt: string; durationMin: number | null; place: string | null; link: string | null; capacity: number | null; active: boolean };
const toLocalInput = (iso: string) => { const d = new Date(iso); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16); };
const fmt = (iso: string) => new Date(iso).toLocaleString("uz-UZ", { day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" });
const empty = { title: "", description: "", speaker: "", startsAt: "", durationMin: "", place: "", link: "", capacity: "", active: true };

export default function Page() {
  const toast = useToast();
  const [rows, setRows] = React.useState<S[] | null>(null);
  const [err, setErr] = React.useState("");
  const [editing, setEditing] = React.useState<S | "new" | null>(null);
  const load = React.useCallback(async () => { const r = await api<{ seminars: S[] }>("/api/admin/seminars"); if (r.ok) setRows(r.data.seminars); else setErr(r.error); }, []);
  React.useEffect(() => { void load(); }, [load]);

  const remove = async (s: S) => {
    if (!window.confirm(`«${s.title}» seminarini o'chirasizmi?`)) return;
    const r = await api(`/api/admin/seminars/${s.id}`, "DELETE");
    if (!r.ok) { toast("error", r.error); return; }
    toast("success", "Seminar o'chirildi."); void load();
  };

  return (
    <>
      <PageHeader module={adminModule} title="Seminarlar" description="Saytdagi «Seminarlar» sahifasida ko'rinadigan tadbirlar"
        actions={<Button onClick={() => setEditing("new")}><CalendarPlus className="h-4 w-4" />Seminar qo'shish</Button>} />
      {err && <p role="alert" className="mb-4 rounded-xl bg-danger/10 p-3 text-sm text-danger">{err}</p>}
      <Card>
        {rows === null && !err ? <p className="p-5 text-sm text-muted-foreground">Yuklanmoqda...</p>
          : rows && rows.length === 0 ? <div className="p-4"><EmptyState title="Seminarlar yo'q" text="«Seminar qo'shish» tugmasi bilan birinchisini kiriting." /></div>
          : (
            <Table><thead><tr><Th>Seminar</Th><Th>Sana va vaqt</Th><Th>Joy</Th><Th>Holat</Th><Th><span className="sr-only">Amallar</span></Th></tr></thead><tbody>
              {rows?.map((s) => (
                <tr key={s.id}>
                  <Td><p className="font-semibold">{s.title}</p>{s.speaker && <p className="text-xs text-muted-foreground">{s.speaker}</p>}</Td>
                  <Td className="whitespace-nowrap">{fmt(s.startsAt)}</Td>
                  <Td>{s.place ?? "—"}{s.link && <a href={s.link} target="_blank" rel="noopener noreferrer" className="ml-2 inline-flex text-primary" aria-label="Havolani ochish"><ExternalLink className="h-3.5 w-3.5" /></a>}</Td>
                  <Td><Badge variant={s.active ? "success" : "neutral"}>{s.active ? "Ko'rinadi" : "Yashirin"}</Badge></Td>
                  <Td className="whitespace-nowrap text-right">
                    <Button variant="ghost" size="icon" aria-label="Tahrirlash" onClick={() => setEditing(s)}><Pencil className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" aria-label="O'chirish" onClick={() => remove(s)}><Trash2 className="h-4 w-4 text-danger" /></Button>
                  </Td>
                </tr>
              ))}
            </tbody></Table>
          )}
      </Card>
      {editing && <SeminarDialog s={editing === "new" ? null : editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); void load(); }} />}
    </>
  );
}

function SeminarDialog({ s, onClose, onSaved }: { s: S | null; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [f, setF] = React.useState(s ? { title: s.title, description: s.description ?? "", speaker: s.speaker ?? "", startsAt: toLocalInput(s.startsAt), durationMin: s.durationMin ? String(s.durationMin) : "", place: s.place ?? "", link: s.link ?? "", capacity: s.capacity ? String(s.capacity) : "", active: s.active } : empty);
  const [busy, setBusy] = React.useState(false); const [err, setErr] = React.useState("");
  const up = (k: keyof typeof empty, v: string | boolean) => setF((x) => ({ ...x, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setErr(""); setBusy(true);
    const body = {
      title: f.title, description: f.description, speaker: f.speaker, startsAt: new Date(f.startsAt).toISOString(),
      durationMin: f.durationMin ? Number(f.durationMin) : null, place: f.place, link: f.link, capacity: f.capacity ? Number(f.capacity) : null, active: f.active,
    };
    const r = s ? await api(`/api/admin/seminars/${s.id}`, "PUT", body) : await api("/api/admin/seminars", "POST", body);
    setBusy(false);
    if (!r.ok) { setErr(r.error); return; }
    toast("success", s ? "Seminar yangilandi." : "Seminar qo'shildi."); onSaved();
  };

  return (
    <Dialog open onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent title={s ? "Seminarni tahrirlash" : "Yangi seminar"} description="Ma'lumot saytdagi seminarlar sahifasida ko'rinadi." className="max-h-[90vh] max-w-xl overflow-y-auto">
        <form onSubmit={submit} className="space-y-4">
          <Field label="Seminar nomi"><Input value={f.title} onChange={(e) => up("title", e.target.value)} required maxLength={160} autoFocus /></Field>
          <Field label="Ma'ruzachi (ixtiyoriy)"><Input value={f.speaker} onChange={(e) => up("speaker", e.target.value)} maxLength={120} /></Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Boshlanish vaqti"><Input type="datetime-local" value={f.startsAt} onChange={(e) => up("startsAt", e.target.value)} required /></Field>
            <Field label="Davomiyligi, daqiqa (ixtiyoriy)"><Input type="number" min={5} max={1440} value={f.durationMin} onChange={(e) => up("durationMin", e.target.value)} /></Field>
          </div>
          <Field label="Joy yoki platforma (ixtiyoriy)"><Input value={f.place} onChange={(e) => up("place", e.target.value)} placeholder="Masalan: Toshkent, 5-maktab yoki Zoom" maxLength={200} /></Field>
          <Field label="Qatnashish havolasi (ixtiyoriy)"><Input type="url" value={f.link} onChange={(e) => up("link", e.target.value)} placeholder="https://..." maxLength={500} /></Field>
          <Field label="O'rinlar soni (ixtiyoriy)"><Input type="number" min={1} value={f.capacity} onChange={(e) => up("capacity", e.target.value)} /></Field>
          <Field label="Tavsif (ixtiyoriy)"><Textarea value={f.description} onChange={(e) => up("description", e.target.value)} maxLength={4000} /></Field>
          <label className="flex items-center gap-3"><Switch checked={f.active} onCheckedChange={(v) => up("active", v)} aria-label="Saytda ko'rinsin" /><span className="text-sm font-semibold">Saytda ko'rinsin</span></label>
          {err && <p role="alert" className="rounded-xl bg-danger/10 p-3 text-sm text-danger">{err}</p>}
          <div className="flex justify-end gap-3"><Button type="button" variant="outline" onClick={onClose}>Bekor qilish</Button><Button type="submit" loading={busy}>Saqlash</Button></div>
        </form>
      </DialogContent>
    </Dialog>
  );
}