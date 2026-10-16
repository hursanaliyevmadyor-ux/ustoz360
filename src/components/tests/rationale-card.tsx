"use client";
import * as React from "react";
import { Check, PenLine, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { CoachEntry } from "@/lib/practice-client";

/** Vaziyatli test: "Qaroringizni asoslang". Ixtiyoriy; AI mezonlar bo'yicha tahlil qiladi va noaniqlikni ochiq aytadi. */
export function RationaleCard({ initial, aiAvailable, onSubmit }: {
  initial: string | null; aiAvailable: boolean; onSubmit: (text: string) => Promise<{ ok: true; entry: CoachEntry } | { ok: false; error: string }>;
}) {
  const [text, setText] = React.useState(initial ?? "");
  const [busy, setBusy] = React.useState(false);
  const [entry, setEntry] = React.useState<CoachEntry | null>(null);
  const [error, setError] = React.useState("");
  const send = async () => {
    setBusy(true); setError("");
    const r = await onSubmit(text.trim());
    setBusy(false);
    if (r.ok) setEntry(r.entry); else setError(r.error);
  };
  return (
    <div className="mt-3 rounded-xl border border-sky-600/30 bg-card p-3.5">
      <label htmlFor="rationale" className="flex items-center gap-2 text-sm font-extrabold"><PenLine className="h-4 w-4 text-[#0284C7]" aria-hidden />Qaroringizni asoslang</label>
      <p className="mt-0.5 text-xs text-muted-foreground">Nima uchun shu variantni tanladingiz? 1–2 gap yozing (ixtiyoriy). Bu javobingiz natijasiga ta'sir qilmaydi.</p>
      <textarea id="rationale" value={text} onChange={(e) => setText(e.target.value)} maxLength={400} rows={3} disabled={!!entry}
        className="mt-2 w-full resize-none rounded-lg border border-border bg-background p-2.5 text-sm disabled:opacity-70" placeholder="Masalan: muammo ko'pchilikda bo'lgani uchun darsni moslashtirish kerak deb o'yladim" />
      {!entry && (
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <Button size="sm" loading={busy} disabled={text.trim().length < 3} onClick={() => void send()}>{aiAvailable ? "Asoslashni tahlil qilish" : "Asoslashni saqlash"}</Button>
          {!aiAvailable && <span className="text-xs text-muted-foreground">AI hozircha ulanmagan: asoslashingiz faqat saqlanadi.</span>}
        </div>
      )}
      {error && <p role="alert" className="mt-2 text-xs text-danger">{error}</p>}
      {entry?.rationale && (
        <div className="mt-3 space-y-2.5 text-sm" role="status">
          {entry.rationale.strengths.length > 0 && <div><p className="font-bold text-success">Kuchli tomonlar</p><ul className="mt-1 space-y-1">{entry.rationale.strengths.map((s, i) => <li key={i} className="flex gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden />{s}</li>)}</ul></div>}
          {entry.rationale.improve.length > 0 && <div><p className="font-bold">Yaxshilash mumkin</p><ul className="mt-1 list-disc space-y-1 pl-5">{entry.rationale.improve.map((s, i) => <li key={i}>{s}</li>)}</ul></div>}
          {entry.rationale.uncertainty && <p className="flex gap-2 text-xs text-muted-foreground"><TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />{entry.rationale.uncertainty}</p>}
          <p className="text-[11px] text-muted-foreground">AI tahlili taxminiy: u sizning fikringizni to'liq bilmaydi.</p>
        </div>
      )}
      {entry && !entry.rationale && <p className="mt-2 text-xs text-muted-foreground" role="status">{entry.notice ?? "Asoslashingiz saqlandi."}</p>}
    </div>
  );
}
