"use client";
import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Megaphone, Settings2, ShieldCheck } from "lucide-react";
import { api } from "@/lib/admin-client";
import { manageLinkFor } from "@/lib/admin-nav";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Field, Input, Textarea } from "@/components/ui/form";
import { useToast } from "@/components/ui/toast";
import { useShell } from "@/components/layout/shell-context";

type Item = { id: string; title: string; text: string; href: string; active: boolean; until: string };

/** Tezkor yangilik/e'lon: admin ustoz bo'limidan chiqmasdan bosh sahifaga e'lon qo'yadi. */
function QuickAnnouncement({ onClose }: { onClose: () => void }) {
  const toast = useToast();
  const [f, setF] = React.useState({ title: "", text: "", href: "", until: "" });
  const [busy, setBusy] = React.useState(false); const [err, setErr] = React.useState("");
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setErr("");
    const cur = await api<{ settings: { announcements: { items: Item[] } } }>("/api/admin/settings");
    if (!cur.ok) { setBusy(false); setErr(cur.error); return; }
    const items = cur.data.settings.announcements.items;
    if (items.length >= 10) { setBusy(false); setErr("E'lonlar soni 10 tadan oshmasin: eskisini o'chiring (Admin → Yangilik va e'lonlar)."); return; }
    const r = await api("/api/admin/settings", "PUT", { key: "announcements", value: { items: [{ id: Math.random().toString(36).slice(2, 10), title: f.title, text: f.text, href: f.href, active: true, until: f.until }, ...items] } });
    setBusy(false);
    if (!r.ok) { setErr(r.error); return; }
    toast("success", "E'lon bosh sahifaga qo'yildi."); onClose();
  };
  return (
    <Dialog open onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent title="Yangilik yoki e'lon qo'shish" description="Hamma ustozning bosh sahifasida ko'rinadi">
        <form onSubmit={submit} className="space-y-4">
          <Field label="Sarlavha"><Input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} required maxLength={120} autoFocus /></Field>
          <Field label="Matn (ixtiyoriy)"><Textarea className="min-h-20" value={f.text} onChange={(e) => setF({ ...f, text: e.target.value })} maxLength={500} /></Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Havola (ixtiyoriy)" hint="/seminarlar yoki https://..."><Input value={f.href} onChange={(e) => setF({ ...f, href: e.target.value })} maxLength={300} /></Field>
            <Field label="Tugash sanasi (ixtiyoriy)"><Input type="date" value={f.until} onChange={(e) => setF({ ...f, until: e.target.value })} /></Field>
          </div>
          {err && <p role="alert" className="rounded-xl bg-danger/10 p-3 text-sm text-danger">{err}</p>}
          <div className="flex justify-end gap-3"><Button type="button" variant="outline" onClick={onClose}>Bekor qilish</Button><Button type="submit" loading={busy}>Joylash</Button></div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Admin ustoz bo'limini ko'rayotganda sahifa tepasida turadigan ingichka panel. */
export function AdminBar() {
  const { isAdmin, view, setView } = useShell();
  const path = usePathname(); const router = useRouter();
  const [quick, setQuick] = React.useState(false);
  if (!isAdmin || view !== "teacher") return null;
  const manage = manageLinkFor(path);
  return (
    <div className="no-print border-b border-primary/30 bg-primary/10">
      <div className="mx-auto flex max-w-[1280px] flex-wrap items-center gap-x-3 gap-y-1 px-4 py-1.5 text-sm lg:px-8">
        <span className="flex items-center gap-1.5 font-bold text-primary"><ShieldCheck className="h-4 w-4" aria-hidden />Admin: ustoz ko'rinishi</span>
        <span className="flex-1" />
        {manage && <Button asChild size="sm" variant="ghost" className="h-9"><Link href={manage.href}><Settings2 className="h-4 w-4" />{manage.label}</Link></Button>}
        <Button size="sm" variant="ghost" className="h-9" onClick={() => setQuick(true)}><Megaphone className="h-4 w-4" />E'lon qo'shish</Button>
        <Button size="sm" className="h-9" onClick={() => { setView("admin"); router.push("/admin"); }}>Admin saytiga qaytish</Button>
      </div>
      {quick && <QuickAnnouncement onClose={() => setQuick(false)} />}
    </div>
  );
}
