"use client";
import * as React from "react";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** PDF uchun o'qiladigan sahifalar («3-14, 655-657»). Katta to'plamlarda (60 betdan ko'p) majburiy: faqat kerakli testlar va ularning javoblar kaliti sahifalari o'qiladi. */
export function PagesInput({ pageCount, value, required, disabled, onSave }: { pageCount: number | null; value: string; required: boolean; disabled?: boolean; onSave: (v: string) => Promise<boolean> }) {
  const [v, setV] = React.useState(value);
  const [busy, setBusy] = React.useState(false);
  const dirty = v.trim() !== value.trim();
  const save = async () => { setBusy(true); await onSave(v); setBusy(false); };
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <label className="flex min-w-0 flex-1 items-center gap-2">
        <span className="shrink-0 text-xs font-semibold text-muted-foreground">Sahifalar{pageCount ? ` (${pageCount} bet)` : ""}{required ? " *" : ""}:</span>
        <input value={v} onChange={(e) => setV(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && dirty) void save(); }} disabled={disabled || busy}
          placeholder={required ? "Masalan: 3-14, 655-657" : "Butun fayl (ixtiyoriy: 3-14, 20)"} aria-label="O'qiladigan sahifalar" maxLength={200}
          className={cn("h-8 min-w-0 flex-1 rounded-lg border bg-card px-2.5 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40", required && !value ? "border-amber" : "border-border")} />
      </label>
      {dirty && <Button size="sm" variant="outline" className="h-8" loading={busy} disabled={disabled} onClick={() => void save()}><Check className="h-4 w-4" aria-hidden />Saqlash</Button>}
    </div>
  );
}
