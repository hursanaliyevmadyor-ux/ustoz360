"use client";
import * as React from "react";
import Link from "next/link";
import { BookCopy, DollarSign, Pencil, Plus, Send, Trash2, Users } from "lucide-react";
import { modules } from "@/lib/modules";
import { api } from "@/lib/admin-client";
import { fmtUzs } from "@/lib/plans";
import { COURSE_KINDS } from "@/server/marketvalid";
import { PageHeader, StatCard } from "@/components/layout/page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";

type C = { id: string; title: string; description: string; subject: string; kind: string; priceUzs: number; lessonCount: number; accessUrl: string | null; status: string; rejectReason: string | null; sales: number };
type Data = { courses: C[]; stats: { courses: number; sales: number; revenue: number } };
const ST: Record<string, { t: string; v: "neutral" | "amber" | "success" | "danger" }> = {
  DRAFT: { t: "Qoralama", v: "neutral" }, REVIEW: { t: "Tekshiruvda", v: "amber" }, APPROVED: { t: "Tasdiqlangan", v: "success" }, REJECTED: { t: "Rad etilgan", v: "danger" }, ARCHIVED: { t: "Arxiv", v: "neutral" },
};

export default function Page() {
  const toast = useToast();
  const [state, setState] = React.useState<{ s: "loading" } | { s: "anon" } | { s: "noauthor" } | { s: "error"; msg: string } | { s: "ok"; d: Data }>({ s: "loading" });
  const [edit, setEdit] = React.useState<C | "new" | null>(null);
  const [busy, setBusy] = React.useState("");
  const load = React.useCallback(async () => {
    const r = await api<Data>("/api/market/author");
    if (r.ok) setState({ s: "ok", d: r.data });
    else if (r.status === 401) setState({ s: "anon" });
    else if (r.status === 403) setState({ s: "noauthor" });
    else setState({ s: "error", msg: r.error });
  }, []);
  React.useEffect(() => { void load(); }, [load]);

  const submit = async (c: C) => {
    setBusy(c.id); const r = await api(`/api/market/author/${c.id}/submit`, "POST"); setBusy("");
    if (!r.ok) { toast("error", r.error); return; }
    toast("success", "Kurs tekshiruvga yuborildi. Tasdiqlansa katalogda ko'rinadi."); void load();
  };
  const remove = async (c: C) => {
    if (!window.confirm(`«${c.title}» o'chirilsinmi?`)) return;
    const r = await api(`/api/market/author/${c.id}`, "DELETE");
    if (!r.ok) { toast("error", r.error); return; }
    toast("success", "Kurs o'chirildi."); void load();
  };
  const requestRole = async () => {
    setBusy("role"); const r = await api("/api/market/author-request", "POST"); setBusy("");
    if (!r.ok) { toast("error", r.error); return; }
    toast("success", "So'rov adminga yuborildi. Rol berilgach shu sahifa ochiladi.");
  };

  return (
    <>
      <PageHeader module={modules[3]} title="Muallif kabineti" description="Kurs yarating, tekshiruvga yuboring va sotuvlarni kuzating"
        actions={state.s === "ok" ? <Button onClick={() => setEdit("new")}><Plus className="h-4 w-4" />Yangi kurs</Button> : undefined} />
      {state.s === "loading" && <div className="space-y-3" aria-busy="true"><Skeleton className="h-24 w-full" /><Skeleton className="h-40 w-full" /></div>}
      {state.s === "anon" && <Card className="max-w-xl"><CardContent className="space-y-3"><p className="font-bold">Avval tizimga kiring</p><Button asChild><Link href="/kirish">Kirish</Link></Button></CardContent></Card>}
      {state.s === "error" && <ErrorState text={state.msg} onRetry={load} />}
      {state.s === "noauthor" && (
        <Card className="max-w-xl"><CardContent className="space-y-3">
          <p className="text-lg font-extrabold">Muallif bo'lish</p>
          <p className="text-sm text-muted-foreground">Kurs yaratish uchun akkauntingizda «Kurs muallifi» roli kerak. So'rov yuborsangiz, administrator ko'rib chiqib rol beradi.</p>
          <Button loading={busy === "role"} onClick={requestRole}>Muallif roli uchun so'rov yuborish</Button>
        </CardContent></Card>)}
      {state.s === "ok" && (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
            <StatCard label="Kurslar" value={String(state.d.stats.courses)} icon={BookCopy} tone="teal" />
            <StatCard label="Sotuvlar" value={String(state.d.stats.sales)} icon={Users} tone="blue" />
            <StatCard label="Tushum (to'langan)" value={fmtUzs(state.d.stats.revenue)} icon={DollarSign} tone="violet" />
          </div>
          <p className="mt-2 text-xs text-muted-foreground">Tushum — to'langan buyurtmalar yig'indisi. Platforma komissiyasi va to'lov tartibi alohida kelishiladi.</p>
          <div className="mt-6 space-y-3">
            {state.d.courses.length === 0 ? <EmptyState title="Hali kurs yo'q" text="«Yangi kurs» tugmasi bilan birinchi kursingizni yarating, so'ng tekshiruvga yuboring." />
              : state.d.courses.map((c) => (
                <Card key={c.id} className="flex flex-wrap items-start justify-between gap-3 p-5">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2"><p className="font-extrabold">{c.title}</p><Badge variant={ST[c.status]?.v}>{ST[c.status]?.t ?? c.status}</Badge></div>
                    <p className="text-sm text-muted-foreground">{c.kind} · {c.subject} · {c.priceUzs ? fmtUzs(c.priceUzs) : "Bepul"}{c.sales > 0 && ` · ${c.sales} ta sotuv`}</p>
                    {c.status === "REJECTED" && c.rejectReason && <p className="mt-1 text-sm text-danger">Rad etilgan: {c.rejectReason}</p>}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {(c.status === "DRAFT" || c.status === "REJECTED") && <Button size="sm" loading={busy === c.id} onClick={() => submit(c)}><Send className="h-4 w-4" />Tekshiruvga yuborish</Button>}
                    {c.status !== "ARCHIVED" && <Button size="sm" variant="outline" onClick={() => setEdit(c)}><Pencil className="h-4 w-4" />Tahrirlash</Button>}
                    {c.sales === 0 && <Button size="sm" variant="ghost" aria-label="O'chirish" onClick={() => remove(c)}><Trash2 className="h-4 w-4 text-danger" /></Button>}
                  </div>
                </Card>))}
          </div>
        </>)}
      {edit && <CourseDialog c={edit === "new" ? null : edit} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); void load(); }} />}
    </>
  );
}

