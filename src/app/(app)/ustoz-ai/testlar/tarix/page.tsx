"use client";
import * as React from "react";
import Link from "next/link";
import { ArrowLeft, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select } from "@/components/ui/form";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/states";
import { call, fmtDate, fmtDuration, KIND_LABEL, sessionHref, type HistoryItem } from "@/lib/practice-client";

const DAYS = [["", "Barcha sanalar"], ["1", "Bugun"], ["7", "Oxirgi 7 kun"], ["30", "Oxirgi 30 kun"]] as const;

export default function Page() {
  const [items, setItems] = React.useState<HistoryItem[] | null>(null);
  const [err, setErr] = React.useState<{ text: string; anon: boolean } | null>(null);
  const [kind, setKind] = React.useState("");
  const [subject, setSubject] = React.useState("");
  const [days, setDays] = React.useState("");
  // Fanlar ro'yxati filtrsiz natijadan olinadi, shunda filtr tanlanganda variantlar yo'qolib qolmaydi.
  const [subjects, setSubjects] = React.useState<string[]>([]);

  const load = React.useCallback(async () => {
    setErr(null);
    const qs = new URLSearchParams(Object.entries({ kind, subject, days }).filter(([, v]) => v));
    const r = await call<{ items: HistoryItem[] }>(`/api/practice/history?${qs}`);
    if (r.ok) { setItems(r.data.items); if (!kind && !subject && !days) setSubjects([...new Set(r.data.items.flatMap((i) => i.subjects))].sort()); }
    else setErr({ text: r.error, anon: r.status === 401 });
  }, [kind, subject, days]);
  React.useEffect(() => { void load(); }, [load]);

  const kinds = [["", "Barcha rejimlar"], ...Object.entries(KIND_LABEL), ["diagnostic", "Diagnostika"]];
  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/ustoz-ai/testlar" className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" aria-hidden />Orqaga</Link>
      <h1 className="text-3xl font-extrabold tracking-tight">Mashqlar tarixi</h1>
      <p className="mt-1.5 text-muted-foreground">Faqat o'zingizning mashqlaringiz ko'rsatiladi.</p>

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <Select value={kind} onChange={(e) => setKind(e.target.value)} aria-label="Rejim">{kinds.map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select>
        <Select value={subject} onChange={(e) => setSubject(e.target.value)} aria-label="Fan"><option value="">Barcha fanlar</option>{subjects.map((s) => <option key={s} value={s}>{s}</option>)}</Select>
        <Select value={days} onChange={(e) => setDays(e.target.value)} aria-label="Sana">{DAYS.map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select>
      </div>

      <div className="mt-5">
        {err?.anon ? <EmptyState title="Tizimga kiring" text="Tarixni ko'rish uchun avval tizimga kiring." action={<Button asChild><Link href="/kirish">Kirish</Link></Button>} />
          : err ? <ErrorState text={err.text} onRetry={() => void load()} />
          : !items ? <div className="space-y-2">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-16" />)}</div>
          : items.length === 0 ? <EmptyState title="Mashq topilmadi" text={kind || subject || days ? "Bu filtrga mos mashq yo'q. Filtrni o'zgartirib ko'ring." : "Birinchi mashqni boshlang: natijalar shu yerda saqlanadi."} action={<Button asChild><Link href="/ustoz-ai/testlar">Testlar</Link></Button>} />
          : (
            <Card className="divide-y divide-border overflow-hidden">
              {items.map((h) => {
                const open = h.status === "IN_PROGRESS";
                const shown = h.kind === "diagnostic" ? h.total : (h.total || h.answered);
                const pct = shown ? Math.round((h.score / shown) * 100) : 0;
                const row = (
                  <>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-bold">{h.kindLabel}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {fmtDate(h.at)}{h.subjects.length > 0 && ` · ${h.subjects.join(", ")}`}{h.topics.length > 0 && ` · ${h.topics.slice(0, 3).join(", ")}`}{h.spentSec !== null && h.spentSec > 0 && ` · ${fmtDuration(h.spentSec)}`}
                      </span>
                    </span>
                    {open ? <Badge variant="blue">Davom ettirish</Badge>
                      : h.answered === 0 && h.kind !== "diagnostic" ? <Badge variant="neutral">Yopilgan</Badge>
                      : <Badge variant={pct >= 70 ? "success" : pct >= 50 ? "amber" : "neutral"}>{h.score} / {shown}</Badge>}
                    {h.reviewable ? <ChevronRight className="h-4 w-4 text-muted-foreground" aria-hidden /> : <span className="w-4" />}
                  </>
                );
                return h.reviewable
                  ? <Link key={h.id} href={sessionHref(h.kind, h.id)} className="flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-muted">{row}</Link>
                  : <div key={h.id} className="flex items-center gap-3 px-4 py-3.5">{row}</div>;
              })}
            </Card>
          )}
      </div>
    </div>
  );
}
