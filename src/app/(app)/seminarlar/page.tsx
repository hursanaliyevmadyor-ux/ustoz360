"use client";
import * as React from "react";
import { CalendarDays, Clock, ExternalLink, MapPin, Users } from "lucide-react";
import { PageHeader } from "@/components/layout/page";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/states";

type S = { id: string; title: string; description: string | null; speaker: string | null; startsAt: string; durationMin: number | null; place: string | null; link: string | null; capacity: number | null };

export default function Page() {
  const [rows, setRows] = React.useState<S[] | null>(null);
  const [err, setErr] = React.useState("");
  React.useEffect(() => {
    fetch("/api/seminars").then(async (r) => { const d = await r.json().catch(() => ({})); if (r.ok) setRows(d.seminars); else setErr(d.error ?? "Seminarlarni yuklab bo'lmadi."); }).catch(() => setErr("Server bilan aloqa yo'q."));
  }, []);
  return (
    <>
      <PageHeader title="Seminarlar" description="Yaqinlashayotgan seminar va tadbirlar" />
      {err && <p role="alert" className="mb-4 rounded-xl bg-danger/10 p-3 text-sm text-danger">{err}</p>}
      {rows === null && !err ? <p className="text-sm text-muted-foreground">Yuklanmoqda...</p>
        : rows && rows.length === 0 ? <EmptyState title="Hozircha seminarlar yo'q" text="Yangi seminarlar e'lon qilinganda shu yerda ko'rinadi." />
        : (
          <div className="grid gap-4 md:grid-cols-2">
            {rows?.map((s) => {
              const d = new Date(s.startsAt);
              return (
                <Card key={s.id} className="flex gap-4 p-5">
                  <div className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-primary/10 text-center text-primary" aria-hidden>
                    <span><b className="block text-2xl leading-none">{d.getDate()}</b><span className="text-xs font-semibold uppercase">{d.toLocaleString("uz-UZ", { month: "short" })}</span></span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-lg font-extrabold leading-snug">{s.title}</p>
                    {s.speaker && <p className="text-sm text-muted-foreground">{s.speaker}</p>}
                    <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                      <span className="inline-flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5" aria-hidden />{d.toLocaleString("uz-UZ", { hour: "2-digit", minute: "2-digit" })}</span>
                      {s.durationMin && <span className="inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5" aria-hidden />{s.durationMin} daqiqa</span>}
                      {s.place && <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" aria-hidden />{s.place}</span>}
                      {s.capacity && <span className="inline-flex items-center gap-1"><Users className="h-3.5 w-3.5" aria-hidden />{s.capacity} o'rin</span>}
                    </p>
                    {s.description && <p className="mt-2 whitespace-pre-wrap text-sm">{s.description}</p>}
                    {s.link && <Button asChild size="sm" className="mt-3"><a href={s.link} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-4 w-4" />Qatnashish</a></Button>}
                  </div>
                </Card>
              );
            })}
          </div>
        )}
    </>
  );
}