"use client";
import * as React from "react";
import { AlertTriangle, CheckCircle2, CircleDashed, FileText, Loader2, WifiOff, XCircle } from "lucide-react";
import { mbText, type FileView, type SessionView, type StepResult } from "@/lib/import-client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

const STEPS = [
  { key: "PARSE", label: "Fayl o'qilmoqda" },
  { key: "STRUCT", label: "Tuzilma aniqlanmoqda" },
  { key: "EXTRACT", label: "Savollar ajratilmoqda" },
  { key: "KEYS", label: "Javoblar kaliti" },
  { key: "TOPICS", label: "Mavzular" },
  { key: "VERIFY", label: "Javoblar tekshirilmoqda" },
] as const;

const FILE_STATUS: Record<string, { label: string; tone: "neutral" | "blue" | "success" | "danger" | "amber" }> = {
  PENDING_UPLOAD: { label: "Yuklanmoqda", tone: "amber" }, UPLOADED: { label: "Kutmoqda", tone: "neutral" }, PARSING: { label: "O'qilmoqda", tone: "blue" },
  PARSED: { label: "Tayyor", tone: "success" }, FAILED: { label: "Xatolik", tone: "danger" }, UNSUPPORTED: { label: "Qo'llab-quvvatlanmaydi", tone: "danger" }, BLOCKED: { label: "Hozir o'qib bo'lmaydi", tone: "amber" },
};
const ROLE_LABEL: Record<string, string> = { AUTO: "Avtomatik aniqlanadi", QUESTIONS: "Savollar", ANSWERS: "Javoblar kaliti", MATERIAL: "Material" };

export function FileRow({ f, right, below }: { f: FileView; right?: React.ReactNode; below?: React.ReactNode }) {
  const st = FILE_STATUS[f.parseStatus] ?? { label: f.parseStatus, tone: "neutral" as const };
  return (
    <li className="rounded-xl border border-border bg-card p-3">
      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
        <FileText className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
        <span className="min-w-0 flex-1 truncate text-sm font-semibold">{f.fileName}</span>
        <span className="shrink-0 text-xs text-muted-foreground">{f.kindLabel} · {mbText(f.sizeBytes)}{f.pageCount ? ` · ${f.pageCount} bet` : ""}</span>
        <Badge variant={st.tone}>{st.label}</Badge>
        {right}
      </div>
      <div className="mt-1 flex flex-wrap gap-x-3 text-xs text-muted-foreground">
        <span>{ROLE_LABEL[f.role] ?? f.role}</span>
        {f.extracted > 0 && <span>{f.extracted} ta savol ajratildi</span>}
        {f.progress && f.parseStatus === "PARSING" && <span>{f.progress.done}/{f.progress.total}</span>}
      </div>
      {(f.parseError || f.note) && <p role={f.parseError ? "alert" : undefined} className={cn("mt-1.5 text-xs", f.parseError ? "text-danger" : "text-muted-foreground")}>{f.parseError ?? f.note}</p>}
      {below && <div className="mt-2">{below}</div>}
    </li>
  );
}

/** Jarayon holati: bosqichlar, jonli progress, fayllar holati. Savollar topilgani sari natija saqlanadi, shuning uchun xato bo'lsa ham yo'qolmaydi. */
export function ProcessingCard({ session, last, offline, onCancel, cancelling }: { session: SessionView; last: StepResult | null; offline: boolean; onCancel: () => void; cancelling: boolean }) {
  const idx = Math.max(0, STEPS.findIndex((s) => s.key === (last?.step ?? session.step)));
  const pct = last && last.total > 0 ? Math.round((last.done / last.total) * 100) : null;
  const label = last?.label || session.label || "Tayyorlanmoqda…";
  const found = session.counts.total;
  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-center gap-3">
        <Loader2 className="h-6 w-6 animate-spin text-primary" aria-hidden />
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-bold">Faylingiz tahlil qilinmoqda</h2>
          <p aria-live="polite" className="text-sm text-muted-foreground">{label}{found > 0 ? ` · ${found} ta savol topildi` : ""}</p>
        </div>
        <Button variant="outline" size="sm" loading={cancelling} onClick={onCancel}><XCircle className="h-4 w-4" aria-hidden />Bekor qilish</Button>
      </div>
      <Progress value={pct ?? ((idx + 0.5) / STEPS.length) * 100} className="mt-4" label="Umumiy jarayon" />
      <ol className="mt-4 grid gap-2 sm:grid-cols-3 lg:grid-cols-6" aria-label="Jarayon bosqichlari">
        {STEPS.map((s, i) => (
          <li key={s.key} className={cn("flex items-center gap-2 rounded-xl px-2.5 py-2 text-xs font-semibold", i < idx ? "bg-success/10 text-success" : i === idx ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground")}>
            {i < idx ? <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden /> : i === idx ? <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden /> : <CircleDashed className="h-4 w-4 shrink-0" aria-hidden />}
            <span>{s.label}</span>
          </li>
        ))}
      </ol>
      {offline && <p role="status" className="mt-3 flex items-center gap-2 rounded-xl bg-amber/10 px-3 py-2 text-sm"><WifiOff className="h-4 w-4 shrink-0 text-amber" aria-hidden />Aloqa uzildi. Jarayon saqlangan: aloqa qaytgach o'zi davom etadi.</p>}
      {session.warnings.length > 0 && (
        <ul className="mt-3 space-y-1">{session.warnings.slice(-4).map((w, i) => <li key={i} className="flex items-start gap-1.5 text-xs text-muted-foreground"><AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber" aria-hidden />{w}</li>)}</ul>
      )}
      <ul className="mt-4 space-y-2">{session.files.map((f) => <FileRow key={f.id} f={f} />)}</ul>
      <p className="mt-3 text-xs text-muted-foreground">Sahifani yopsangiz ham jarayon saqlanadi: «Oldingi yuklashlarim» orqali davom ettirishingiz mumkin.</p>
    </Card>
  );
}
