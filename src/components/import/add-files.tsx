"use client";
import * as React from "react";
import { Plus } from "lucide-react";
import { uploadFile } from "@/lib/import-upload";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/components/ui/toast";

/** Mavjud importga fayl qo'shish (masalan, alohida «javoblar kaliti» fayli). Fayllar ketma-ket yuklanadi. */
export function AddFiles({ sessionId, accept, maxBytes, role = "AUTO", label = "Fayl qo'shish", disabled, onAdded }: { sessionId: string; accept: string; maxBytes: number; role?: "AUTO" | "QUESTIONS" | "ANSWERS"; label?: string; disabled?: boolean; onAdded: () => void }) {
  const toast = useToast();
  const input = React.useRef<HTMLInputElement>(null);
  const [busy, setBusy] = React.useState(false);
  const [name, setName] = React.useState("");
  const [pct, setPct] = React.useState(0);

  const pick = async (fl: FileList | null) => {
    const files = fl ? [...fl] : [];
    if (input.current) input.current.value = "";
    if (!files.length) return;
    setBusy(true);
    let added = 0;
    for (const f of files) {
      if (f.size > maxBytes) { toast("error", `${f.name}: fayl juda katta.`); continue; }
      setName(f.name); setPct(0);
      const r = await uploadFile(sessionId, f, role, (p) => setPct(Math.round(p * 100)));
      if (r.ok) { added++; if (r.duplicateOf) toast("info", `${f.name}: bu fayl avval «${r.duplicateOf.title}» importida ham bor.`); }
      else toast("error", `${f.name}: ${r.error}`);
    }
    setBusy(false);
    if (added) onAdded();
  };

  return (
    <div>
      <input ref={input} type="file" multiple className="sr-only" accept={accept} disabled={disabled || busy} onChange={(e) => void pick(e.target.files)} aria-label={label} />
      <Button variant="outline" size="sm" disabled={disabled} loading={busy} onClick={() => input.current?.click()}><Plus className="h-4 w-4" aria-hidden />{label}</Button>
      {busy && <div className="mt-2 max-w-xs"><p className="truncate text-xs text-muted-foreground">{name}</p><Progress value={pct} className="mt-1 h-1.5" label="Yuklanmoqda" /></div>}
    </div>
  );
}
