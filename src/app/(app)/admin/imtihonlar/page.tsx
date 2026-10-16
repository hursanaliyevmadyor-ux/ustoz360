"use client";
import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Clock, FileQuestion, Pencil, Plus } from "lucide-react";
import { adminModule } from "@/lib/modules";
import { api } from "@/lib/admin-client";
import { PageHeader } from "@/components/layout/page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Field, Input } from "@/components/ui/form";
import { EmptyState } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";

type Row = { id: string; title: string; subject: string; kind: string; durationMin: number; pickCount: number | null; active: boolean; questionCount: number; attemptCount: number };
const KIND: Record<string, string> = { TEST: "Variantli", WRITTEN: "Yozma", MIXED: "Aralash" };

export default function Page() {
  const router = useRouter(); const toast = useToast();
  const [rows, setRows] = React.useState<Row[] | null>(null);
  const [err, setErr] = React.useState("");
  const [open, setOpen] = React.useState(false);
  const [title, setTitle] = React.useState(""); const [subject, setSubject] = React.useState(""); const [dur, setDur] = React.useState("30");
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => { void api<{ exams: Row[] }>("/api/admin/exams").then((r) => (r.ok ? setRows(r.data.exams) : setErr(r.error))); }, []);

  const create = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true);
    const r = await api<{ id: string }>("/api/admin/exams", "POST", { title, subject, durationMin: Number(dur) });
    setBusy(false);
    if (!r.ok) { toast("error", r.error); return; }
    router.push(`/admin/imtihonlar/${r.data.id}`);
  };

  return (
    <>
      <PageHeader module={adminModule} title="Imtihonlar" description="Imtihon yaratish va savollarini kiritish"
        actions={<Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" />Yangi imtihon</Button>} />
      {err && <p role="alert" className="mb-4 rounded-xl bg-danger/10 p-3 text-sm text-danger">{err}</p>}
      {rows === null && !err ? <p className="text-sm text-muted-foreground">Yuklanmoqda...</p>
        : rows && rows.length === 0 ? <EmptyState title="Imtihonlar yo'q" text="«Yangi imtihon» tugmasi bilan birinchisini yarating." />
        : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {rows?.map((x) => (
              <Card key={x.id} className="flex flex-col p-5">
                <div className="flex items-start justify-between gap-3">
                  <span className="grid h-11 w-11 place-items-center rounded-xl bg-primary/10 text-primary"><FileQuestion className="h-5 w-5" aria-hidden /></span>
                  <div className="flex gap-1.5"><Badge variant="blue">{KIND[x.kind] ?? x.kind}</Badge><Badge variant={x.active ? "success" : "neutral"}>{x.active ? "Faol" : "Yashirin"}</Badge></div>
                </div>
                <p className="mt-3 text-lg font-extrabold leading-snug">{x.title}</p>
                <p className="text-sm text-muted-foreground">{x.subject}</p>
                <p className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                  <span><b className="text-foreground">{x.questionCount}</b> ta savol{x.pickCount ? ` (${x.pickCount} tasi tushadi)` : ""}</span>
                  <span className="inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5" aria-hidden />{x.durationMin} daqiqa</span>
                  <span>{x.attemptCount} ta urinish</span>
                </p>
                <div className="mt-auto pt-4"><Button asChild variant="outline" className="w-full"><Link href={`/admin/imtihonlar/${x.id}`}><Pencil className="h-4 w-4" />Tahrirlash</Link></Button></div>
              </Card>
            ))}
          </div>
        )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent title="Yangi imtihon" description="Avval umumiy ma'lumot, savollarni keyingi sahifada kiritasiz.">
          <form onSubmit={create} className="space-y-4">
            <Field label="Imtihon nomi"><Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Masalan: Matematika, 5-sinf" required maxLength={120} autoFocus /></Field>
            <Field label="Fan"><Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Masalan: Matematika" required maxLength={80} /></Field>
            <Field label="Vaqt (daqiqa)"><Input type="number" min={1} max={300} value={dur} onChange={(e) => setDur(e.target.value)} required /></Field>
            <Button type="submit" className="w-full" loading={busy}>Yaratish va savol kiritishga o'tish</Button>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
