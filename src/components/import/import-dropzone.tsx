"use client";
import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, CheckCircle2, FileText, History, KeyRound, Loader2, UploadCloud, X } from "lucide-react";
import { api } from "@/lib/admin-client";
import { mbText, type ImportStatusInfo } from "@/lib/import-client";
import { uploadFile, type UploadState } from "@/lib/import-upload";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

const EXT = /\.(pdf|docx|xlsx|csv|pptx|odt|ods|odp|txt|jpe?g|png|webp|doc|xls|ppt)$/i;

/**
 * Universal yuklash kartasi (USTOZ AI boshi). Fayl(lar) yuklanadi, import boshlanadi va tekshirish sahifasiga o'tiladi.
 * Eski Office formatlari (.doc, .xls, .ppt) ham tanlanadi: server tushunarli xabar bilan konvertatsiya yo'lini ko'rsatadi.
 */
export function ImportDropzone({ className }: { className?: string }) {
  const router = useRouter();
  const input = React.useRef<HTMLInputElement>(null);
  const [info, setInfo] = React.useState<ImportStatusInfo | null>(null);
  const [anon, setAnon] = React.useState(false);
  const [drag, setDrag] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [items, setItems] = React.useState<UploadState[]>([]);
  const [error, setError] = React.useState("");
  // Alohida «javoblar kaliti» fayli (ixtiyoriy): savollar fayli bilan birga yuklanadi va shu importga ulanadi.
  const keyInput = React.useRef<HTMLInputElement>(null);
  const [keyFile, setKeyFile] = React.useState<File | null>(null);

  React.useEffect(() => { void (async () => { const r = await api<ImportStatusInfo>("/api/import/status"); if (r.ok) setInfo(r.data); else if (r.status === 401) setAnon(true); })(); }, []);

  const patch = (key: string, p: Partial<UploadState>) => setItems((a) => a.map((x) => (x.key === key ? { ...x, ...p } : x)));

  const run = async (list: File[]) => {
    if (busy || !list.length) return;
    setError("");
    const maxAll = info?.maxFiles ?? 6, maxBytes = (info?.maxMb ?? 20) * 1024 * 1024;
    const max = Math.max(1, maxAll - (keyFile ? 1 : 0));
    const picked = list.slice(0, max);
    if (list.length > max) setError(`Bir vaqtda ${maxAll} tagacha fayl yuklash mumkin: qolganlari qoldirildi.`);
    const states: UploadState[] = picked.map((f, i) => ({ key: `${Date.now()}-${i}`, name: f.name, size: f.size, status: "wait", pct: 0 }));
    const keyState: UploadState | null = keyFile ? { key: `${Date.now()}-key`, name: `${keyFile.name} (javoblar kaliti)`, size: keyFile.size, status: "wait", pct: 0 } : null;
    if (keyState) states.push(keyState);
    setItems(states);
    setBusy(true);
    const created = await api<{ id: string }>("/api/import", "POST", { title: picked[0].name.replace(/\.[^.]+$/, "").slice(0, 100) });
    if (!created.ok) { setError(created.error); setBusy(false); setItems([]); return; }
    const sessionId = created.data.id;
    let okCount = 0;
    for (let i = 0; i < picked.length; i++) {
      const f = picked[i], st = states[i];
      if (!EXT.test(f.name)) { patch(st.key, { status: "error", error: "Bu fayl turi qo'llab-quvvatlanmaydi." }); continue; }
      if (f.size > maxBytes) { patch(st.key, { status: "error", error: `Fayl ${info?.maxMb ?? 20} MB dan oshmasin.` }); continue; }
      patch(st.key, { status: "up", pct: 0 });
      const r = await uploadFile(sessionId, f, "AUTO", (p) => patch(st.key, { pct: Math.round(p * 100) }));
      if (r.ok) { okCount++; patch(st.key, { status: "done", pct: 100, ...(r.duplicateOf && { duplicate: `Bu fayl avval ham yuklangan: «${r.duplicateOf.title}»` }) }); }
      else patch(st.key, { status: "error", error: r.error });
    }
    if (okCount === 0) { setBusy(false); await api(`/api/import/${sessionId}`, "DELETE"); return; }
    // Javoblar kaliti: xato bo'lsa import to'xtamaydi (savollar baribir ajratiladi), kalitni keyin sahifada qo'shish mumkin.
    if (keyFile && keyState) {
      if (!EXT.test(keyFile.name)) patch(keyState.key, { status: "error", error: "Kalit fayli turi qo'llab-quvvatlanmaydi." });
      else if (keyFile.size > maxBytes) patch(keyState.key, { status: "error", error: `Kalit fayli ${info?.maxMb ?? 20} MB dan oshmasin.` });
      else {
        patch(keyState.key, { status: "up", pct: 0 });
        const kr = await uploadFile(sessionId, keyFile, "ANSWERS", (p) => patch(keyState.key, { pct: Math.round(p * 100) }));
        if (kr.ok) patch(keyState.key, { status: "done", pct: 100 });
        else patch(keyState.key, { status: "error", error: `${kr.error} Kalitni keyin import sahifasida qo'shishingiz mumkin.` });
      }
    }
    const started = await api(`/api/import/${sessionId}/start`, "POST", {});
    if (!started.ok) { setError(started.error); setBusy(false); return; }
    router.push(`/ustoz-ai/import/${sessionId}`);
  };

  const onFiles = (fl: FileList | null) => { if (fl && fl.length) void run([...fl]); if (input.current) input.current.value = ""; };
  const onKey = (fl: FileList | null) => { const f = fl?.[0] ?? null; if (keyInput.current) keyInput.current.value = ""; if (f) { setKeyFile(f); setError(""); } };
  const disabled = busy || anon || (info !== null && !info.storage.configured);

  return (
    <Card className={cn("overflow-hidden border-primary/30", className)}>
      <div className="grid gap-5 p-5 lg:grid-cols-[1fr_1.1fr] lg:items-center">
        <div>
          <h2 className="text-xl font-extrabold tracking-tight sm:text-2xl">Nimani o'rganmoqchisiz?</h2>
          <p className="mt-1.5 text-sm text-muted-foreground">Test, darslik yoki material yuklang. Ustoz AI uni tahlil qilib, sizga kerakli mashqlarga aylantiradi.</p>
          <p className="mt-3 text-xs text-muted-foreground"><b className="text-foreground">Formatlar:</b> {info?.formats ?? "PDF, DOCX, XLSX/CSV, PPTX, ODT/ODS/ODP, TXT, JPG/PNG/WEBP"}. {info ? `Har biri ${info.maxMb} MB gacha, ${info.maxFiles} tagacha fayl.` : ""} Eski .doc/.xls/.ppt formatlarini yangi formatga o'tkazib yuklang.</p>
          <Button asChild variant="ghost" size="sm" className="mt-2 -ml-2"><Link href="/ustoz-ai/import"><History className="h-4 w-4" aria-hidden />Oldingi yuklashlarim</Link></Button>
        </div>

        <div>
          <label
            onDragOver={(e) => { e.preventDefault(); if (!disabled) setDrag(true); }} onDragLeave={() => setDrag(false)}
            onDrop={(e) => { e.preventDefault(); setDrag(false); if (!disabled) onFiles(e.dataTransfer.files); }}
            className={cn("flex min-h-[150px] cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-4 py-6 text-center transition-colors", drag ? "border-primary bg-primary/10" : "border-border bg-muted/40 hover:border-primary/50", disabled && "cursor-not-allowed opacity-70")}
          >
            <input ref={input} type="file" multiple className="sr-only" accept={info?.accept ?? ".pdf,.docx,.xlsx,.csv,.pptx,.odt,.ods,.odp,.txt,.jpg,.jpeg,.png,.webp"} disabled={disabled} onChange={(e) => onFiles(e.target.files)} />
            {busy ? <Loader2 className="h-8 w-8 animate-spin text-primary" aria-hidden /> : <UploadCloud className="h-8 w-8 text-primary" aria-hidden />}
            <p className="mt-2 font-bold">{busy ? "Yuklanmoqda…" : "Fayllarni shu yerga tashlang"}</p>
            <p className="text-sm text-muted-foreground">yoki</p>
            <span className="mt-1.5 inline-flex h-10 items-center rounded-xl bg-primary px-4 text-sm font-semibold text-white shadow-soft">Fayl tanlash</span>
          </label>
          <div className="mt-3 rounded-xl border border-border bg-card p-3">
            <div className="flex items-start gap-3">
              <KeyRound className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold">Javoblar kaliti <span className="font-normal text-muted-foreground">(agar bor bo&apos;lsa)</span></p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Testning javoblari alohida faylda bo&apos;lsa, shu yerga qo&apos;shing (masalan «Javoblar.docx» yoki rasmli PDF). Javob yonida izoh yoki yechim yozilgan bo&apos;lsa («1-B. Izoh: ...»), u ham savolga qo&apos;shiladi.
                  Avval kalit faylini tanlang, keyin savollar faylini tashlang. Kalit faylisiz ham yuklash mumkin: javob savol yonida yoki fayl oxirida bo&apos;lsa, o&apos;zi topiladi.
                </p>
                <input ref={keyInput} type="file" className="sr-only" aria-label="Javoblar kaliti faylini tanlash" accept={info?.accept ?? ".pdf,.docx,.xlsx,.csv,.pptx,.odt,.ods,.odp,.txt,.jpg,.jpeg,.png,.webp"} disabled={disabled} onChange={(e) => onKey(e.target.files)} />
                {keyFile ? (
                  <p className="mt-2 flex items-center gap-2 text-sm">
                    <FileText className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                    <span className="min-w-0 flex-1 truncate font-semibold">{keyFile.name}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">{mbText(keyFile.size)}</span>
                    <button type="button" disabled={busy} onClick={() => setKeyFile(null)} aria-label="Kalit faylini olib tashlash" className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50"><X className="h-4 w-4" aria-hidden /></button>
                  </p>
                ) : (
                  <Button type="button" variant="outline" size="sm" className="mt-2" disabled={disabled} onClick={() => keyInput.current?.click()}><KeyRound className="h-4 w-4" aria-hidden />Kalit faylini tanlash</Button>
                )}
                {keyFile && !busy && <p role="status" className="mt-1.5 text-xs font-semibold text-primary">Kalit tanlandi. Endi savollar faylini yuqoridagi kartaga tashlang.</p>}
              </div>
            </div>
          </div>
          {anon && <p className="mt-2 text-sm text-muted-foreground">Fayl yuklash uchun avval <Link href="/kirish" className="font-semibold text-primary hover:underline">tizimga kiring</Link>.</p>}
          {info && info.blocked.length > 0 && (
            <ul className="mt-2 space-y-1">{info.blocked.map((b) => <li key={b} className="flex items-start gap-1.5 text-xs text-muted-foreground"><AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber" aria-hidden />{b}</li>)}</ul>
          )}
          {error && <p role="alert" className="mt-2 text-sm text-danger">{error}</p>}
          {items.length > 0 && (
            <ul className="mt-3 space-y-2" aria-label="Yuklash holati">
              {items.map((it) => (
                <li key={it.key} className="rounded-xl border border-border bg-card p-2.5 text-sm">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                    <span className="min-w-0 flex-1 truncate font-semibold">{it.name}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">{mbText(it.size)}</span>
                    {it.status === "done" && <CheckCircle2 className="h-4 w-4 shrink-0 text-success" aria-label="Yuklandi" />}
                    {it.status === "error" && <AlertTriangle className="h-4 w-4 shrink-0 text-danger" aria-label="Xatolik" />}
                  </div>
                  {it.status === "up" && <Progress value={it.pct} className="mt-2 h-1.5" label={`${it.name} yuklanmoqda`} />}
                  {it.status === "error" && <p role="alert" className="mt-1 text-xs text-danger">{it.error}</p>}
                  {it.duplicate && <p className="mt-1 text-xs text-amber">{it.duplicate}</p>}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Card>
  );
}
