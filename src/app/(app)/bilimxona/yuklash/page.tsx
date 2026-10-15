"use client";
import * as React from "react";
import { UploadCloud, X } from "lucide-react";
import { modules } from "@/lib/modules";
import { PageHeader } from "@/components/layout/page";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { NoBackendNote } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";

const OK = ["pdf", "docx", "txt"]; const MAX = 20 * 1024 * 1024;
export default function Page() {
  const [files, setFiles] = React.useState<File[]>([]); const [drag, setDrag] = React.useState(false);
  const ref = React.useRef<HTMLInputElement>(null); const toast = useToast();
  const add = (list: FileList | null) => {
    if (!list) return;
    const good: File[] = [];
    Array.from(list).forEach((f) => {
      const ext = f.name.split(".").pop()?.toLowerCase() ?? "";
      if (!OK.includes(ext)) toast("error", `${f.name}: format qo'llab-quvvatlanmaydi (PDF, DOCX, TXT).`);
      else if (f.size > MAX) toast("error", `${f.name}: 20 MB dan katta.`);
      else good.push(f);
    });
    setFiles((s) => [...s, ...good]);
  };
  return (
    <>
      <PageHeader module={modules[5]} title="Fayl yuklash" description="PDF, DOCX yoki TXT (20 MB gacha)" />
      <Card className="max-w-2xl"><CardContent className="space-y-4">
        <div onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)} onDrop={(e) => { e.preventDefault(); setDrag(false); add(e.dataTransfer.files); }}
          className={`grid place-items-center rounded-2xl border-2 border-dashed p-10 text-center ${drag ? "border-primary bg-primary/5" : "border-border"}`}>
          <UploadCloud className="mb-2 h-9 w-9 text-muted-foreground" aria-hidden /><p className="font-bold">Faylni shu yerga tashlang</p>
          <Button variant="outline" className="mt-3" onClick={() => ref.current?.click()}>Fayl tanlash</Button>
          <input ref={ref} type="file" multiple accept=".pdf,.docx,.txt" className="sr-only" onChange={(e) => { add(e.target.files); e.target.value = ""; }} aria-label="Fayl tanlash" />
        </div>
        {files.length > 0 && <ul className="space-y-2">{files.map((f, i) => <li key={i} className="flex items-center justify-between rounded-xl border border-border px-3.5 py-2.5 text-sm"><span className="truncate font-semibold">{f.name}</span>
          <span className="flex items-center gap-3 text-muted-foreground">{(f.size / 1048576).toFixed(1)} MB<button aria-label="Olib tashlash" onClick={() => setFiles(files.filter((_, k) => k !== i))}><X className="h-4 w-4" /></button></span></li>)}</ul>}
        <Button disabled={!files.length} onClick={() => toast("info", "Fayllar serverga yuklanmaydi: saqlash va indekslash backend ulangach ishlaydi.")}>Yuklash</Button>
        <NoBackendNote>Fayl turi va hajmi brauzerda tekshiriladi, ammo yuklash, matn ajratish va indekslash qilinmaydi.</NoBackendNote>
      </CardContent></Card>
    </>
  );
}
