"use client";
import * as React from "react";
import { ExternalLink, Pencil, Plus, Trash2 } from "lucide-react";
import { adminModule } from "@/lib/modules";
import { api } from "@/lib/admin-client";
import { useQuery } from "@/lib/use-query";
import { QueryView } from "@/components/layout/query-view";
import { PageHeader } from "@/components/layout/page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { EmptyState } from "@/components/ui/states";
import { Switch } from "@/components/ui/switch";
import { Table, Td, Th } from "@/components/ui/table";
import { useToast } from "@/components/ui/toast";

type O = { id: string; kind: "LINK" | "DATE"; exam: string | null; title: string; url: string | null; date: string | null; note: string | null; sourceName: string | null; verified: boolean; verifiedAt: string | null; active: boolean };
const EXAM: Record<string, string> = { ATTESTATSIYA: "Attestatsiya", MILLIY_SERTIFIKAT: "Milliy sertifikat" };

export default function Page() {
  const toast = useToast();
  const q = useQuery<{ items: O[] }>("/api/admin/official");
  const [edit, setEdit] = React.useState<O | "new" | null>(null);
  const remove = async (o: O) => {
    if (!window.confirm(`«${o.title}» o'chirilsinmi?`)) return;
    const r = await api(`/api/admin/official/${o.id}`, "DELETE");
    if (!r.ok) { toast("error", r.error); return; }
    toast("success", "O'chirildi."); q.reload();
  };
  return (
    <>
      <PageHeader module={adminModule} title="Rasmiy ma'lumotlar" description="TOIFA NAVIGATOR uchun rasmiy havola va sanalar. Manbasiz ma'lumot «tekshirilgan» deb ko'rinmaydi"
        actions={<Button onClick={() => setEdit("new")}><Plus className="h-4 w-4" />Qo'shish</Button>} />
      <p className="mb-4 rounded-xl bg-amber/10 px-3.5 py-2.5 text-sm">Faqat rasmiy manbadan tekshirgan ma'lumotni «Tekshirilgan» deb belgilang va manba nomini yozing. Tekshirilmagan ma'lumot foydalanuvchiga «Tekshirilmagan» belgisi bilan ko'rsatiladi.</p>
      <Card>
        <QueryView q={q}>{(d) => d.items.length === 0 ? <div className="p-4"><EmptyState title="Hali ma'lumot yo'q" text="Rasmiy havola yoki imtihon sanasini manba bilan qo'shing." /></div> : (
          <Table><thead><tr><Th>Nomi</Th><Th>Imtihon</Th><Th>Sana / havola</Th><Th>Manba</Th><Th>Holat</Th><Th><span className="sr-only">Amallar</span></Th></tr></thead><tbody>
            {d.items.map((o) => (
              <tr key={o.id}>
                <Td className="font-semibold">{o.title}{o.note && <p className="text-xs font-normal text-muted-foreground">{o.note}</p>}</Td>
                <Td>{o.exam ? EXAM[o.exam] : "Umumiy"}</Td>
                <Td className="whitespace-nowrap">{o.date ?? "—"}{o.url && <a href={o.url} target="_blank" rel="noopener noreferrer" className="ml-2 inline-flex text-primary" aria-label="Havolani ochish"><ExternalLink className="h-3.5 w-3.5" /></a>}</Td>
                <Td>{o.sourceName ?? "—"}</Td>
                <Td><div className="flex flex-wrap gap-1"><Badge variant={o.verified ? "success" : "amber"}>{o.verified ? "Tekshirilgan" : "Tekshirilmagan"}</Badge>{!o.active && <Badge>Yashirin</Badge>}</div></Td>
                <Td className="whitespace-nowrap text-right"><Button variant="ghost" size="icon" aria-label="Tahrirlash" onClick={() => setEdit(o)}><Pencil className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" aria-label="O'chirish" onClick={() => remove(o)}><Trash2 className="h-4 w-4 text-danger" /></Button></Td>
              </tr>))}
          </tbody></Table>)}</QueryView>
      </Card>
      {edit && <OfficialDialog o={edit === "new" ? null : edit} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); q.reload(); }} />}
    </>
  );
}

