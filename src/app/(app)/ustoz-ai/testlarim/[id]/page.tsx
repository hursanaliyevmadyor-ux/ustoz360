"use client";
import * as React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ClipboardCheck, FileSearch, Pencil, PlayCircle, Share2, Timer, Trash2, Undo2 } from "lucide-react";
import { api } from "@/lib/admin-client";
import { useQuery } from "@/lib/use-query";
import { ANSWER_STATUS_LABEL, COLLECTION_STATE_LABEL, COLLECTION_STATUS_LABEL, type CollectionQuestion, type CollectionView } from "@/lib/import-client";
import { QueryView } from "@/components/layout/query-view";
import { SectionHeader } from "@/components/layout/section-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Field, Input, Textarea } from "@/components/ui/form";
import { EmptyState } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

const LABELS = "ABCDEFGHIJ";
const ANSWER_TONE: Record<string, "success" | "blue" | "amber"> = { VERIFIED: "success", USER_SET: "blue", UNVERIFIED: "amber" };
const SUB_LABEL: Record<string, string> = { SUBMITTED: "Ko'rib chiqilmoqda", APPROVED: "Tasdiqlandi", APPROVED_EDITED: "Tahrir bilan tasdiqlandi", NEEDS_RECHECK: "Qayta tekshirish so'ralgan", REJECTED: "Rad etildi", ARCHIVED: "Arxiv" };