function CourseDialog({ c, onClose, onSaved }: { c: C | null; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [f, setF] = React.useState({ title: c?.title ?? "", description: c?.description ?? "", subject: c?.subject ?? "Umumiy", kind: c?.kind ?? "Videokurs", priceUzs: String(c?.priceUzs ?? 0), lessonCount: String(c?.lessonCount ?? 0), accessUrl: c?.accessUrl ?? "" });
  const [busy, setBusy] = React.useState(false); const [err, setErr] = React.useState("");
  const up = (k: keyof typeof f, v: string) => setF((x) => ({ ...x, [k]: v }));
  const save = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setErr("");
    const body = { title: f.title, description: f.description, subject: f.subject, kind: f.kind, priceUzs: Number(f.priceUzs) || 0, lessonCount: Number(f.lessonCount) || 0, accessUrl: f.accessUrl };
    const r = c ? await api(`/api/market/author/${c.id}`, "PUT", body) : await api("/api/market/author", "POST", body);
    setBusy(false);
    if (!r.ok) { setErr(r.error); return; }
    toast("success", c?.status === "APPROVED" ? "Saqlandi. O'zgargan kurs qayta tekshiruvga tushdi." : "Saqlandi."); onSaved();
  };
  return (
    <Dialog open onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent title={c ? "Kursni tahrirlash" : "Yangi kurs"} description="Kurs qoralama sifatida saqlanadi. Tekshiruvga yuborganingizdan keyin administrator ko'radi." className="max-h-[90vh] max-w-xl overflow-y-auto">
        <form onSubmit={save} className="space-y-4">
          <Field label="Nomi"><Input value={f.title} onChange={(e) => up("title", e.target.value)} required maxLength={120} autoFocus /></Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Turi"><Select value={f.kind} onChange={(e) => up("kind", e.target.value)}>{COURSE_KINDS.map((k) => <option key={k}>{k}</option>)}</Select></Field>
            <Field label="Fan"><Input value={f.subject} onChange={(e) => up("subject", e.target.value)} required maxLength={60} /></Field>
            <Field label="Narx (so'm)" hint="0: bepul"><Input type="number" min={0} max={50000000} value={f.priceUzs} onChange={(e) => up("priceUzs", e.target.value)} /></Field>
            <Field label="Darslar soni"><Input type="number" min={0} max={1000} value={f.lessonCount} onChange={(e) => up("lessonCount", e.target.value)} /></Field>
          </div>
          <Field label="Tavsif" hint="Kamida 20 belgi"><Textarea value={f.description} onChange={(e) => up("description", e.target.value)} required maxLength={3000} /></Field>
          <Field label="Kurs materiallariga havola (https)" hint="Faqat sotib olganlarga ko'rsatiladi: video, Telegram kanal yoki papka havolasi"><Input type="url" value={f.accessUrl} onChange={(e) => up("accessUrl", e.target.value)} placeholder="https://..." maxLength={500} /></Field>
          {err && <p role="alert" className="rounded-xl bg-danger/10 p-3 text-sm text-danger">{err}</p>}
          <div className="flex justify-end gap-3"><Button type="button" variant="outline" onClick={onClose}>Bekor qilish</Button><Button type="submit" loading={busy}>Saqlash</Button></div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
