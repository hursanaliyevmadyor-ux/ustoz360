import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { TONES, type ChoiceDef } from "@/lib/choices";

/** Tanlash kartasi: bir xil o'lchamda, faqat ikonka aksenti farq qiladi. Savollar yo'q bo'lsa, tugma o'chiriladi va sababi yoziladi. */
export function ChoiceCard({ mode, badge, disabledNote, onClick, loading }: { mode: ChoiceDef; badge?: React.ReactNode; disabledNote?: string; onClick?: () => void; loading?: boolean }) {
  const Icon = mode.icon;
  const body = (
    <>
      <span className="flex items-start gap-3">
        <span className={cn("grid h-11 w-11 shrink-0 place-items-center rounded-xl", TONES[mode.tone], disabledNote && "opacity-60")}><Icon className="h-5 w-5" aria-hidden /></span>
        <span className="min-w-0">
          <span className="block text-base font-extrabold leading-tight">{mode.title}</span>
          <span className="mt-1 block text-sm leading-snug text-muted-foreground">{mode.desc}</span>
        </span>
      </span>
      <span className="mt-3 flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-semibold text-muted-foreground">{mode.benefit}</span>
        {mode.tag && <span className="rounded-full bg-amber/15 px-2.5 py-0.5 text-xs font-semibold text-warning">{mode.tag}</span>}
        {badge}
      </span>
      <span className="mt-auto flex items-center justify-between gap-2 pt-4">
        {disabledNote ? <span className="text-xs text-muted-foreground">{disabledNote}</span> : <span />}
        <span className={cn("inline-flex h-11 items-center gap-2 rounded-xl px-4 text-sm font-bold transition-colors duration-150", disabledNote ? "bg-muted text-muted-foreground" : "bg-primary text-white shadow-soft group-hover:bg-primary/90")}>
          {mode.cta}{!disabledNote && <ArrowRight className="h-4 w-4 transition-transform duration-150 group-hover:translate-x-0.5" aria-hidden />}
        </span>
      </span>
    </>
  );
  const cls = "group flex min-h-[210px] flex-col rounded-2xl border border-border bg-card p-5 text-left shadow-soft transition duration-150";
  if (disabledNote) return <div className={cn(cls, "opacity-90")} aria-disabled="true">{body}</div>;
  // Tanlov darhol boshlanadigan bo'lsa (masalan tezkor mashq), karta tugma sifatida ishlaydi.
  if (onClick) return <button type="button" onClick={onClick} disabled={loading} aria-busy={loading || undefined} className={cn(cls, "w-full hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-pop disabled:opacity-70")}>{body}</button>;
  return <Link href={mode.href} className={cn(cls, "hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-pop focus-visible:-translate-y-0.5")}>{body}</Link>;
}

/** Bo'lim ichidagi tanlash kartalari tarmog'i (kompyuterda 3, planshetda 2, telefonda 1 ustun). */
export function ChoiceGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{children}</div>;
}
