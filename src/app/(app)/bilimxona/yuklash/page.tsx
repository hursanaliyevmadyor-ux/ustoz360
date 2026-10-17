"use client";
import * as React from "react";
import Link from "next/link";
import { Upload } from "lucide-react";
import { modules } from "@/lib/modules";
import { useQuery } from "@/lib/use-query";
import { mb, type LibList } from "@/components/bilimxona/types";
import { PageHeader } from "@/components/layout/page";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/form";
import { useToast } from "@/components/ui/toast";

const MAX = 5 * 1024 * 1024;
const OK = /\.(pdf|docx|txt)$/i;

export default function Page() {
  const toast = useToast();
  const state = useQuery<LibList>("/api/library?page=1");
  const [file, setFile] = React.useState<File | null>(null);
  const [f, setF] = React.useState({ title: "", subject: "", tags: "" });
  const [busy, setBusy] = React.useState(false); const [err, setErr] = React.useState("");
  const [done, setDone] = React.useState<{ indexed: boolean } | null>(null);
  const storageOk = state.data?.storage.configured ?? true;

  const pick = (x: File | null) => {
    setErr(""); setDone(null);
    if (!x) { setFile(null); return; }
    if (!OK.test(x.name)) { setErr("Faqat PDF, DOCX yoki TXT fayl yuklash mumkin."); setFile(null); return; }
    if (x.size > MAX) { setErr(`Fayl ${mb(MAX)} dan oshmasin (sizniki ${mb(x.size)}).`); setFile(null); return; }
    setFile(x); if (!f.title) setF((s) => ({ ...s, title: x.name.replace(/\.[^.]+$/, "") }));
  };
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); if (!file) return;
    setBusy(true); setErr("");
    const fd = new FormData(); fd.append("file", file); fd.append("title", f.title); fd.append("subject", f.subject); fd.append("tags", f.tags);
    try {
      const r = await fetch("/api/library", { method: "POST", body: fd });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) setErr(r.status === 401 ? "Yuklash uchun avval tizimga kiring." : d.error ?? "Yuklab bo'lmadi.");
      else { setDone({ indexed: d.indexed }); toast("success", "Fayl yuklandi."); setFile(null); setF({ title: "", subject: "", tags: "" }); }
    } catch { setErr("Server bilan aloqa yo'q. Qayta urinib ko'ring."); }
    setBusy(false);
  };

  return (
    <>
      <PageHeader module={modules[5]} title="Fayl yuklash" description="PDF, DOCX yoki TXT, 5 MB gacha. Fayl avval faqat sizga ko'rinadi" />
      {!storageOk && <p className="mb-4 max-w-2xl rounded-xl bg-amber/10 px-3.5 py-2.5 text-sm">Fayl saqlash xizmati ulanmagan, shuning uchun yuklash hozircha o'chirilgan. Administrator «Sozlamalar → Ulanishlar» bo'limida kerakli sozlamani ko'radi.</p>}
      <Card className="max-w-2xl"><CardContent>
        <form onSubmit={submit} className="space-y-4">
          <Field label="Fayl" hint="PDF, DOCX yoki TXT. Matn indekslash hozircha faqat TXT va DOCX uchun (hujjat bilan suhbat uchun)">
            <input type="file" accept=".pdf,.docx,.txt" disabled={!storageOk || busy} onChange={(e) => pick(e.target.files?.[0] ?? null)}
              className="block min-h-11 w-full rounded-xl border border-dashed border-border bg-card p-3 text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-white" />
          </Field>
          {file && <p className="text-sm text-muted-foreground">{file.name} · {mb(file.size)}</p>}
          <Field label="Nomi"><Input value={f.title} maxLength={160} required onChange={(e) => setF({ ...f, title: e.target.value })} /></Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Fan (ixtiyoriy)"><Input value={f.subject} maxLength={60} onChange={(e) => setF({ ...f, subject: e.target.value })} /></Field>
            <Field label="Teglar (vergul bilan)"><Input value={f.tags} maxLength={200} placeholder="baholash, metodika" onChange={(e) => setF({ ...f, tags: e.target.value })} /></Field>
          </div>
          {err && <p role="alert" className="rounded-xl bg-danger/10 p-3 text-sm text-danger">{err}</p>}
          {done && <p role="status" className="rounded-xl bg-success/10 p-3 text-sm">Yuklandi. {done.indexed ? "Matn indekslandi: endi hujjat bilan suhbatlashish mumkin." : "Bu fayl turi hozircha indekslanmaydi (faqat saqlandi)."} <Link href="/bilimxona" className="font-semibold underline">Kutubxonaga o'tish</Link></p>}
          <Button type="submit" loading={busy} disabled={!file || !storageOk}><Upload className="h-4 w-4" />Yuklash</Button>
        </form>
      </CardContent></Card>
    </>
  );
}
