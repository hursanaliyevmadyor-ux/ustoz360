"use client";
import * as React from "react";
import { Flag, Timer } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { fmtClock } from "@/lib/practice-client";

/** Taymer: server bergan qolgan soniyalardan sanaydi (sahifa yangilansa, server qayta hisoblaydi). Tugaganda onExpire chaqiriladi. */
export function TestTimer({ remainingSec, onExpire }: { remainingSec: number; onExpire: () => void }) {
  const deadline = React.useRef(Date.now() + remainingSec * 1000);
  const expire = React.useRef(onExpire);
  expire.current = onExpire;
  const [left, setLeft] = React.useState(remainingSec);
  const [said, setSaid] = React.useState("");
  React.useEffect(() => { deadline.current = Date.now() + remainingSec * 1000; setLeft(remainingSec); }, [remainingSec]);
  React.useEffect(() => {
    const t = setInterval(() => {
      const s = Math.max(0, Math.round((deadline.current - Date.now()) / 1000));
      setLeft(s);
      if (s <= 0) { clearInterval(t); expire.current(); }
    }, 500);
    return () => clearInterval(t);
  }, []);
  // Ekran o'qish dasturi uchun faqat muhim chegaralarda xabar (har soniyada emas).
  React.useEffect(() => {
    if (left === 300) setSaid("Qolgan vaqt 5 daqiqa.");
    else if (left === 60) setSaid("Qolgan vaqt 1 daqiqa.");
    else if (left === 10) setSaid("Qolgan vaqt 10 soniya.");
  }, [left]);
  const urgent = left <= 60;
  return (
    <>
      <div role="timer" aria-label="Qolgan vaqt" className={cn("inline-flex h-11 items-center gap-2 rounded-xl border px-3.5 text-base font-extrabold tabular-nums", urgent ? "border-danger/50 bg-danger/10 text-danger" : "border-border bg-card")}>
        <Timer className="h-[18px] w-[18px]" aria-hidden />{fmtClock(left)}
      </div>
      <span className="sr-only" role="status" aria-live="polite">{said}</span>
    </>
  );
}

/** Test sarlavhasi: rejim nomi, savol raqami, progress va (bo'lsa) taymer. */
export function TestHeader({ mode, topic, index, total, answered, timer, onExpire }: {
  mode: string; topic: string; index: number; total: number; answered: number; timer: { remainingSec: number } | null; onExpire: () => void;
}) {
  const pct = total ? Math.round((answered / total) * 100) : 0;
  return (
    <div className="mb-5">
      <div className="flex items-center justify-between gap-3">
        <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary">{mode}</span>
        {timer && <TestTimer remainingSec={timer.remainingSec} onExpire={onExpire} />}
      </div>
      <div className="mt-3 flex items-baseline justify-between gap-3">
        <h1 className="min-w-0 truncate text-xl font-extrabold tracking-tight sm:text-2xl">{topic}</h1>
        <span className="shrink-0 text-sm font-semibold text-muted-foreground">Savol <b className="text-foreground">{index + 1}</b> / {total}</span>
      </div>
      <div className="mt-3 flex items-center gap-3">
        <Progress value={pct} className="h-2.5 flex-1" label={`Javob berilgan: ${pct}%`} />
        <span className="w-10 text-right text-sm font-bold text-primary">{pct}%</span>
      </div>
    </div>
  );
}

