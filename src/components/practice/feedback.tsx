"use client";
import * as React from "react";
import { BrainCircuit, Check, Flag, KeyRound, Lightbulb, ListChecks, MessageCircleQuestion, MessageSquareText, RefreshCw, Sparkles, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/states";
import { RobotArt } from "@/components/practice/illustrations";
import { call, type CoachEntry, type Item } from "@/lib/practice-client";

/** Eslab qolish uchun qisqa qoida. Faqat bazada saqlangan "Super kalit" ko'rsatiladi (AI uydirmaydi). */
export function SuperKeyCard({ text }: { text: string }) {
  return (
    <div className="rounded-xl border border-amber/40 bg-amber/10 p-3.5">
      <p className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-warning"><KeyRound className="h-4 w-4" aria-hidden />Super kalit</p>
      <p className="mt-1 text-[15px] font-bold leading-snug">{text}</p>
    </div>
  );
}

const TITLES: Record<string, string> = { why: "Batafsil izoh", simple: "Oddiyroq tushuntirish", example: "Hayotiy misol", variants: "Barcha variantlar tahlili", mistake: "Nega adashdim?" };

function EntryCard({ e }: { e: CoachEntry }) {
  return (
    <div className="rounded-xl border border-border bg-card p-3.5">
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <p className="text-sm font-bold">{TITLES[e.mode] ?? "Izoh"}</p>
        <span className={cn("flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold", e.source === "ai" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground")}>
          {e.source === "ai" && <Sparkles className="h-3 w-3" aria-hidden />}{e.source === "ai" ? "AI izohi" : "Saqlangan izoh"}
        </span>
      </div>
      {e.text && <p className="whitespace-pre-line text-sm leading-relaxed">{e.text}</p>}
      {e.items && (
        <ul className="space-y-2">
          {e.items.map((v) => (
            <li key={v.label} className="flex gap-2.5 text-sm">
              <span aria-hidden className={cn("mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full text-white", v.correct ? "bg-success" : "bg-danger/80")}>{v.correct ? <Check className="h-3 w-3" strokeWidth={3} /> : <X className="h-3 w-3" strokeWidth={3} />}</span>
              <span><b>{v.label}.</b> <span className="sr-only">{v.correct ? "To'g'ri. " : "Noto'g'ri. "}</span>{v.why}</span>
            </li>
          ))}
        </ul>
      )}
      {e.notice && <p className="mt-2 text-xs text-muted-foreground">{e.notice}</p>}
    </div>
  );
}

function Pill({ icon: Icon, label, onClick, disabled, wide }: { icon: React.ElementType; label: string; onClick: () => void; disabled?: boolean; wide?: boolean }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled}
      className={cn("flex min-h-[48px] items-center gap-2.5 rounded-xl border border-border bg-card px-3 py-2 text-left text-[13px] font-semibold leading-tight shadow-soft transition hover:border-primary/50 hover:bg-primary/5 disabled:opacity-60", wide && "col-span-2")}>
      <Icon className="h-[18px] w-[18px] shrink-0 text-primary" aria-hidden />{label}
    </button>
  );
}

export type CoachMode = "why" | "simple" | "example" | "variants" | "mistake";

/** Javobdan keyingi tushuntirish paneli: natija, izoh, Super kalit va tezkor amallar. */
export function AIExplanationPanel({ item, aiAvailable, entries, loadingMode, error, onAsk, onTutor, onReinforce, reinforceBusy, beforeActions, children }: {
  item: Item; aiAvailable: boolean; entries: CoachEntry[]; loadingMode: string | null; error?: string;
  onAsk: (m: CoachMode, reason?: string) => void; onTutor: () => void; onReinforce: () => void; reinforceBusy: boolean; beforeActions?: React.ReactNode; children?: React.ReactNode;
}) {
  const a = item.answer!;
  const [reporting, setReporting] = React.useState(false);
  const [reason, setReason] = React.useState("");
  const [reported, setReported] = React.useState<string | null>(null);
  const [mistakeAsk, setMistakeAsk] = React.useState(false);
  const [why, setWhy] = React.useState("");

  const sendReport = async () => {
    const r = await call("/api/practice/report", "POST", { questionId: item.id, reason });
    setReported(r.ok ? "Rahmat! Xabaringiz tekshirish uchun qabul qilindi." : r.error);
    if (r.ok) { setReporting(false); setReason(""); }
  };

  return (
    <section aria-label="Javob tahlili" className="rounded-2xl border border-teal/25 bg-teal/5 p-4 sm:p-5">
      <div className="flex items-center gap-3">
        <RobotArt className="h-16 w-16 shrink-0" />
        <div>
          <p className="mb-0.5 inline-flex items-center gap-1.5 rounded-full bg-teal/15 px-2.5 py-0.5 text-[11px] font-bold text-teal"><BrainCircuit className="h-3.5 w-3.5" aria-hidden />AI murabbiy</p>
          <h2 className="text-lg font-extrabold leading-tight">Keling, sababini tushunamiz</h2>
        </div>
      </div>
      <div className="mt-3 rounded-xl bg-card p-3.5 shadow-soft" role="status">
        <p className={cn("text-sm font-bold", a.isCorrect ? "text-success" : "text-foreground")}>{a.isCorrect ? "To'g'ri javob, ofarin!" : "Bu safar boshqa variant to'g'ri. Sababini birga ko'ramiz."}</p>
        {a.hintUsed && <p className="mt-0.5 text-xs text-muted-foreground">Bu savolda ishoradan foydalandingiz.</p>}
      </div>
      <p className="mt-3 text-[15px] leading-relaxed">{a.explanation}</p>
      {a.superKey && <div className="mt-3"><SuperKeyCard text={a.superKey} /></div>}

      <div className="mt-3 space-y-2.5" aria-live="polite">
        {entries.map((e, i) => <EntryCard key={i} e={e} />)}
        {loadingMode && (
          <div className="rounded-xl border border-border bg-card p-3.5" aria-busy>
            <p className="mb-2 text-sm font-semibold text-muted-foreground">AI murabbiy yozmoqda...</p>
            <Skeleton className="mb-2 h-3.5 w-full" /><Skeleton className="mb-2 h-3.5 w-11/12" /><Skeleton className="h-3.5 w-2/3" />
          </div>
        )}
        {error && <p role="alert" className="rounded-xl bg-danger/10 p-3 text-sm text-danger">{error}</p>}
      </div>

      {beforeActions}

      <div className="mt-3 grid grid-cols-2 gap-2.5">
        {aiAvailable && !a.isCorrect && <Pill wide icon={MessageCircleQuestion} label="Nega adashdim?" disabled={!!loadingMode} onClick={() => setMistakeAsk((v) => !v)} />}
        {aiAvailable && mistakeAsk && !a.isCorrect && (
          <div className="col-span-2 rounded-xl border border-border bg-card p-3">
            <label htmlFor="why-input" className="text-xs font-semibold text-muted-foreground">Nega aynan shu variantni tanlagansiz? (ixtiyoriy)</label>
            <textarea id="why-input" value={why} onChange={(e) => setWhy(e.target.value)} maxLength={400} rows={2} className="mt-1.5 w-full resize-none rounded-lg border border-border bg-background p-2 text-sm" placeholder="Masalan: shunday bo'lsa kerak deb o'yladim" />
            <Button size="sm" className="mt-2" loading={loadingMode === "mistake"} onClick={() => { onAsk("mistake", why.trim() || undefined); setMistakeAsk(false); }}>Tahlil qilish</Button>
          </div>
        )}
        {aiAvailable && <Pill icon={MessageSquareText} label="Oddiyroq tushuntir" disabled={!!loadingMode} onClick={() => onAsk("simple")} />}
        {aiAvailable && <Pill icon={Lightbulb} label="Hayotiy misol" disabled={!!loadingMode} onClick={() => onAsk("example")} />}
        {aiAvailable && <Pill icon={ListChecks} label="Barcha variantlar tahlili" disabled={!!loadingMode} onClick={() => onAsk("variants")} />}
        <Pill icon={RefreshCw} label="Yana bir misolda sinash" disabled={reinforceBusy} onClick={onReinforce} wide={!aiAvailable} />
      </div>
      {aiAvailable && <Button variant="outline" className="mt-2.5 w-full" onClick={onTutor}><Sparkles className="h-4 w-4 text-primary" aria-hidden />AI bilan suhbatlashish</Button>}
      {!aiAvailable && <p className="mt-2.5 text-xs text-muted-foreground">AI murabbiy hozircha ulanmagan, shuning uchun saqlangan izoh va Super kalit ko'rsatilmoqda.</p>}

      {children}

      <div className="mt-3 border-t border-teal/20 pt-2.5">
        {reported ? <p className="text-xs text-muted-foreground">{reported}</p> : reporting ? (
          <div>
            <textarea value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} rows={2} aria-label="Savoldagi xato haqida" className="w-full resize-none rounded-lg border border-border bg-background p-2 text-sm" placeholder="Qanday xato bor? (kamida 3 belgi)" />
            <div className="mt-1.5 flex gap-2"><Button size="sm" disabled={reason.trim().length < 3} onClick={() => void sendReport()}>Yuborish</Button><Button size="sm" variant="ghost" onClick={() => setReporting(false)}>Bekor qilish</Button></div>
          </div>
        ) : <button type="button" onClick={() => setReporting(true)} className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground"><Flag className="h-3.5 w-3.5" aria-hidden />Savolda xato bor</button>}
      </div>
    </section>
  );
}