function EditQuestion({ colId, q, onClose, onSaved }: { colId: string; q: CollectionQuestion | null; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [text, setText] = React.useState("");
  const [opts, setOpts] = React.useState<string[]>([]);
  const [correct, setCorrect] = React.useState(0);
  const [explanation, setExplanation] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  React.useEffect(() => { if (q) { setText(q.text); setOpts(q.options.map((o) => o.text)); setCorrect(q.correct); setExplanation(q.explanation); } }, [q]);
  const save = async () => {
    if (!q) return;
    setBusy(true);
    const r = await api(`/api/personal-tests/${colId}/questions/${q.id}`, "PATCH", { text: text.trim(), options: opts.map((o) => o.trim()), correct, explanation: explanation.trim() });
    setBusy(false);
    if (!r.ok) { toast("error", r.error); return; }
    toast("success", "Savol saqlandi."); onSaved(); onClose();
  };
  return (
    <Dialog open={!!q} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent title="Savolni tahrirlash" description="To'g'ri javob o'zgarsa, savol «O'qituvchi belgilagan» deb saqlanadi." className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <div className="space-y-3">
          <Field label="Savol matni"><Textarea value={text} onChange={(e) => setText(e.target.value)} /></Field>
          <fieldset className="space-y-2">
            <legend className="mb-1 text-sm font-semibold">Variantlar (to'g'ri javobni belgilang)</legend>
            {opts.map((o, i) => (
              <div key={i} className="flex items-center gap-2">
                <input type="radio" name="correct" checked={correct === i} onChange={() => setCorrect(i)} aria-label={`${LABELS[i]} to'g'ri javob`} className="h-4 w-4 accent-[var(--primary,#3867F4)]" />
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-muted text-sm font-bold">{LABELS[i]}</span>
                <Input value={o} onChange={(e) => setOpts((a) => a.map((x, k) => (k === i ? e.target.value : x)))} aria-label={`${LABELS[i]} variant`} className="h-10" />
              </div>
            ))}
          </fieldset>
          <Field label="Izoh (ixtiyoriy)"><Textarea value={explanation} onChange={(e) => setExplanation(e.target.value)} className="min-h-20" /></Field>
          <div className="flex justify-end gap-2"><Button variant="ghost" onClick={onClose}>Bekor qilish</Button><Button loading={busy} onClick={() => void save()}>Saqlash</Button></div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Detail({ c, reload }: { c: CollectionView; reload: () => void }) {
  const toast = useToast();
  const router = useRouter();
  const [busy, setBusy] = React.useState<string | null>(null);
  const [edit, setEdit] = React.useState<CollectionQuestion | null>(null);
  const [startMode, setStartMode] = React.useState<"practice" | "test" | "diagnostic" | null>(null);
  const [includeUnverified, setIncludeUnverified] = React.useState(false);
  const [duration, setDuration] = React.useState("");
  const [shareOpen, setShareOpen] = React.useState(false);
  const [rights, setRights] = React.useState(false);
  const [rightsNote, setRightsNote] = React.useState("");
  const [note, setNote] = React.useState("");
  const [title, setTitle] = React.useState(c.title);
  const [renaming, setRenaming] = React.useState(false);

  const act = async (name: string, fn: () => ReturnType<typeof api>, ok?: string) => {
    setBusy(name);
    const r = await fn();
    setBusy(null);
    if (!r.ok) { toast("error", r.error); return null; }
    if (ok) toast("success", ok);
    reload();
    return r;
  };

  const start = async () => {
    if (!startMode) return;
    setBusy("start");
    const r = await api<{ href: string; skippedUnverified: number }>(`/api/personal-tests/${c.id}/start`, "POST", { mode: startMode, includeUnverified, ...(duration && { durationMin: Number(duration) }) });
    setBusy(null);
    if (!r.ok) { toast("error", r.error); return; }
    router.push(r.data.href);
  };
  const submit = async () => {
    const r = await act("submit", () => api(`/api/personal-tests/${c.id}/submit`, "POST", { rightsConfirmed: rights, ...(rightsNote.trim() && { rightsNote: rightsNote.trim() }), ...(note.trim() && { note: note.trim() }) }), "Test adminga yuborildi. Tasdiqlanmaguncha u faqat sizda qoladi.");
    if (r) setShareOpen(false);
  };
  const rename = async () => { if (title.trim() && title.trim() !== c.title) await act("rename", () => api(`/api/personal-tests/${c.id}`, "PATCH", { title: title.trim() }), "Nomi o'zgartirildi."); setRenaming(false); };
  const removeCol = async () => {
    if (!window.confirm("Bu test va undagi barcha savollar, shuningdek ular bo'yicha javoblaringiz o'chiriladi. Davom etamizmi?")) return;
    if (await act("delete", () => api(`/api/personal-tests/${c.id}`, "DELETE"))) router.push("/ustoz-ai/testlarim");
  };
  const removeQ = (q: CollectionQuestion) => { if (window.confirm("Bu savol testdan olib tashlansinmi?")) void act("q", () => api(`/api/personal-tests/${c.id}/questions/${q.id}`, "DELETE"), "Savol olib tashlandi."); };

  const submitted = c.status === "SUBMITTED_TO_ADMIN";
  const canShare = c.editable && c.questions.length > 0;
  const safe = c.counts.verified + c.counts.userSet;
  const subLast = c.submissions[0];

  return (
    <div className="space-y-5">
      <Card className="space-y-4 p-5">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={c.state === "VERIFIED" ? "success" : c.state === "TEACHER_CONFIRMED" ? "blue" : "amber"}>{COLLECTION_STATE_LABEL[c.state] ?? c.state}</Badge>
          <Badge variant={c.status === "PUBLIC_APPROVED" ? "success" : submitted ? "amber" : "neutral"}>{COLLECTION_STATUS_LABEL[c.status] ?? c.status}</Badge>
          <span className="text-sm text-muted-foreground">{c.counts.total} ta savol: {c.counts.verified} tekshirilgan, {c.counts.userSet} o'qituvchi belgilagan, {c.counts.unverified} tasdiqlanmagan</span>
        </div>
        {renaming ? (
          <div className="flex gap-2"><Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} aria-label="Test nomi" /><Button onClick={() => void rename()} loading={busy === "rename"}>Saqlash</Button></div>
        ) : (
          <div className="flex items-center gap-2"><h2 className="text-xl font-bold">{c.title}</h2>{c.editable && <Button variant="ghost" size="icon" aria-label="Nomini o'zgartirish" onClick={() => setRenaming(true)}><Pencil className="h-4 w-4" aria-hidden /></Button>}</div>
        )}
        {c.sourceNote && <p className="text-sm text-muted-foreground">Manba: {c.sourceNote}</p>}

        <div className="flex flex-wrap gap-2">
          <Button disabled={c.counts.total === 0} onClick={() => setStartMode("practice")}><PlayCircle className="h-4 w-4" aria-hidden />Mashq qilish</Button>
          <Button variant="outline" disabled={c.counts.total === 0} onClick={() => setStartMode("test")}><Timer className="h-4 w-4" aria-hidden />Test ishlash</Button>
          <Button variant="outline" disabled={c.counts.total === 0} onClick={() => setStartMode("diagnostic")}><ClipboardCheck className="h-4 w-4" aria-hidden />Diagnostika</Button>
          {c.importSessionId && <Button asChild variant="ghost"><Link href={`/ustoz-ai/import/${c.importSessionId}`}><FileSearch className="h-4 w-4" aria-hidden />Manbani qayta tekshirish</Link></Button>}
          <span className="flex-1" />
          {submitted ? (
            <Button variant="outline" loading={busy === "withdraw"} onClick={() => void act("withdraw", () => api(`/api/personal-tests/${c.id}/submit`, "DELETE"), "Yuborish qaytarib olindi.")}><Undo2 className="h-4 w-4" aria-hidden />Yuborishni qaytarish</Button>
          ) : (
            <Button variant="outline" disabled={!canShare} onClick={() => setShareOpen(true)}><Share2 className="h-4 w-4" aria-hidden />Barcha ustozlar uchun ulashish</Button>
          )}
          <Button variant="ghost" disabled={submitted} loading={busy === "delete"} onClick={() => void removeCol()}><Trash2 className="h-4 w-4" aria-hidden />O'chirish</Button>
        </div>
        {subLast && <p className="rounded-xl bg-muted px-3 py-2 text-sm text-muted-foreground">Oxirgi yuborish: <b className="text-foreground">{SUB_LABEL[subLast.status] ?? subLast.status}</b>{subLast.notes ? ` — ${subLast.notes}` : ""}</p>}
        {c.status === "PUBLIC_APPROVED" && <p className="text-sm text-success">Admin tasdiqlagan savollar umumiy bankka qo'shilgan. Sizning shaxsiy nusxangiz o'zgarmaydi.</p>}
      </Card>

      {c.questions.length === 0 ? <EmptyState title="Testda savol yo'q" text="Manba importidan savollarni tasdiqlab, testga saqlang." /> : (
        <ol className="space-y-3">
          {c.questions.map((q, n) => (
            <li key={q.id}>
              <Card className="p-4">
                <div className="flex items-start gap-3">
                  <span className="grid h-7 min-w-7 place-items-center rounded-lg bg-muted px-1.5 text-xs font-bold">{n + 1}</span>
                  <p className="min-w-0 flex-1 whitespace-pre-wrap text-sm font-medium">{q.text}</p>
                  <Badge variant={ANSWER_TONE[q.answerStatus ?? "UNVERIFIED"] ?? "amber"} className="shrink-0">{ANSWER_STATUS_LABEL[q.answerStatus ?? "UNVERIFIED"] ?? q.answerStatus}</Badge>
                </div>
                <ul className="mt-2 space-y-1 pl-10">
                  {q.options.map((o) => <li key={o.id} className={cn("flex gap-2 rounded-lg px-2 py-1 text-sm", o.isCorrect && "bg-success/10 font-semibold text-success")}><span className="w-5 shrink-0 font-bold">{o.label}</span><span>{o.text}</span></li>)}
                </ul>
                {q.sourceRef && <p className="mt-2 pl-10 text-xs text-muted-foreground">Manba: {q.sourceRef}</p>}
                {c.editable && (
                  <div className="mt-2 flex gap-2 pl-10">
                    <Button size="sm" variant="outline" onClick={() => setEdit(q)}><Pencil className="h-4 w-4" aria-hidden />Tahrirlash</Button>
                    <Button size="sm" variant="ghost" disabled={busy === "q"} onClick={() => removeQ(q)}><Trash2 className="h-4 w-4" aria-hidden />Olib tashlash</Button>
                  </div>
                )}
              </Card>
            </li>
          ))}
        </ol>
      )}

      <EditQuestion colId={c.id} q={edit} onClose={() => setEdit(null)} onSaved={reload} />

      <Dialog open={startMode !== null} onOpenChange={(v) => { if (!v) setStartMode(null); }}>
        <DialogContent title={startMode === "practice" ? "Mashq qilish" : startMode === "test" ? "Test ishlash" : "Diagnostika"}
          description={startMode === "diagnostic" ? "Diagnostikada to'g'ri javoblar test tugaguncha ko'rsatilmaydi." : startMode === "test" ? "Mavzuli test: natija yakunda ko'rinadi." : "Har javobdan keyin izoh ochiladi."}>
          <div className="space-y-3.5">
            {startMode !== "practice" && <Field label="Vaqt (daqiqa, ixtiyoriy)"><Input type="number" min={1} max={180} value={duration} onChange={(e) => setDuration(e.target.value)} placeholder="Vaqtsiz" /></Field>}
            {startMode === "diagnostic" && (
              <div className="rounded-xl bg-muted p-3 text-sm">
                <p>Diagnostikaga <b>{safe}</b> ta tekshirilgan yoki o'qituvchi tasdiqlagan savol kiradi.{c.counts.unverified > 0 ? ` ${c.counts.unverified} ta tasdiqlanmagan savol ball hisobiga avtomatik kiritilmaydi.` : ""}</p>
                {c.counts.unverified > 0 && <label className="mt-2 flex items-center gap-2"><input type="checkbox" checked={includeUnverified} onChange={(e) => setIncludeUnverified(e.target.checked)} className="h-4 w-4" />Tasdiqlanmagan savollarni ham qo'shish</label>}
              </div>
            )}
            <div className="flex justify-end gap-2"><Button variant="ghost" onClick={() => setStartMode(null)}>Bekor qilish</Button><Button loading={busy === "start"} disabled={startMode === "diagnostic" && safe === 0 && !includeUnverified} onClick={() => void start()}>Boshlash</Button></div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={shareOpen} onOpenChange={setShareOpen}>
        <DialogContent title="Barcha ustozlar uchun ulashish" description="Test avval adminga ko'rib chiqish uchun yuboriladi. Admin tasdiqlasagina savollar umumiy bankka o'tadi.">
          <div className="space-y-3.5">
            <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
              <li>Tasdiqlanmagan javobli savollar admin aniq tasdiqlamasa o'tmaydi.</li>
              <li>Admin savolni tahrirlashi yoki rad etishi mumkin.</li>
              <li>Shaxsiy nusxangiz har doim sizda qoladi.</li>
            </ul>
            <label className="flex items-start gap-2 rounded-xl border border-border p-3 text-sm"><input type="checkbox" checked={rights} onChange={(e) => setRights(e.target.checked)} className="mt-0.5 h-4 w-4" /><span>Men bu materialni boshqa ustozlar bilan ulashish huquqiga egaman (muallifman yoki ruxsatim bor).</span></label>
            <Field label="Manba / ruxsat izohi (ixtiyoriy)"><Input value={rightsNote} onChange={(e) => setRightsNote(e.target.value)} maxLength={500} /></Field>
            <Field label="Adminga izoh (ixtiyoriy)"><Textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} className="min-h-20" /></Field>
            <div className="flex justify-end gap-2"><Button variant="ghost" onClick={() => setShareOpen(false)}>Bekor qilish</Button><Button loading={busy === "submit"} disabled={!rights} onClick={() => void submit()}>Adminga yuborish</Button></div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function Page() {
  const { id } = useParams<{ id: string }>();
  const q = useQuery<CollectionView>(id ? `/api/personal-tests/${id}` : null);
  return (
    <div className="mx-auto max-w-4xl">
      <SectionHeader title="Shaxsiy test" lead="Savollarni ko'ring, tahrirlang, mashq qiling yoki diagnostikaga yuboring." back={{ href: "/ustoz-ai/testlarim", label: "Mening testlarim" }} />
      <QueryView q={q}>{(c) => <Detail c={c} reload={q.reload} />}</QueryView>
    </div>
  );
}