/** Savollar navigatori: javob berilgan, belgilangan va joriy savollar bir qarashda ko'rinadi (rangdan tashqari belgi bilan ham). */
export function QuestionNavigator({ items, current, onGo }: { items: { id: string; answered: boolean; flagged: boolean }[]; current: number; onGo: (i: number) => void }) {
  return (
    <nav aria-label="Savollar navigatori">
      <ul className="grid grid-cols-5 gap-2 sm:grid-cols-8 lg:grid-cols-5">
        {items.map((it, i) => (
          <li key={it.id}>
            <button type="button" onClick={() => onGo(i)} aria-current={i === current ? "step" : undefined}
              aria-label={`${i + 1}-savol${it.answered ? ", javob berilgan" : ", javobsiz"}${it.flagged ? ", belgilangan" : ""}`}
              className={cn("relative grid h-11 w-full place-items-center rounded-xl border text-sm font-bold transition-colors duration-150",
                i === current ? "border-primary bg-primary text-white" : it.answered ? "border-primary/40 bg-primary/10 text-primary" : "border-border bg-card hover:bg-muted")}>
              {i + 1}
              {it.flagged && <Flag className={cn("absolute -right-1 -top-1 h-4 w-4 rounded-full bg-card p-0.5", i === current ? "text-amber" : "text-warning")} aria-hidden />}
            </button>
          </li>
        ))}
      </ul>
      <p className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-primary/30" aria-hidden />Javob berilgan</span>
        <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded border border-border" aria-hidden />Javobsiz</span>
        <span className="flex items-center gap-1.5"><Flag className="h-3 w-3 text-warning" aria-hidden />Belgilangan</span>
      </p>
    </nav>
  );
}

export function QuestionFlag({ flagged, onToggle, disabled }: { flagged: boolean; onToggle: () => void; disabled?: boolean }) {
  return (
    <button type="button" onClick={onToggle} disabled={disabled} aria-pressed={flagged}
      className={cn("inline-flex h-11 items-center gap-2 rounded-xl border px-4 text-sm font-semibold transition-colors duration-150", flagged ? "border-amber/50 bg-amber/15 text-warning" : "border-border bg-card hover:bg-muted")}>
      <Flag className="h-4 w-4" aria-hidden />{flagged ? "Belgi olib tashlash" : "Belgilab qo'yish"}
    </button>
  );
}

/** Yakunlashdan oldin javobsiz va belgilangan savollar soni ko'rsatiladi. */
export function TestSubmitDialog({ open, onOpenChange, total, answered, flagged, busy, onConfirm }: {
  open: boolean; onOpenChange: (v: boolean) => void; total: number; answered: number; flagged: number; busy: boolean; onConfirm: () => void;
}) {
  const left = total - answered;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Testni yakunlaysizmi?" description="Yakunlagandan keyin javoblarni o'zgartirib bo'lmaydi.">
        <dl className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded-xl bg-muted p-3"><dd className="text-2xl font-extrabold">{answered}</dd><dt className="text-xs text-muted-foreground">Javob berilgan</dt></div>
          <div className={cn("rounded-xl p-3", left > 0 ? "bg-amber/15" : "bg-muted")}><dd className="text-2xl font-extrabold">{left}</dd><dt className="text-xs text-muted-foreground">Javobsiz</dt></div>
          <div className="rounded-xl bg-muted p-3"><dd className="text-2xl font-extrabold">{flagged}</dd><dt className="text-xs text-muted-foreground">Belgilangan</dt></div>
        </dl>
        {left > 0 && <p className="mt-3 text-sm text-warning">{left} ta savolga javob berilmagan: ular natijada noto'g'ri deb hisoblanadi.</p>}
        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Testga qaytish</Button>
          <Button loading={busy} onClick={onConfirm}>Yakunlash</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Mobil qurilmada o'ng paneldagi yordamchi bloklar yig'iladigan bo'limga aylanadi; kompyuterda doim ochiq turadi. */
export function PanelAccordion({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <>
      <details className="group rounded-2xl border border-border bg-card shadow-soft lg:hidden">
        <summary className="flex min-h-[48px] cursor-pointer list-none items-center justify-between px-4 text-sm font-bold">{title}<span className="text-muted-foreground transition-transform group-open:rotate-180" aria-hidden>⌄</span></summary>
        <div className="p-3 pt-0">{children}</div>
      </details>
      <div className="hidden lg:block">{children}</div>
    </>
  );
}
