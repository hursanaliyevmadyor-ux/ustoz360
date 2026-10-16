"use client";
import * as React from "react";
import { Check, ChevronDown, Search } from "lucide-react";
import { cn } from "@/lib/utils";

export type SelOption = { id: string; name: string; hint?: string };

/** Qidiruvli tanlash maydoni (fan va mavzu uchun). Klaviatura: Enter/Space ochadi, Escape yopadi. */
export function SearchSelect({ label, value, options, onChange, placeholder = "Tanlang", disabled }: {
  label: string; value: string | null; options: SelOption[]; onChange: (id: string) => void; placeholder?: string; disabled?: boolean;
}) {
  const [open, setOpen] = React.useState(false);
  const [q, setQ] = React.useState("");
  const ref = React.useRef<HTMLDivElement>(null);
  const uid = React.useId();
  React.useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);
  const cur = options.find((o) => o.id === value);
  const list = options.filter((o) => o.name.toLowerCase().includes(q.trim().toLowerCase()));
  return (
    <div ref={ref} className="relative" onKeyDown={(e) => { if (e.key === "Escape") setOpen(false); }}>
      <label id={`${uid}-l`} className="mb-1.5 block text-sm font-bold">{label}</label>
      <button type="button" disabled={disabled} aria-haspopup="listbox" aria-expanded={open} aria-labelledby={`${uid}-l`} onClick={() => { setOpen((v) => !v); setQ(""); }}
        className="flex h-12 w-full items-center justify-between gap-2 rounded-xl border border-border bg-card px-3.5 text-left text-[15px] font-medium transition-colors hover:border-primary/50 disabled:opacity-60">
        <span className={cn("truncate", !cur && "text-muted-foreground")}>{cur?.name ?? placeholder}</span>
        <ChevronDown className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} aria-hidden />
      </button>
      {open && (
        <div className="absolute z-30 mt-1.5 w-full rounded-xl border border-border bg-card p-2 shadow-pop">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} aria-label={`${label}: qidirish`} placeholder="Qidirish..." className="h-10 w-full rounded-lg border border-border bg-background pl-8 pr-2 text-sm" />
          </div>
          <ul role="listbox" aria-labelledby={`${uid}-l`} className="mt-1.5 max-h-60 overflow-y-auto">
            {list.map((o) => (
              <li key={o.id} role="option" aria-selected={o.id === value}>
                <button type="button" onClick={() => { onChange(o.id); setOpen(false); }} className="flex min-h-[44px] w-full items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-left text-sm hover:bg-muted">
                  <span className="min-w-0"><span className="block truncate font-medium">{o.name}</span>{o.hint && <span className="block text-xs text-muted-foreground">{o.hint}</span>}</span>
                  {o.id === value && <Check className="h-4 w-4 shrink-0 text-primary" aria-hidden />}
                </button>
              </li>
            ))}
            {list.length === 0 && <li className="px-2.5 py-4 text-center text-sm text-muted-foreground">Hech narsa topilmadi.</li>}
          </ul>
        </div>
      )}
    </div>
  );
}

/** Pill ko'rinishidagi segment tanlovi (savollar soni, qiyinlik). */
export function Segmented<T extends string | number>({ label, value, options, onChange }: { label: string; value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div>
      <p className="mb-1.5 text-sm font-bold">{label}</p>
      <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-2">
        {options.map((o) => (
          <button key={String(o.value)} type="button" role="radio" aria-checked={o.value === value} onClick={() => onChange(o.value)}
            className={cn("h-11 min-w-[52px] rounded-full border px-4 text-sm font-bold transition-colors", o.value === value ? "border-primary bg-primary text-white shadow-soft" : "border-border bg-card hover:border-primary/50 hover:bg-primary/5")}>{o.label}</button>
        ))}
      </div>
    </div>
  );
}
