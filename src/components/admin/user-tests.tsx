"use client";
import * as React from "react";
import { AlertTriangle, Check, Pencil, X } from "lucide-react";
import { api } from "@/lib/admin-client";
import { useQuery } from "@/lib/use-query";
import { ANSWER_STATUS_LABEL, dateText } from "@/lib/import-client";
import { FigureText } from "@/components/figure-text";
import { QueryView } from "@/components/layout/query-view";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Field, Select, Textarea } from "@/components/ui/form";
import { EmptyState } from "@/components/ui/states";
import { Table, Td, Th } from "@/components/ui/table";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

type Counts = { total: number; verified: number; userSet: number; unverified: number };
type Row = { id: string; status: string; submittedAt: string; reviewedAt: string | null; rightsConfirmed: boolean; publishedCount: number; user: string; collection: { id: string; title: string; subject: string | null; status: string }; counts: Counts };
type List = { counts: Record<string, number>; items: Row[] };
type Q = {
  id: string; pos: number | null; text: string; explanation: string; difficulty: string; sourceRef: string | null; answerStatus: string | null;
  topic: { id: string; name: string; subject: string; unclassified: boolean }; options: { label: string; text: string; isCorrect: boolean }[];
  ai: { status: string; origin: string; confidence: string | null; evidence: number; keySource: string | null } | null; similar: { id: string; text: string; score: number } | null;
};
type Detail = { id: string; status: string; submittedAt: string; reviewNotes: string | null; rightsConfirmed: boolean; rightsNote: string | null; note: string | null; publishedCount: number; published: number; user: string; collection: { id: string; title: string; subject: string | null; sourceNote: string | null; status: string }; questions: Q[] };
type Edit = { text?: string; options?: string[]; correct?: number; explanation?: string };
type Decisions = Record<string, { decision: "APPROVED" | "REJECTED"; edit?: Edit }>;
type Topics = { subjects: { id: string; name: string; topics: { id: string; name: string }[] }[] };

const STATUS: Record<string, { label: string; tone: "amber" | "success" | "danger" | "neutral" | "blue" }> = {
  SUBMITTED: { label: "Kutmoqda", tone: "amber" }, APPROVED: { label: "Tasdiqlangan", tone: "success" }, APPROVED_EDITED: { label: "Tahrir bilan tasdiqlangan", tone: "success" },
  NEEDS_RECHECK: { label: "Qayta tekshirishda", tone: "blue" }, REJECTED: { label: "Rad etilgan", tone: "danger" }, ARCHIVED: { label: "Arxiv", tone: "neutral" },
};
const FILTERS = [["", "Hammasi"], ["SUBMITTED", "Kutmoqda"], ["NEEDS_RECHECK", "Qayta tekshirishda"], ["APPROVED", "Tasdiqlangan"], ["REJECTED", "Rad etilgan"], ["ARCHIVED", "Arxiv"]] as const;
const LABELS = "ABCDEFGHIJ";