function OfficialDialog({ o, onClose, onSaved }: { o: O | null; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [f, setF] = React.useState({ kind: o?.kind ?? "LINK", exam: o?.exam ?? "", title: o?.title ?? "", url: o?.url ?? "", date: o?.date ?? "", note: o?.note ?? "", sourceName: o?.sourceName ?? "", verified: o?.verified ?? false, active: o?.active ?? true });
  const [busy, setBusy] = React.useState(false); const [err, setErr] = React.useState("");
  const up = (k: keyof typeof f, v: string | boolean) => setF((x) => ({ ...x, [k]: v }));
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setErr("");
    const body = { kind: f.kind, exam: f.exam || null, title: f.title, url: f.url, date: f.kind === "DATE" ? f.date || null : null, note: f.note, sourceName: f.sourceName, verified: f.verified, active: f.active };
    const r = o ? await api(`/api/admin/official/${o.id}`, "PUT", body) : await api("/api/admin/official", "POST", body);
    setBusy(false);
    if (!r.ok) { setErr(r.error); return; }
    toast("success", "Saqlandi."); onSaved();
  };
  return (
    <Dialog open onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent title={o ? "Tahrirlash" : "Yangi rasmiy ma'lumot"} description="Havola yoki sana" className="max-h-[90vh] max-w-xl overflow-y-auto">
        <form onSubmit={submit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Turi"><Select value={f.kind} onChange={(e) => up("kind", e.target.value)}><option value="LINK">Havola</option><option value="DATE">Sana</option></Select></Field>
            <Field label="Imtihon"><Select value={f.exam} onChange={(e) => up("exam", e.target.value)}><option value="">Umumiy</option><option value="ATTESTATSIYA">Attestatsiya</option><option value="MILLIY_SERTIFIKAT">Milliy sertifikat</option></Select></Field>
          </div>
          <Field label="Nomi"><Input value={f.title} onChange={(e) => up("title", e.target.value)} required maxLength={200} autoFocus /></Field>
          {f.kind === "DATE" ? <Field label="Sana"><Input type="date" value={f.date} onChange={(e) => up("date", e.target.value)} required /></Field>
            : <Field label="Havola (https)"><Input type="url" value={f.url} onChange={(e) => up("url", e.target.value)} required placeholder="https://..." maxLength={500} /></Field>}
          {f.kind === "DATE" && <Field label="Manba havolasi (ixtiyoriy)"><Input type="url" value={f.url} onChange={(e) => up("url", e.target.value)} placeholder="https://..." maxLength={500} /></Field>}
          <Field label="Manba nomi" hint="Masalan: rasmiy vazirlik sayti. «Tekshirilgan» uchun majburiy"><Input value={f.sourceName} onChange={(e) => up("sourceName", e.target.value)} maxLength={160} /></Field>
          <Field label="Izoh (ixtiyoriy)"><Textarea className="min-h-16" value={f.note} onChange={(e) => up("note", e.target.value)} maxLength={500} /></Field>
          <label className="flex items-center gap-3"><Switch checked={f.verified} onCheckedChange={(v) => up("verified", v)} aria-label="Tekshirilgan" /><span className="text-sm font-semibold">Manbadan tekshirdim (tekshirilgan)</span></label>
          <label className="flex items-center gap-3"><Switch checked={f.active} onCheckedChange={(v) => up("active", v)} aria-label="Ko'rinsin" /><span className="text-sm font-semibold">Foydalanuvchilarga ko'rinsin</span></label>
          {err && <p role="alert" className="rounded-xl bg-danger/10 p-3 text-sm text-danger">{err}</p>}
          <div className="flex justify-end gap-3"><Button type="button" variant="outline" onClick={onClose}>Bekor qilish</Button><Button type="submit" loading={busy}>Saqlash</Button></div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
