"use client";
import * as React from "react";
import Link from "next/link";
import { Send } from "lucide-react";
import { modules } from "@/lib/modules";
import { api } from "@/lib/admin-client";
import { useQuery } from "@/lib/use-query";
import type { LibList } from "@/components/bilimxona/types";
import { PageHeader } from "@/components/layout/page";
import { useShell } from "@/components/layout/shell-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/form";
import { EmptyState } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";

type Source = { n: number; idx: number; text: string };
type Turn = { q: string; answer: string | null; grounded: boolean; sources: Source[]; note: string | null };

/** Hujjat bilan suhbat: javob faqat hujjatdan topilgan parchalarga tayanadi va manbasi ko'rsatiladi. */
export default function Page() {
  const toast = useToast(); const { pub } = useShell();
  const lib = useQuery<LibList>("/api/library?page=1");
  const ready = (lib.data?.docs ?? []).filter((d) => d.status === "READY");
  const [docId, setDocId] = React.useState("");
  const [q, setQ] = React.useState(""); const [busy, setBusy] = React.useState(false);
  const [turns, setTurns] = React.useState<Turn[]>([]);
  React.useEffect(() => { const w = new URLSearchParams(window.location.search).get("doc"); if (w) setDocId(w); }, []);
  React.useEffect(() => { if (!docId && ready.length) setDocId(ready[0].id); }, [ready.length]); // eslint-disable-line react-hooks/exhaustive-deps
  const cur = ready.find((d) => d.id === docId);

  const ask = async (e: React.FormEvent) => {
    e.preventDefault(); if (!q.trim() || !docId) return;
    setBusy(true);
    const r = await api<Omit<Turn, "q">>(`/api/library/${docId}/ask`, "POST", { question: q.trim() });
    setBusy(false);
    if (!r.ok) { toast("error", r.status === 503 ? "AI hozir ulanmagan." : r.error); return; }
    setTurns((t) => [...t, { q: q.trim(), ...r.data }]); setQ("");
  };

  return (
    <>
      <PageHeader module={modules[5]} title="Hujjat bilan suhbat" description="Savol bering: javob hujjatdagi mos joylarga tayanadi va manbasi ko'rsatiladi" />
      {lib.status === 401 && <Card className="max-w-xl"><CardContent className="space-y-3"><p className="font-bold">Avval tizimga kiring</p><Button asChild><Link href="/kirish">Kirish</Link></Button></CardContent></Card>}
      {lib.data && ready.length === 0 && <EmptyState title="Suhbatga tayyor hujjat yo'q" text="Hozircha faqat TXT va DOCX fayllar matni indekslanadi. Shunday fayl yuklang." action={<Button asChild><Link href="/bilimxona/yuklash">Fayl yuklash</Link></Button>} />}
      {ready.length > 0 && (
        <div className="max-w-3xl space-y-4">
          <Select value={docId} onChange={(e) => { setDocId(e.target.value); setTurns([]); }} aria-label="Hujjat">{ready.map((d) => <option key={d.id} value={d.id}>{d.title} ({d.type})</option>)}</Select>
          <div className="space-y-4" aria-live="polite">
            {turns.length === 0 && <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">«{cur?.title}» hujjati bo'yicha savol yozing.</p>}
            {turns.map((t, i) => (
              <div key={i} className="space-y-2">
                <p className="ml-auto w-fit max-w-[85%] rounded-2xl bg-primary px-4 py-2 text-sm text-white">{t.q}</p>
                <Card><CardContent className="space-y-3 text-sm">
                  {t.answer ? <p className="whitespace-pre-wrap">{t.answer}</p> : <p className="text-muted-foreground">{t.note}</p>}
                  {t.answer && <p className="text-xs text-muted-foreground">{pub?.aiDisclaimer ?? "AI javobi noto'g'ri bo'lishi mumkin."} Manbalarni tekshiring.</p>}
                  {t.sources.length > 0 && (
                    <details open={!t.answer}><summary className="min-h-9 cursor-pointer text-sm font-semibold">Manbalar ({t.sources.length})</summary>
                      <ol className="mt-2 space-y-2">{t.sources.map((s) => <li key={s.n} className="rounded-xl bg-muted p-3"><b>[{s.n}]</b> <span className="text-xs text-muted-foreground">({s.idx + 1}-bo'lak)</span><p className="mt-1 whitespace-pre-wrap">{s.text}</p></li>)}</ol></details>)}
                </CardContent></Card>
              </div>))}
          </div>
          <form onSubmit={ask} className="flex gap-2"><Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Savolingizni yozing" maxLength={500} aria-label="Savol" /><Button type="submit" loading={busy} disabled={!q.trim()}><Send className="h-4 w-4" />Yuborish</Button></form>
        </div>)}
    </>
  );
}