function QuestionReview({ q, decision, edited, onDecide, onEdit }: { q: Q; decision: "APPROVED" | "REJECTED"; edited: boolean; onDecide: (d: "APPROVED" | "REJECTED") => void; onEdit: (e: Edit | null) => void }) {
  const [open, setOpen] = React.useState(false);
  const [text, setText] = React.useState(q.text);
  const [opts, setOpts] = React.useState(q.options.map((o) => o.text));
  const [correct, setCorrect] = React.useState(Math.max(0, q.options.findIndex((o) => o.isCorrect)));
  const [expl, setExpl] = React.useState(q.explanation);
  const apply = () => {
    const e: Edit = {};
    if (text.trim() !== q.text) e.text = text.trim();
    if (JSON.stringify(opts.map((o) => o.trim())) !== JSON.stringify(q.options.map((o) => o.text))) e.options = opts.map((o) => o.trim());
    if (correct !== Math.max(0, q.options.findIndex((o) => o.isCorrect))) e.correct = correct;
    if (expl.trim() !== q.explanation) e.explanation = expl.trim();
    onEdit(Object.keys(e).length ? e : null); setOpen(false);
  };
  const unverified = q.answerStatus === "UNVERIFIED";
  return (
    <li className={cn("rounded-xl border bg-card p-3", decision === "REJECTED" ? "border-danger/30 bg-danger/5" : "border-border")}>
      <div className="flex flex-wrap items-start gap-2">
        <span className="grid h-6 min-w-6 place-items-center rounded-md bg-muted px-1 text-xs font-bold">{(q.pos ?? 0) + 1}</span>
        <div className="min-w-0 flex-1 text-sm font-medium"><FigureText text={q.text} /></div>
        <Badge variant={unverified ? "amber" : q.answerStatus === "VERIFIED" ? "success" : "blue"}>{ANSWER_STATUS_LABEL[q.answerStatus ?? "UNVERIFIED"]}</Badge>
      </div>
      <ul className="mt-2 space-y-0.5 pl-8">{q.options.map((o) => <li key={o.label} className={cn("flex gap-2 rounded-md px-1.5 py-0.5 text-sm", o.isCorrect && "bg-success/10 font-semibold text-success")}><span className="w-4 shrink-0 font-bold">{o.label}</span>{o.text}</li>)}</ul>
      <div className="mt-2 flex flex-wrap items-center gap-1.5 pl-8 text-xs text-muted-foreground">
        <span>{q.topic.unclassified ? "Mavzu aniqlanmagan" : `${q.topic.subject} · ${q.topic.name}`}</span>
        {q.ai && <span>· AI: {q.ai.status}{q.ai.confidence ? `, ${q.ai.confidence}` : ""}, manba: {q.ai.evidence}</span>}
        {edited && <Badge variant="blue">Tahrirlangan</Badge>}
      </div>
      {q.similar && <p className="mt-2 flex items-start gap-1.5 pl-8 text-xs text-amber"><AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />Bankda o'xshash savol bor ({Math.round(q.similar.score * 100)}%): «{q.similar.text}»</p>}
      {unverified && decision === "APPROVED" && <p className="mt-2 pl-8 text-xs text-amber">Javobi tasdiqlanmagan savolni faqat siz tekshirib chiqqaningizdan keyin qabul qiling.</p>}
      <div className="mt-2 flex flex-wrap gap-1.5 pl-8">
        <Button size="sm" variant={decision === "APPROVED" ? "success" : "outline"} onClick={() => onDecide("APPROVED")}><Check className="h-4 w-4" aria-hidden />Qabul</Button>
        <Button size="sm" variant={decision === "REJECTED" ? "danger" : "outline"} onClick={() => onDecide("REJECTED")}><X className="h-4 w-4" aria-hidden />Rad</Button>
        <Button size="sm" variant="ghost" onClick={() => setOpen((v) => !v)}><Pencil className="h-4 w-4" aria-hidden />Tahrirlash</Button>
      </div>
      {open && (
        <div className="mt-3 space-y-2 border-t border-border pt-3 pl-8">
          <Textarea value={text} onChange={(e) => setText(e.target.value)} aria-label="Savol matni" />
          {opts.map((o, i) => (
            <div key={i} className="flex items-center gap-2">
              <input type="radio" name={`c-${q.id}`} checked={correct === i} onChange={() => setCorrect(i)} aria-label={`${LABELS[i]} to'g'ri`} className="h-4 w-4" />
              <span className="w-5 text-sm font-bold">{LABELS[i]}</span>
              <input value={o} onChange={(e) => setOpts((a) => a.map((x, k) => (k === i ? e.target.value : x)))} aria-label={`${LABELS[i]} variant`} className="h-9 min-w-0 flex-1 rounded-lg border border-border bg-card px-2.5 text-sm" />
            </div>
          ))}
          <Textarea value={expl} onChange={(e) => setExpl(e.target.value)} aria-label="Izoh" placeholder="Izoh (ixtiyoriy)" className="min-h-16" />
          <div className="flex gap-2"><Button size="sm" onClick={apply}>Tahrirni qo'llash</Button><Button size="sm" variant="ghost" onClick={() => setOpen(false)}>Yopish</Button></div>
        </div>
      )}
    </li>
  );
}

function ReviewDialog({ id, onClose, onDone }: { id: string | null; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const q = useQuery<Detail>(id ? `/api/admin/import-submissions/${id}` : null);
  const topics = useQuery<Topics>(id ? "/api/practice/topics" : null);
  const [dec, setDec] = React.useState<Decisions>({});
  const [topicId, setTopicId] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [busy, setBusy] = React.useState<string | null>(null);
  React.useEffect(() => { setDec({}); setTopicId(""); setNotes(""); }, [id]);

  const d = q.data;
  const open = d?.status === "SUBMITTED";
  const effective = (x: Q) => dec[x.id]?.decision ?? (x.answerStatus === "UNVERIFIED" ? "REJECTED" : "APPROVED");
  const needTopic = !!d?.questions.some((x) => x.topic.unclassified && effective(x) === "APPROVED");
  const accepted = d ? d.questions.filter((x) => effective(x) === "APPROVED").length : 0;

  const setDecision = (x: Q, decision: "APPROVED" | "REJECTED") => setDec((m) => ({ ...m, [x.id]: { ...m[x.id], decision } }));
  const setEdit = (x: Q, edit: Edit | null) => setDec((m) => ({ ...m, [x.id]: { decision: m[x.id]?.decision ?? effective(x), ...(edit && { edit }) } }));

  const review = async (action: "approve" | "recheck" | "reject" | "archive") => {
    if (!d) return;
    if (action === "approve" && accepted === 0) { toast("error", "Kamida bitta savolni qabul qiling."); return; }
    if (action === "approve" && needTopic && !topicId) { toast("error", "Mavzusi aniqlanmagan savollar uchun mavzuni tanlang."); return; }
    if (action === "reject" && !window.confirm("Test rad etiladi. Foydalanuvchida shaxsiy nusxa qoladi. Davom etamizmi?")) return;
    setBusy(action);
    const r = await api(`/api/admin/import-submissions/${d.id}`, "POST", { action, ...(notes.trim() && { notes: notes.trim() }), ...(action === "approve" && { decisions: dec, ...(topicId && { topicId }) }) });
    setBusy(null);
    if (!r.ok) { toast("error", r.error); return; }
    toast("success", action === "approve" ? "Tasdiqlandi: savollar umumiy bankka qo'shildi." : action === "reject" ? "Test rad etildi." : action === "recheck" ? "Foydalanuvchiga qayta tekshirish uchun qaytarildi." : "Arxivga olindi.");
    onDone(); onClose();
  };

  return (
    <Dialog open={!!id} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent title={d?.collection.title ?? "Yuborilgan test"} description="Faqat siz tasdiqlagan savollar umumiy bankka o'tadi." className="max-h-[92vh] max-w-4xl overflow-y-auto">
        <QueryView q={q}>
          {(x) => (
            <div className="space-y-4">
              <div className="grid gap-2 rounded-xl bg-muted p-3 text-sm sm:grid-cols-2">
                <p><span className="text-muted-foreground">Yuboruvchi:</span> <b>{x.user}</b></p>
                <p><span className="text-muted-foreground">Sana:</span> <b>{dateText(x.submittedAt)}</b></p>
                <p><span className="text-muted-foreground">Manba:</span> {x.collection.sourceNote ?? "—"}</p>
                <p><span className="text-muted-foreground">Ulashish huquqi:</span> <b className={x.rightsConfirmed ? "text-success" : "text-danger"}>{x.rightsConfirmed ? "tasdiqlangan" : "tasdiqlanmagan"}</b>{x.rightsNote ? ` — ${x.rightsNote}` : ""}</p>
                {x.note && <p className="sm:col-span-2"><span className="text-muted-foreground">Izoh:</span> {x.note}</p>}
              </div>
              {!x.rightsConfirmed && <p role="alert" className="rounded-xl bg-danger/10 p-3 text-sm text-danger">Foydalanuvchi ulashish huquqini tasdiqlamagan: umumiy bankka o'tkazib bo'lmaydi.</p>}
              {x.status !== "SUBMITTED" && <p className="rounded-xl bg-muted p-3 text-sm">Holat: <b>{STATUS[x.status]?.label ?? x.status}</b>{x.reviewNotes ? ` — ${x.reviewNotes}` : ""}{x.published ? ` · umumiy bankda ${x.published} ta savol bor` : ""}</p>}

              <ul className="space-y-2.5">
                {x.questions.map((qq) => (
                  <QuestionReview key={qq.id} q={qq} decision={open ? effective(qq) : "APPROVED"} edited={!!dec[qq.id]?.edit} onDecide={(v) => setDecision(qq, v)} onEdit={(e) => setEdit(qq, e)} />
                ))}
              </ul>

              {open && (
                <div className="space-y-3 border-t border-border pt-4">
                  {needTopic && (
                    <Field label="Mavzu (tasniflanmagan savollar uchun majburiy)">
                      <Select value={topicId} onChange={(e) => setTopicId(e.target.value)}>
                        <option value="">Mavzuni tanlang</option>
                        {(topics.data?.subjects ?? []).filter((s) => s.topics.length).map((s) => <optgroup key={s.id} label={s.name}>{s.topics.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</optgroup>)}
                      </Select>
                    </Field>
                  )}
                  <Field label="Foydalanuvchiga izoh (ixtiyoriy)"><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={1000} className="min-h-20" /></Field>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button variant="success" loading={busy === "approve"} disabled={!x.rightsConfirmed || busy !== null} onClick={() => void review("approve")}><Check className="h-4 w-4" aria-hidden />Tasdiqlash ({accepted})</Button>
                    <Button variant="outline" loading={busy === "recheck"} disabled={busy !== null} onClick={() => void review("recheck")}>Qayta tekshirishga qaytarish</Button>
                    <Button variant="danger" loading={busy === "reject"} disabled={busy !== null} onClick={() => void review("reject")}>Rad etish</Button>
                  </div>
                </div>
              )}
              {["APPROVED", "APPROVED_EDITED"].includes(x.status) && (
                <div className="border-t border-border pt-4"><Button variant="outline" loading={busy === "archive"} onClick={() => { if (window.confirm("Umumiy bankdagi nusxalar arxivga olinadi. Davom etamizmi?")) void review("archive"); }}>Umumiy bankdan arxivga olish</Button></div>
              )}
            </div>
          )}
        </QueryView>
      </DialogContent>
    </Dialog>
  );
}

/** Foydalanuvchilar yuborgan shaxsiy testlar: ro'yxat va ko'rib chiqish (tasdiqlash / tahrirlab tasdiqlash / qayta tekshirish / rad etish / arxiv). Hamma amal audit jurnaliga yoziladi. */
export function UserTests() {
  const [status, setStatus] = React.useState("");
  const q = useQuery<List>(`/api/admin/import-submissions${status ? `?status=${status}` : ""}`);
  const [open, setOpen] = React.useState<string | null>(null);
  return (
    <div className="space-y-4">
      <div role="tablist" aria-label="Holat bo'yicha filtr" className="flex gap-1.5 overflow-x-auto pb-1">
        {FILTERS.map(([v, l]) => (
          <button key={v} role="tab" aria-selected={status === v} onClick={() => setStatus(v)} className={cn("shrink-0 whitespace-nowrap rounded-full border px-3.5 py-1.5 text-sm font-semibold", status === v ? "border-primary bg-primary text-white" : "border-border bg-card hover:bg-muted")}>
            {l}{v && q.data?.counts[v] ? <span className="ml-1.5 text-xs opacity-80">{q.data.counts[v]}</span> : null}
          </button>
        ))}
      </div>
      <QueryView q={q}>
        {(d) => d.items.length === 0 ? <EmptyState title="Yuborilgan test yo'q" text="Ustozlar «Barcha ustozlar uchun ulashish»ni bossa, testlar shu yerda paydo bo'ladi." /> : (
          <Card><Table>
            <thead><tr><Th>Test</Th><Th>Yuboruvchi</Th><Th>Savollar</Th><Th>Sana</Th><Th>Holat</Th><Th><span className="sr-only">Amal</span></Th></tr></thead>
            <tbody>
              {d.items.map((r) => (
                <tr key={r.id}>
                  <Td><p className="font-semibold">{r.collection.title}</p>{r.collection.subject && <p className="text-xs text-muted-foreground">{r.collection.subject}</p>}</Td>
                  <Td>{r.user}</Td>
                  <Td>{r.counts.total} <span className="text-xs text-muted-foreground">({r.counts.verified + r.counts.userSet} tekshirilgan{r.counts.unverified ? `, ${r.counts.unverified} yo'q` : ""})</span></Td>
                  <Td className="whitespace-nowrap">{dateText(r.submittedAt)}</Td>
                  <Td><Badge variant={STATUS[r.status]?.tone ?? "neutral"}>{STATUS[r.status]?.label ?? r.status}</Badge>{!r.rightsConfirmed && <Badge variant="danger" className="ml-1">Huquq yo'q</Badge>}</Td>
                  <Td><Button size="sm" variant={r.status === "SUBMITTED" ? "primary" : "outline"} onClick={() => setOpen(r.id)}>{r.status === "SUBMITTED" ? "Ko'rib chiqish" : "Ochish"}</Button></Td>
                </tr>
              ))}
            </tbody>
          </Table></Card>
        )}
      </QueryView>
      <ReviewDialog id={open} onClose={() => setOpen(null)} onDone={q.reload} />
    </div>
  );
}
