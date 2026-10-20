"use client";
import * as React from "react";
import { Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { FigureText } from "@/components/figure-text";
import { Progress } from "@/components/ui/progress";
import { DIFF_LABEL, type Item, type Option } from "@/lib/practice-client";

export function QuestionProgress({ topic, index, total, answered }: { topic: string; index: number; total: number; answered: number }) {
  const pct = total ? Math.round((answered / total) * 100) : 0;
  return (
    <div className="mb-5">
      <div className="flex items-baseline justify-between gap-3">
        <h1 className="min-w-0 truncate text-xl font-extrabold tracking-tight sm:text-2xl">{topic}</h1>
        <span className="shrink-0 text-sm font-semibold text-muted-foreground">Savol <b className="text-foreground">{index + 1}</b> / {total}</span>
      </div>
      <div className="mt-3 flex items-center gap-3">
        <Progress value={pct} className="h-2.5 flex-1" label={`Mashq jarayoni: ${pct}%`} />
        <span className="w-10 text-right text-sm font-bold text-primary">{pct}%</span>
      </div>
    </div>
  );
}

export type OptState = "idle" | "selected" | "correct" | "wrong" | "dimmed" | "eliminated";

/** Katta (kamida 56px), A–D harfli variant kartochkasi. Rang bilan birga belgi (✓/✕) ham ko'rsatiladi. */
export function AnswerOption({ option, state, disabled, onSelect }: { option: Option; state: OptState; disabled?: boolean; onSelect: () => void }) {
  const styles: Record<OptState, string> = {
    idle: "border-border bg-card hover:border-primary/50 hover:bg-primary/5",
    selected: "border-primary bg-primary/5 ring-1 ring-primary",
    correct: "border-success bg-success/10",
    wrong: "border-danger/70 bg-danger/5",
    dimmed: "border-border bg-card opacity-70",
    eliminated: "border-dashed border-border bg-muted/50 opacity-60",
  };
  const done = state === "correct" || state === "wrong" || state === "dimmed";
  return (
    <button type="button" role="radio" aria-checked={state === "selected" || state === "correct" || state === "wrong"} disabled={disabled} onClick={onSelect}
      className={cn("flex min-h-[56px] w-full items-center gap-3 rounded-xl border px-3.5 py-2.5 text-left transition-colors duration-150 disabled:cursor-default", styles[state])}>
      {!done && (
        <span aria-hidden className={cn("grid h-5 w-5 shrink-0 place-items-center rounded-full border-2", state === "selected" ? "border-primary" : "border-border")}>
          {state === "selected" && <span className="h-2.5 w-2.5 rounded-full bg-primary" />}
        </span>
      )}
      <span aria-hidden className={cn("grid h-7 w-7 shrink-0 place-items-center rounded-lg text-sm font-extrabold", state === "correct" ? "bg-success text-white" : state === "wrong" ? "bg-danger/80 text-white" : "bg-muted text-foreground")}>{option.label}</span>
      <span className={cn("min-w-0 flex-1 text-[15px] font-medium leading-snug", state === "eliminated" && "line-through")}>{option.text}</span>
      {state === "eliminated" && <span className="shrink-0 text-xs text-muted-foreground">ehtimol noto'g'ri</span>}
      {state === "correct" && <><span className="sr-only">To'g'ri javob</span><span aria-hidden className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-success text-white"><Check className="h-4 w-4" strokeWidth={3} /></span></>}
      {state === "wrong" && <><span className="sr-only">Sizning javobingiz, noto'g'ri</span><span aria-hidden className="grid h-6 w-6 shrink-0 place-items-center rounded-full border-2 border-danger/80 text-danger"><X className="h-3.5 w-3.5" strokeWidth={3} /></span></>}
    </button>
  );
}

/** Bitta savol: matn, qiyinlik va variantlar. Klaviaturadan A–D harflari yoki ↑/↓ bilan tanlash mumkin. */
export function QuestionCard({ item, selectedId, onSelect }: { item: Item; selectedId: string | null; onSelect: (id: string) => void }) {
  const a = item.answer;
  const stateOf = (o: Option): OptState => {
    if (a) return o.id === a.correctOptionId ? "correct" : o.id === a.chosenOptionId ? "wrong" : "dimmed";
    if (o.id === selectedId) return "selected";
    if (o.id === item.hintOptionId) return "eliminated";
    return "idle";
  };
  const onKey = (e: React.KeyboardEvent) => {
    if (a) return;
    const idx = item.options.findIndex((o) => o.id === selectedId);
    if (e.key === "ArrowDown" || e.key === "ArrowRight") { e.preventDefault(); onSelect(item.options[(idx + 1) % item.options.length].id); }
    else if (e.key === "ArrowUp" || e.key === "ArrowLeft") { e.preventDefault(); onSelect(item.options[(idx <= 0 ? item.options.length : idx) - 1].id); }
    else { const o = item.options.find((x) => x.label.toLowerCase() === e.key.toLowerCase()); if (o) { e.preventDefault(); onSelect(o.id); } }
  };
  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-soft sm:p-6">
      <div className="mb-3 flex flex-wrap items-center gap-2 text-xs font-semibold text-muted-foreground">
        <span className="rounded-full bg-muted px-2.5 py-0.5">{DIFF_LABEL[item.difficulty]}</span>
        {item.situational && <span className="rounded-full bg-[#0284C7]/10 px-2.5 py-0.5 text-[#0284C7]">Dars vaziyati</span>}
        {item.sample && <span className="rounded-full bg-amber/15 px-2.5 py-0.5 text-warning">Namunaviy savol</span>}
      </div>
      <div className={item.situational ? "rounded-xl bg-[#0284C7]/5 p-4 text-[17px] font-semibold leading-relaxed sm:text-lg" : "text-lg font-bold leading-snug sm:text-xl"} id={`q-${item.id}`}><FigureText text={item.text} /></div>
      <div role="radiogroup" aria-labelledby={`q-${item.id}`} onKeyDown={onKey} className="mt-4 space-y-2.5">
        {item.options.map((o) => <AnswerOption key={o.id} option={o} state={stateOf(o)} disabled={!!a} onSelect={() => onSelect(o.id)} />)}
      </div>
    </div>
  );
}
