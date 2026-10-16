"use client";
import { Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { SuperKeyCard } from "@/components/practice/feedback";
import type { ReinforceAnswerRes, ReinforceRes } from "@/lib/practice-client";

export type RfState = { status: "loading" | "none" | "ready"; data?: Extract<ReinforceRes, { available: true }>; message?: string; sel: string | null; checking: boolean; result?: ReinforceAnswerRes; error?: string };

/** "Tushundimmi?": bitta to'g'ri javob o'zlashtirish degani emas, shuning uchun yangi vaziyatdagi savol bilan tekshiramiz. */
export function ReinforcementCard({ state, onSelect, onCheck }: { state: RfState; onSelect: (id: string) => void; onCheck: () => void }) {
  if (state.status === "loading") return <div className="mt-3 rounded-xl border border-border bg-card p-3.5 text-sm text-muted-foreground" aria-busy>Yangi savol tayyorlanmoqda...</div>;
  if (state.status === "none" || !state.data) return <p className="mt-3 rounded-xl border border-border bg-card p-3.5 text-sm text-muted-foreground">{state.message ?? "Hozircha qo'shimcha savol yo'q."}</p>;
  const d = state.data, r = state.result;
  return (
    <div className="mt-3 rounded-xl border border-primary/30 bg-card p-3.5 shadow-soft">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-extrabold">Tushundimmi? Keling, tekshiramiz</p>
        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">{d.kind === "new-situation" ? "Yangi vaziyat" : "Shu mavzudan yana bir savol"}</span>
      </div>
      {d.ai && <p className="mt-1 text-[11px] text-muted-foreground">Bu savolni AI yaratgan va uni ekspert tekshirmagan. Natijangizga ta'sir qilmaydi.</p>}
      {d.notice && <p className="mt-1 text-[11px] text-muted-foreground">{d.notice}</p>}
      <p className="mt-2 text-[15px] font-semibold leading-snug">{d.text}</p>
      <div role="radiogroup" aria-label="Variantlar" className="mt-2.5 space-y-2">
        {d.options.map((o) => {
          const correct = r && o.id === r.correctOptionId, wrong = r && o.id === r.chosenOptionId && !r.isCorrect, sel = !r && o.id === state.sel;
          return (
            <button key={o.id} type="button" role="radio" aria-checked={sel || !!correct || !!wrong} disabled={!!r} onClick={() => onSelect(o.id)}
              className={cn("flex min-h-[48px] w-full items-center gap-2.5 rounded-xl border px-3 py-2 text-left text-sm transition-colors disabled:cursor-default",
                correct ? "border-success bg-success/10" : wrong ? "border-danger/70 bg-danger/5" : sel ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-border hover:border-primary/50 hover:bg-primary/5")}>
              <span aria-hidden className="grid h-6 w-6 shrink-0 place-items-center rounded-md bg-muted text-xs font-extrabold">{o.label}</span>
              <span className="flex-1">{o.text}</span>
              {correct && <Check className="h-4 w-4 shrink-0 text-success" aria-label="To'g'ri javob" />}
              {wrong && <X className="h-4 w-4 shrink-0 text-danger" aria-label="Sizning javobingiz, noto'g'ri" />}
            </button>
          );
        })}
      </div>
      {!r && <Button className="mt-3 w-full" disabled={!state.sel} loading={state.checking} onClick={onCheck}>Javobni tekshirish</Button>}
      {state.error && <p role="alert" className="mt-2 text-xs text-danger">{state.error}</p>}
      {r && (
        <div className="mt-3 space-y-2.5" role="status">
          <p className={cn("text-sm font-bold", r.isCorrect ? "text-success" : "text-foreground")}>{r.message}</p>
          <p className="text-sm leading-relaxed">{r.explanation}</p>
          {r.superKey && <SuperKeyCard text={r.superKey} />}
        </div>
      )}
    </div>
  );
}
