"use client";
import * as React from "react";
import { api } from "@/lib/admin-client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Field, Input, Select } from "@/components/ui/form";
import { useToast } from "@/components/ui/toast";

export function ClassDialog({ onClose, onSaved, initial, id }: { onClose: () => void; onSaved: () => void; initial?: { name: string; subject: string; grade: string | null }; id?: string }) {
  const toast = useToast();
  const [f, setF] = React.useState({ name: initial?.name ?? "", subject: initial?.subject ?? "Matematika", grade: initial?.grade ?? "3" });
  const [busy, setBusy] = React.useState(false); const [err, setErr] = React.useState("");
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setErr("");
    const r = id ? await api(`/api/sinf/${id}`, "PUT", f) : await api("/api/sinf", "POST", f);
    setBusy(false);
    if (!r.ok) { setErr(r.error); return; }
    toast("success", id ? "Sinf yangilandi." : "Sinf yaratildi."); onSaved();
  };
  return (
    <Dialog open onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent title={id ? "Sinfni tahrirlash" : "Yangi sinf"} description="Masalan: 3-A sinf, Matematika">
        <form onSubmit={submit} className="space-y-4">
          <Field label="Sinf nomi"><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} required maxLength={40} autoFocus placeholder="3-A sinf" /></Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Fan"><Input value={f.subject} onChange={(e) => setF({ ...f, subject: e.target.value })} required maxLength={60} /></Field>
            <Field label="Sinf (daraja)"><Select value={f.grade} onChange={(e) => setF({ ...f, grade: e.target.value })}>{[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((g) => <option key={g}>{g}</option>)}</Select></Field>
          </div>
          {err && <p role="alert" className="rounded-xl bg-danger/10 p-3 text-sm text-danger">{err}</p>}
          <div className="flex justify-end gap-3"><Button type="button" variant="outline" onClick={onClose}>Bekor qilish</Button><Button type="submit" loading={busy}>Saqlash</Button></div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
