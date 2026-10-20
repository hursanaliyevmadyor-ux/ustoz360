"use client";
import * as React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Check, ListChecks, PenLine, Pencil, Plus, Trash2, X } from "lucide-react";
import { adminModule } from "@/lib/modules";
import { api } from "@/lib/admin-client";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/layout/page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { EmptyState } from "@/components/ui/states";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/ui/toast";

type Q = { id: string; position: number; type: "CHOICE" | "WRITTEN"; text: string; options: string[]; correct: number | null; accepted: string[]; explanation: string };
type Exam = { id: string; title: string; subject: string; kind: string; durationMin: number; pickCount: number | null; active: boolean; directionKey: string | null; rankingEligible: boolean; attemptCount: number; questions: Q[] };
const LETTERS = "ABCDEFGH";

export default function Page() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter(); const toast = useToast();
  const [exam, setExam] = React.useState<Exam | null>(null);
  const [err, setErr] = React.useState("");
  const [meta, setMeta] = React.useState({ title: "", subject: "", durationMin: "30", pickCount: "", active: false, directionKey: "", rankingEligible: false });
  const [directions, setDirections] = React.useState<{ key: string; label: string }[]>([]);
  const [saving, setSaving] = React.useState(false);
  const [edit, setEdit] = React.useState<Q | "new" | null>(null);

  const load = React.useCallback(async () => {
    const r = await api<Exam>(`/api/admin/exams/${id}`);
    if (!r.ok) { setErr(r.error); return; }
    setExam(r.data);
    setMeta({ title: r.data.title, subject: r.data.subject, durationMin: String(r.data.durationMin), pickCount: r.data.pickCount ? String(r.data.pickCount) : "", active: r.data.active, directionKey: r.data.directionKey ?? "", rankingEligible: r.data.rankingEligible });
  }, [id]);
  React.useEffect(() => { void load(); }, [load]);
  React.useEffect(() => { void (async () => { const r = await api<{ directions: { key: string; label: string }[] }>("/api/leaderboard/directions"); if (r.ok) setDirections(r.data.directions.filter((d) => d.key !== "ALL")); })(); }, []);

  const saveMeta = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true);
    const r = await api(`/api/admin/exams/${id}`, "PUT", { title: meta.title, subject: meta.subject, durationMin: Number(meta.durationMin), pickCount: meta.pickCount ? Number(meta.pickCount) : null, active: meta.active, directionKey: meta.directionKey || null, rankingEligible: meta.rankingEligible });
    setSaving(false);
    if (!r.ok) { toast("error", r.error); return; }
    toast("success", "Saqlandi."); void load();
  };
  const removeExam = async () => {
    if (!window.confirm("Imtihonni o'chirasizmi? Agar urinishlar bo'lsa, u o'chirilmay, faqat yashiriladi.")) return;
    const r = await api<{ archived?: boolean }>(`/api/admin/exams/${id}`, "DELETE");
    if (!r.ok) { toast("error", r.error); return; }
    toast("success", r.data.archived ? "Urinishlar bor edi: imtihon yashirildi." : "Imtihon o'chirildi."); router.push("/admin/imtihonlar");
  };
  const removeQ = async (q: Q) => {
    if (!window.confirm(`«${q.text.slice(0, 60)}» savolini o'chirasizmi?`)) return;
    const r = await api(`/api/admin/questions/${q.id}`, "DELETE");
    if (!r.ok) { toast("error", r.error); return; }
    toast("success", "Savol o'chirildi."); void load();
  };

  if (err) return <p role="alert" className="rounded-xl bg-danger/10 p-3 text-sm text-danger">{err}</p>;
  if (!exam) return <p className="text-sm text-muted-foreground">Yuklanmoqda...</p>;

  return (
    <>
      <PageHeader module={adminModule} title={exam.title} description="Imtihon ma'lumotlari va savollari"
        actions={<Button asChild variant="outline"><Link href="/admin/imtihonlar"><ArrowLeft className="h-4 w-4" />Ro'yxat</Link></Button>} />

      <Card className="mb-6">
        <CardHeader><div><CardTitle>Umumiy ma'lumot</CardTitle><CardDescription>Imtihon turi (variantli, yozma yoki aralash) savollarga qarab o'zi aniqlanadi.</CardDescription></div></CardHeader>
        <CardContent>
          <form onSubmit={saveMeta} className="grid gap-4 md:grid-cols-2">
            <Field label="Imtihon nomi"><Input value={meta.title} onChange={(e) => setMeta({ ...meta, title: e.target.value })} required maxLength={120} /></Field>
            <Field label="Fan"><Input value={meta.subject} onChange={(e) => setMeta({ ...meta, subject: e.target.value })} required maxLength={80} /></Field>
            <Field label="Vaqt (daqiqa)"><Input type="number" min={1} max={300} value={meta.durationMin} onChange={(e) => setMeta({ ...meta, durationMin: e.target.value })} required /></Field>
            <Field label="Nechta savol tushsin" hint={`Bo'sh qoldirsangiz, hamma ${exam.questions.length} ta savol tushadi. Kamroq yozsangiz, bankdan har safar tasodifiy tanlanadi.`}>
              <Input type="number" min={1} max={500} value={meta.pickCount} onChange={(e) => setMeta({ ...meta, pickCount: e.target.value })} placeholder="Hammasi" />
            </Field>
            <label className="flex items-center gap-3 md:col-span-2">
              <Switch checked={meta.active} onCheckedChange={(v) => setMeta({ ...meta, active: v })} aria-label="Foydalanuvchilarga ko'rsatilsin" />
              <span className="text-sm"><b>Foydalanuvchilarga ko'rsatilsin</b><span className="block text-muted-foreground">O'chiq bo'lsa, imtihon faqat sizga ko'rinadi (tayyorlanyapti).</span></span>
            </label>
            <Field label="Tayyorlanish yo'nalishi" hint="Bo'sh: hamma yo'nalish uchun umumiy imtihon.">
              <Select value={meta.directionKey} onChange={(e) => setMeta({ ...meta, directionKey: e.target.value })}>
                <option value="">Umumiy (hamma yo'nalish)</option>
                {directions.map((d) => <option key={d.key} value={d.key}>{d.label}</option>)}
              </Select>
            </Field>
            <label className="flex items-center gap-3 md:col-span-2">
              <Switch checked={meta.rankingEligible} onCheckedChange={(v) => setMeta({ ...meta, rankingEligible: v })} aria-label="Reytingga hisoblansin" />
              <span className="text-sm"><b>Reytingga hisoblansin</b><span className="block text-muted-foreground">Faqat siz tasdiqlagan imtihon natijalari ustozlar reytingiga kiradi. Nashr qilish reytingga avtomatik qo'shmaydi. Imtihon yetarli ishtirokchi topshirgandan keyingina taqqoslanadi.</span></span>
            </label>
            <div className="flex flex-wrap gap-3 md:col-span-2">
              <Button type="submit" loading={saving}>Saqlash</Button>
              <Button type="button" variant="danger" onClick={removeExam}><Trash2 className="h-4 w-4" />Imtihonni o'chirish</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div><CardTitle>Savollar ({exam.questions.length})</CardTitle><CardDescription>Har bir savolning turini siz tanlaysiz: variantli yoki yozma javobli.</CardDescription></div>
          <Button onClick={() => setEdit("new")}><Plus className="h-4 w-4" />Savol qo'shish</Button>
        </CardHeader>
        <CardContent>
          {exam.questions.length === 0 ? <EmptyState title="Savollar yo'q" text="«Savol qo'shish» tugmasi bilan birinchi savolni kiriting." /> : (
            <ol className="space-y-3">
              {exam.questions.map((q, i) => (
                <li key={q.id} className="rounded-2xl border border-border p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="mb-1 flex items-center gap-2"><Badge variant={q.type === "CHOICE" ? "blue" : "amber"}>{q.type === "CHOICE" ? "Variantli" : "Yozma"}</Badge><span className="text-xs text-muted-foreground">{i + 1}-savol</span></p>
                      <p className="whitespace-pre-wrap font-semibold">{q.text}</p>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <Button variant="ghost" size="icon" aria-label="Tahrirlash" onClick={() => setEdit(q)}><Pencil className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" aria-label="O'chirish" onClick={() => removeQ(q)}><Trash2 className="h-4 w-4 text-danger" /></Button>
                    </div>
                  </div>
                  {q.type === "CHOICE" ? (
                    <ul className="mt-3 grid gap-1.5 sm:grid-cols-2">
                      {q.options.map((o, k) => (
                        <li key={k} className={cn("flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm", k === q.correct ? "bg-success/15 font-semibold" : "bg-muted")}>
                          <b>{LETTERS[k]}.</b><span className="min-w-0 flex-1 break-words">{o}</span>{k === q.correct && <Check className="h-4 w-4 shrink-0 text-success" aria-label="To'g'ri" />}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-3 text-sm text-muted-foreground">To'g'ri javoblar: {q.accepted.map((a) => <code key={a} className="mr-1.5 rounded bg-muted px-1.5 py-0.5 text-foreground">{a}</code>)}</p>
                  )}
                </li>
              ))}
            </ol>
          )}
        </CardContent>
      </Card>

      {edit && <QuestionDialog examId={id} q={edit === "new" ? null : edit} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); void load(); }} />}
    </>
  );
}

function QuestionDialog({ examId, q, onClose, onSaved }: { examId: string; q: Q | null; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [type, setType] = React.useState<"CHOICE" | "WRITTEN">(q?.type ?? "CHOICE");
  const [text, setText] = React.useState(q?.text ?? "");
  const [options, setOptions] = React.useState<string[]>(q?.type === "CHOICE" && q.options.length ? q.options : ["", "", "", ""]);
  const [correct, setCorrect] = React.useState<number>(q?.correct ?? 0);
  const [accepted, setAccepted] = React.useState<string[]>(q?.type === "WRITTEN" && q.accepted.length ? q.accepted : [""]);
  const [explanation, setExplanation] = React.useState(q?.explanation ?? "");
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState("");

  const setOpt = (i: number, v: string) => setOptions((o) => o.map((x, k) => (k === i ? v : x)));
  const delOpt = (i: number) => { setOptions((o) => o.filter((_, k) => k !== i)); setCorrect((c) => (c === i ? 0 : c > i ? c - 1 : c)); };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setErr("");
    const body = type === "CHOICE"
      ? { type, text, options: options.map((o) => o.trim()), correct, explanation }
      : { type, text, accepted: accepted.map((a) => a.trim()).filter(Boolean), explanation };
    if (type === "CHOICE" && body.type === "CHOICE" && body.options.some((o) => !o)) { setErr("Bo'sh variantlarni to'ldiring yoki o'chiring."); return; }
    setBusy(true);
    const r = q ? await api(`/api/admin/questions/${q.id}`, "PUT", body) : await api(`/api/admin/exams/${examId}/questions`, "POST", body);
    setBusy(false);
    if (!r.ok) { setErr(r.error); return; }
    toast("success", q ? "Savol yangilandi." : "Savol qo'shildi."); onSaved();
  };

  return (
    <Dialog open onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent title={q ? "Savolni tahrirlash" : "Yangi savol"} description="Savol turini tanlang va to'ldiring." className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <form onSubmit={submit} className="space-y-5">
          <div role="group" aria-label="Savol turi" className="grid grid-cols-2 gap-2 rounded-xl bg-muted p-1">
            {([["CHOICE", "Variantli", ListChecks], ["WRITTEN", "Yozma javob", PenLine]] as const).map(([k, label, Icon]) => (
              <button key={k} type="button" aria-pressed={type === k} onClick={() => setType(k)}
                className={cn("flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold", type === k ? "bg-card shadow-soft" : "text-muted-foreground")}><Icon className="h-4 w-4" />{label}</button>
            ))}
          </div>

          <Field label="Savol matni"><Textarea value={text} onChange={(e) => setText(e.target.value)} required maxLength={2000} placeholder="Savolni yozing..." autoFocus /></Field>

          {type === "CHOICE" ? (
            <fieldset className="space-y-2">
              <legend className="mb-1 text-sm font-semibold">Variantlar <span className="font-normal text-muted-foreground">(to'g'ri javob yonidagi doirani belgilang)</span></legend>
              {options.map((o, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input type="radio" name="correct" checked={correct === i} onChange={() => setCorrect(i)} aria-label={`${LETTERS[i]} variant to'g'ri`} className="h-5 w-5 shrink-0 accent-[hsl(var(--success))]" />
                  <span className="w-5 shrink-0 text-center text-sm font-bold text-muted-foreground">{LETTERS[i]}</span>
                  <Input value={o} onChange={(e) => setOpt(i, e.target.value)} placeholder={`${LETTERS[i]} variant`} maxLength={300} aria-label={`${LETTERS[i]} variant matni`} />
                  <Button type="button" variant="ghost" size="icon" disabled={options.length <= 2} onClick={() => delOpt(i)} aria-label="Variantni o'chirish"><X className="h-4 w-4" /></Button>
                </div>
              ))}
              <Button type="button" variant="outline" size="sm" disabled={options.length >= 8} onClick={() => setOptions((o) => [...o, ""])}><Plus className="h-4 w-4" />Variant qo'shish</Button>
              <p className="text-xs text-muted-foreground">Variantlar soni sizning ixtiyoringizda (2 tadan 8 tagacha). Talabaga ular har safar aralash tartibda ko'rsatiladi.</p>
            </fieldset>
          ) : (
            <fieldset className="space-y-2">
              <legend className="mb-1 text-sm font-semibold">To'g'ri javob(lar)</legend>
              {accepted.map((a, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Input value={a} onChange={(e) => setAccepted((l) => l.map((x, k) => (k === i ? e.target.value : x)))} placeholder={i === 0 ? "Masalan: 25" : "Boshqa to'g'ri yozilishi"} maxLength={200} aria-label={`To'g'ri javob ${i + 1}`} />
                  <Button type="button" variant="ghost" size="icon" disabled={accepted.length <= 1} onClick={() => setAccepted((l) => l.filter((_, k) => k !== i))} aria-label="O'chirish"><X className="h-4 w-4" /></Button>
                </div>
              ))}
              <Button type="button" variant="outline" size="sm" disabled={accepted.length >= 10} onClick={() => setAccepted((l) => [...l, ""])}><Plus className="h-4 w-4" />Yana bir yozilish qo'shish</Button>
              <p className="text-xs text-muted-foreground">Talaba yozgan javob shulardan biriga mos kelsa, to'g'ri hisoblanadi. Katta-kichik harf, ortiqcha bo'shliq va oxirgi nuqta e'tiborga olinmaydi.</p>
            </fieldset>
          )}

          <Field label="Izoh (ixtiyoriy)" hint="Natija tahlilida to'g'ri javob yonida ko'rsatiladi."><Textarea value={explanation} onChange={(e) => setExplanation(e.target.value)} maxLength={1000} className="min-h-16" /></Field>

          {err && <p role="alert" className="rounded-xl bg-danger/10 p-3 text-sm text-danger">{err}</p>}
          <div className="flex justify-end gap-3"><Button type="button" variant="outline" onClick={onClose}>Bekor qilish</Button><Button type="submit" loading={busy}>Saqlash</Button></div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
