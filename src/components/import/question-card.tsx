"use client";
import * as React from "react";
import { AlertTriangle, Check, ChevronDown, Eye, Pencil, Plus, RefreshCw, RotateCcw, Trash2, X } from "lucide-react";
import { api } from "@/lib/admin-client";
import { QTYPE_LABEL, REVIEW_LABEL, type QuestionRow } from "@/lib/import-client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, Textarea } from "@/components/ui/form";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

export const NOT_VERIFIED = "Javob tasdiqlanmadi — qo'lda tekshirish kerak.";
const LABELS = "ABCDEFGHIJ";
const CONFIRMABLE = ["SINGLE", "SITUATIONAL"];

export function statusBadge(q: QuestionRow) {
  if (q.decision === "APPROVED") return { label: "Tasdiqlangan", tone: "success" as const };
  if (q.decision === "REMOVED") return { label: "Olib tashlangan", tone: "neutral" as const };
  return REVIEW_LABEL[q.reviewStatus] ?? { label: q.reviewStatus, tone: "neutral" as const };
}

type Props = {
  sessionId: string; q: QuestionRow; selected: boolean; locked: boolean;
  onSelect: () => void; onChanged: (opts?: { advance?: boolean; detail?: boolean }) => void;
};

/** Bitta savol: yig'ilgan ko'rinishda qisqa, tanlanganda to'liq (variantlar, javob belgilash, tahrirlash, «To'g'ri», qayta tekshirish). Asl matn hech qachon o'zgartirilmaydi — tahrir alohida saqlanadi. */
export function QuestionCard({ sessionId, q, selected, locked, onSelect, onChanged }: Props) {
  const toast = useToast();
  const st = statusBadge(q);
  const initial = q.answer.final?.[0] ?? q.answer.proposed?.[0] ?? q.answer.key?.[0] ?? "";
  const [chosen, setChosen] = React.useState(initial);
  const [editing, setEditing] = React.useState(false);
  const [text, setText] = React.useState(q.text);
  const [opts, setOpts] = React.useState(q.options.map((o) => o.text));
  const [difficulty, setDifficulty] = React.useState(q.difficulty);
  const [busy, setBusy] = React.useState<string | null>(null);
  const [showOriginal, setShowOriginal] = React.useState(false);

  React.useEffect(() => { setChosen(q.answer.final?.[0] ?? q.answer.proposed?.[0] ?? q.answer.key?.[0] ?? ""); }, [q.id, q.answer.final, q.answer.proposed, q.answer.key]);
  React.useEffect(() => { if (!editing) { setText(q.text); setOpts(q.options.map((o) => o.text)); setDifficulty(q.difficulty); } }, [q, editing]);

  const run = async (name: string, fn: () => Promise<{ ok: boolean; error?: string }>, done: string, then?: { advance?: boolean; detail?: boolean }) => {
    setBusy(name);
    const r = await fn();
    setBusy(null);
    if (!r.ok) { toast("error", r.error ?? "Amal bajarilmadi."); return false; }
    if (done) toast("success", done);
    onChanged(then);
    return true;
  };
  const post = (body: Record<string, unknown>) => async () => { const r = await api(`/api/import/${sessionId}/questions/${q.id}`, "POST", body); return r.ok ? { ok: true } : { ok: false, error: r.error }; };

  const canConfirm = CONFIRMABLE.includes(q.qtype) && q.options.length >= 2;
  const confirm = (vouch: boolean) => run("confirm", post({ action: "confirm", answer: chosen, vouch }), vouch ? "Savol tasdiqlandi." : "Savol tasdiqlanmagan javob bilan qo'shildi.", { advance: true });
  const saveEdit = () => run("edit", async () => {
    const clean = opts.map((o) => o.trim()).filter(Boolean);
    const r = await api(`/api/import/${sessionId}/questions/${q.id}`, "PATCH", { text: text.trim(), options: clean, difficulty });
    if (r.ok) setEditing(false);
    return r.ok ? { ok: true } : { ok: false, error: r.error };
  }, "Savol saqlandi. Javobni qayta tekshirish uchun «Qayta tekshirish»ni bosing.", { detail: true });

  const dim = q.decision === "REMOVED";
  return (
    <li className={cn("rounded-2xl border bg-card transition-colors", selected ? "border-primary shadow-soft" : "border-border hover:border-primary/40", dim && "opacity-60")}>
      <button type="button" onClick={onSelect} aria-expanded={selected} className="flex w-full items-start gap-3 rounded-2xl p-3.5 text-left">
        <span className="mt-0.5 grid h-7 min-w-7 place-items-center rounded-lg bg-muted px-1.5 text-xs font-bold">{q.number ?? q.seq + 1}</span>
        <span className={cn("min-w-0 flex-1 text-sm", !selected && "line-clamp-2")}>{q.text}</span>
        <Badge variant={st.tone} className="shrink-0">{st.label}</Badge>
        <ChevronDown className={cn("mt-1 h-4 w-4 shrink-0 text-muted-foreground transition-transform", selected && "rotate-180")} aria-hidden />
      </button>

      {selected && (
        <div className="space-y-3 border-t border-border p-3.5">
          <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
            <Badge variant="neutral">{QTYPE_LABEL[q.qtype] ?? q.qtype}</Badge>
            {q.sourcePage && <span>{q.fileName} · {q.sourcePage}</span>}
            {q.topicGuess && <span>· {q.topicGuess}</span>}
            {q.edited && <Badge variant="blue">Tahrirlangan</Badge>}
            {q.edited && q.original && <button type="button" className="font-semibold text-primary hover:underline" onClick={() => setShowOriginal((v) => !v)}><Eye className="mr-1 inline h-3.5 w-3.5" aria-hidden />{showOriginal ? "Yashirish" : "Asl matn"}</button>}
          </div>
          {showOriginal && q.original && <p className="rounded-xl bg-muted px-3 py-2 text-sm text-muted-foreground">{q.original}</p>}
          {q.ocrUncertain && <p role="status" className="flex items-start gap-2 rounded-xl bg-amber/10 px-3 py-2 text-sm"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber" aria-hidden />Matn rasmdan o'qilgan va ishonchsiz bo'lishi mumkin. Asl faylga qarab tekshiring.</p>}
          {q.note && <p className="text-xs text-muted-foreground">{q.note}</p>}

          {editing ? (
            <div className="space-y-2.5">
              <Textarea value={text} onChange={(e) => setText(e.target.value)} aria-label="Savol matni" className="min-h-28" />
              <div className="space-y-2">
                {opts.map((o, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-muted text-sm font-bold">{LABELS[i]}</span>
                    <input value={o} onChange={(e) => setOpts((a) => a.map((x, k) => (k === i ? e.target.value : x)))} aria-label={`${LABELS[i]} variant`} className="h-10 min-w-0 flex-1 rounded-xl border border-border bg-card px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40" />
                    <Button variant="ghost" size="icon" aria-label={`${LABELS[i]} variantni olib tashlash`} disabled={opts.length <= 2} onClick={() => setOpts((a) => a.filter((_, k) => k !== i))}><X className="h-4 w-4" aria-hidden /></Button>
                  </div>
                ))}
                {opts.length < 10 && <Button variant="outline" size="sm" onClick={() => setOpts((a) => [...a, ""])}><Plus className="h-4 w-4" aria-hidden />Variant qo'shish</Button>}
              </div>
              <label className="flex items-center gap-2 text-sm"><span className="font-semibold">Qiyinlik:</span>
                <Select value={difficulty} onChange={(e) => setDifficulty(e.target.value)} className="h-9 w-40"><option value="EASY">Oson</option><option value="MEDIUM">O'rta</option><option value="HARD">Qiyin</option></Select>
              </label>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" loading={busy === "edit"} onClick={saveEdit}><Check className="h-4 w-4" aria-hidden />Saqlash</Button>
                <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>Bekor qilish</Button>
              </div>
            </div>
          ) : (
            <>
              <p className="whitespace-pre-wrap text-sm font-medium">{q.text}</p>
              {q.options.length > 0 ? (
                <div role="radiogroup" aria-label="To'g'ri javobni tanlang" className="space-y-1.5">
                  {q.options.map((o) => {
                    const isKey = q.answer.key?.includes(o.label), isAi = q.answer.proposed?.includes(o.label), on = chosen === o.label;
                    return (
                      <button key={o.label} type="button" role="radio" aria-checked={on} disabled={locked || !CONFIRMABLE.includes(q.qtype)} onClick={() => setChosen(o.label)}
                        className={cn("flex w-full items-start gap-2.5 rounded-xl border px-3 py-2 text-left text-sm transition-colors disabled:cursor-default", on ? "border-primary bg-primary/10" : "border-border hover:bg-muted")}>
                        <span className={cn("grid h-6 w-6 shrink-0 place-items-center rounded-md text-xs font-bold", on ? "bg-primary text-white" : "bg-muted")}>{o.label}</span>
                        <span className="min-w-0 flex-1">{o.text}</span>
                        <span className="flex shrink-0 flex-wrap justify-end gap-1">
                          {isKey && <Badge variant="neutral">Fayl kaliti</Badge>}
                          {isAi && <Badge variant="teal">AI</Badge>}
                        </span>
                      </button>
                    );
                  })}
                </div>
              ) : <p className="rounded-xl bg-amber/10 px-3 py-2 text-sm">Variantlar topilmadi. «Tahrirlash» orqali qo'shing.</p>}

              {q.reviewStatus === "NO_ANSWER" && <p role="status" className="rounded-xl bg-danger/10 px-3 py-2 text-sm font-semibold text-danger">{NOT_VERIFIED}</p>}
              {q.reviewStatus === "CONFLICT" && <p role="status" className="rounded-xl bg-danger/10 px-3 py-2 text-sm"><b>Ziddiyat:</b> fayldagi kalit va mustaqil tekshiruv farq qiladi. Quyidagi dalillarga qarab o'zingiz tanlang.</p>}
              {q.reviewStatus === "UNSUPPORTED" && <p className="rounded-xl bg-muted px-3 py-2 text-sm">Bu savol turi ({QTYPE_LABEL[q.qtype] ?? q.qtype}) mavjud test dvigatelida ishlatilmaydi. Savol saqlanadi, lekin testga qo'shilmaydi.</p>}

              <div className="flex flex-wrap gap-2 pt-1">
                {q.decision === "REMOVED" ? (
                  <Button size="sm" variant="outline" disabled={locked} loading={busy === "restore"} onClick={() => run("restore", post({ action: "restore" }), "Savol qaytarildi.")}><RotateCcw className="h-4 w-4" aria-hidden />Qaytarish</Button>
                ) : (
                  <>
                    <Button size="sm" variant="success" disabled={locked || !canConfirm || !chosen} loading={busy === "confirm"} onClick={() => confirm(true)}><Check className="h-4 w-4" aria-hidden />{q.decision === "APPROVED" ? "Javobni yangilash" : "To'g'ri"}</Button>
                    <Button size="sm" variant="outline" disabled={locked} onClick={() => setEditing(true)}><Pencil className="h-4 w-4" aria-hidden />Tahrirlash</Button>
                    <Button size="sm" variant="outline" disabled={locked} loading={busy === "recheck"} onClick={() => run("recheck", post({ action: "recheck" }), "Qayta tekshirish boshlandi.", { detail: true })}><RefreshCw className="h-4 w-4" aria-hidden />Qayta tekshirish</Button>
                    <Button size="sm" variant="ghost" disabled={locked} loading={busy === "remove"} onClick={() => run("remove", post({ action: "remove" }), "Savol olib tashlandi.", { advance: true })}><Trash2 className="h-4 w-4" aria-hidden />Olib tashlash</Button>
                  </>
                )}
              </div>
              {!locked && canConfirm && chosen && q.decision !== "REMOVED" && q.answer.status !== "CONFIRMED" && q.decision !== "APPROVED" && (
                <p className="text-xs text-muted-foreground">«To'g'ri» bosilsa, javob siz belgilagan sifatida saqlanadi. Tasdiqlamasdan qo'shish uchun <button type="button" className="font-semibold text-primary hover:underline" onClick={() => confirm(false)}>shu yerni bosing</button>: bunday savol diagnostikada avtomatik hisoblanmaydi.</p>
              )}
            </>
          )}
        </div>
      )}
    </li>
  );
}
