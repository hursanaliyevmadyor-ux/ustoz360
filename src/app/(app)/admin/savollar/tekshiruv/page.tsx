"use client";
import * as React from "react";
import Link from "next/link";
import { ArrowLeft, Ban, CheckCircle2, ChevronLeft, ChevronsRight, Flag, Pencil } from "lucide-react";
import { adminModule } from "@/lib/modules";
import { api } from "@/lib/admin-client";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/layout/page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select, Textarea } from "@/components/ui/form";
import { EmptyState } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";

type Queue = { total: number; verified: number; remaining: number; percent: number; ids: string[] };
type Q = { id: string; text: string; explanation: string; status: string; verified: boolean; source: string; sourceRef: string; topic: string; subject: string; reports: number; options: { letter: string; text: string; correct: boolean }[]; correct: number };
type Action = { type: "approve" } | { type: "reject" } | { type: "fix"; correct: number; explanation: string };

const STATUS: Record<string, string> = { DRAFT: "Qoralama", REVIEW: "Tekshiruvda", APPROVED: "Tasdiqlangan" };
const TONE = { DRAFT: "neutral", REVIEW: "amber", APPROVED: "success" } as const;

/** Savollarni bitalab tekshirish: bir vaqtda bitta savol, aniq uchta qaror (to'g'ri / javobi boshqa / yaroqsiz). */
export default function Page() {
  const toast = useToast();
  const [scope, setScope] = React.useState("");
  const [stats, setStats] = React.useState<{ total: number; verified: number } | null>(null);
  const [queue, setQueue] = React.useState<string[] | null>(null);
  const [history, setHistory] = React.useState<string[]>([]);
  const [q, setQ] = React.useState<Q | null>(null);
  const [err, setErr] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [fix, setFix] = React.useState<{ correct: number; explanation: string } | null>(null);
  const [handled, setHandled] = React.useState(0);

  const loadQueue = React.useCallback(async () => {
    setErr(""); setQueue(null); setQ(null); setHistory([]); setFix(null);
    const r = await api<Queue>(`/api/admin/qbank/review${scope ? `?status=${scope}` : ""}`);
    if (!r.ok) { setErr(r.error); setQueue([]); return; }
    setStats({ total: r.data.total, verified: r.data.verified }); setQueue(r.data.ids);
  }, [scope]);
  React.useEffect(() => { void loadQueue(); }, [loadQueue]);

  const currentId = queue?.[0];
  React.useEffect(() => {
    setFix(null);
    if (!currentId) { setQ(null); return; }
    let live = true;
    setQ(null);
    void api<Q>(`/api/admin/qbank/${currentId}/review`).then((r) => {
      if (!live) return;
      if (r.ok) { setQ(r.data); setErr(""); } else setErr(r.error);
    });
    return () => { live = false; };
  }, [currentId]);

  const remaining = queue?.length ?? 0;
  const percent = stats && stats.total ? Math.round((stats.verified / stats.total) * 100) : 0;

  async function decide(a: Action) {
    if (!q || busy) return;
    if (a.type === "reject" && !window.confirm("Bu savol yaroqsiz deb rad etiladi va imtihondan olinadi. Davom etasizmi?")) return;
    setBusy(true); setErr("");
    const r = await api(`/api/admin/qbank/${q.id}/review`, "POST", a);
    setBusy(false);
    if (!r.ok) { setErr(r.error); return; }
    toast("success", a.type === "approve" ? "Tasdiqlandi." : a.type === "fix" ? "Javob tuzatilib, tasdiqlandi." : "Rad etildi.");
    setStats((s) => {
      if (!s) return s;
      if (a.type === "reject") return { total: s.total - 1, verified: s.verified - (q.verified ? 1 : 0) };
      return { total: s.total, verified: s.verified + (q.verified ? 0 : 1) };
    });
    setHandled((n) => n + 1);
    setQueue((l) => (l ?? []).slice(1));
  }
  const skip = () => { if (!queue || queue.length < 2) return; setHistory((h) => [...h, queue[0]]); setQueue([...queue.slice(1), queue[0]]); };
  const back = () => { if (!queue || history.length === 0) return; const prev = history[history.length - 1]; setHistory((h) => h.slice(0, -1)); setQueue([prev, ...queue.filter((id) => id !== prev)]); };

  return (
    <>
      <PageHeader module={adminModule} title="Savollarni bitalab tekshirish" description="Har bir savolni o'qing: javob to'g'ri bo'lsa tasdiqlang, noto'g'ri bo'lsa tuzating yoki rad eting"
        actions={<Button variant="outline" asChild><Link href="/admin/savollar"><ArrowLeft className="h-4 w-4" aria-hidden />Savollar bankiga qaytish</Link></Button>} />

      <Card className="mb-4 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm"><b className="text-lg">{stats?.verified ?? 0}</b> / {stats?.total ?? 0} savol tekshirilgan · <b>{remaining}</b> ta qoldi{handled > 0 && <span className="text-muted-foreground"> · shu oynada hal qilingan: {handled}</span>}</p>
          <Select className="h-10 w-56" value={scope} onChange={(e) => setScope(e.target.value)} aria-label="Qaysi savollar">
            <option value="">Hamma savollar</option><option value="REVIEW">Faqat «Tekshiruvda»</option><option value="APPROVED">Faqat «Tasdiqlangan»</option>
          </Select>
        </div>
        <div className="mt-3 h-3 overflow-hidden rounded-full bg-muted" role="progressbar" aria-label="Tekshiruv jarayoni" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}>
          <div className="h-full rounded-full bg-success transition-[width]" style={{ width: `${percent}%` }} />
        </div>
        <p className="mt-2 text-xs text-muted-foreground">«Namunaviy» (demo) savollar bu ro'yxatga kirmaydi. Kim va qachon tekshirgani avtomatik jurnalga yoziladi.</p>
      </Card>

      {err && <p role="alert" className="mb-4 rounded-xl bg-danger/10 p-3 text-sm text-danger">{err}</p>}

      {queue === null ? <p className="text-sm text-muted-foreground">Yuklanmoqda...</p>
        : queue.length === 0 ? <EmptyState icon={CheckCircle2} title="Hammasi tekshirildi" text="Bu bo'limda tekshirilmagan savol qolmadi. Boshqa guruhni tanlashingiz yoki bankka qaytishingiz mumkin." action={<Button asChild><Link href="/admin/savollar">Savollar bankiga qaytish</Link></Button>} />
        : !q ? <p className="text-sm text-muted-foreground">Savol yuklanmoqda...</p>
        : (
          <Card className="p-5" aria-live="polite">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="blue">Qolgan: {remaining}</Badge>
              <Badge variant={TONE[q.status as keyof typeof TONE] ?? "neutral"}>{STATUS[q.status] ?? q.status}</Badge>
              {q.verified && <Badge variant="success">Avval tekshirilgan</Badge>}
              {q.reports > 0 && <Badge variant="danger"><Flag className="h-3 w-3" aria-hidden />{q.reports} ta xato xabari</Badge>}
              <span className="text-xs text-muted-foreground">{q.subject} · {q.topic}</span>
            </div>
            {q.sourceRef && <p className="mt-2 rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground"><b>Manba izohi:</b> {q.sourceRef}</p>}

            <h2 className="mt-4 text-sm font-bold uppercase tracking-wide text-muted-foreground">Savol</h2>
            <p className="mt-1 max-h-[26rem] overflow-y-auto whitespace-pre-wrap rounded-xl bg-muted/50 p-4 text-[15px] leading-relaxed">{q.text}</p>

            <h2 className="mt-4 text-sm font-bold uppercase tracking-wide text-muted-foreground">Variantlar <span className="font-normal normal-case">(yashil: hozirgi to'g'ri javob)</span></h2>
            <ul className="mt-1 space-y-2">
              {q.options.map((o, i) => (
                <li key={o.letter}>
                  {fix ? (
                    <label className={cn("flex cursor-pointer items-start gap-3 rounded-xl border p-3", fix.correct === i ? "border-success bg-success/10" : "border-border")}>
                      <input type="radio" name="yangi-javob" className="mt-1 h-5 w-5 accent-[hsl(var(--success))]" checked={fix.correct === i} onChange={() => setFix({ ...fix, correct: i })} />
                      <span><b>{o.letter})</b> {o.text}</span>
                    </label>
                  ) : (
                    <div className={cn("flex items-start gap-3 rounded-xl border p-3", o.correct ? "border-success bg-success/10" : "border-border")}>
                      <span className={cn("grid h-7 w-7 shrink-0 place-items-center rounded-full text-sm font-extrabold", o.correct ? "bg-success text-white" : "bg-muted")}>{o.letter}</span>
                      <span className="min-w-0 flex-1">{o.text}</span>
                      {o.correct && <span className="shrink-0 text-xs font-bold text-success">Hozirgi javob</span>}
                    </div>
                  )}
                </li>
              ))}
            </ul>

            {fix ? (
              <div className="mt-4 space-y-3">
                <label className="block text-sm font-semibold" htmlFor="yangi-izoh">Izohni yangi javobga moslab yozing</label>
                <Textarea id="yangi-izoh" value={fix.explanation} onChange={(e) => setFix({ ...fix, explanation: e.target.value })} maxLength={1500} className="min-h-40" />
                <p className="text-xs text-muted-foreground">Eski izoh eski javobga yozilgan. «To'g'ri javob: harf» qatori o'zi yangilanadi, qolganini o'zingiz moslang.</p>
                <div className="flex flex-wrap gap-2">
                  <Button size="lg" loading={busy} disabled={fix.correct === q.correct && fix.explanation === q.explanation} onClick={() => void decide({ type: "fix", correct: fix.correct, explanation: fix.explanation })}><CheckCircle2 className="h-5 w-5" aria-hidden />Saqlash va tasdiqlash</Button>
                  <Button size="lg" variant="ghost" onClick={() => setFix(null)}>Bekor qilish</Button>
                </div>
              </div>
            ) : (
              <>
                <h2 className="mt-4 text-sm font-bold uppercase tracking-wide text-muted-foreground">Izoh <span className="font-normal normal-case">(mashqda javobdan keyin ko'rsatiladi)</span></h2>
                <p className="mt-1 max-h-72 overflow-y-auto whitespace-pre-wrap rounded-xl bg-muted/50 p-4 text-sm leading-relaxed">{q.explanation}</p>

                <div className="mt-5 grid gap-2 sm:grid-cols-3">
                  <Button size="lg" variant="success" loading={busy} onClick={() => void decide({ type: "approve" })}><CheckCircle2 className="h-5 w-5" aria-hidden />Javob to'g'ri: tasdiqlash</Button>
                  <Button size="lg" variant="outline" disabled={busy} onClick={() => setFix({ correct: q.correct, explanation: q.explanation })}><Pencil className="h-5 w-5" aria-hidden />Javobi boshqa: tuzatish</Button>
                  <Button size="lg" variant="danger" disabled={busy} onClick={() => void decide({ type: "reject" })}><Ban className="h-5 w-5" aria-hidden />Yaroqsiz: rad etish</Button>
                </div>
                <div className="mt-3 flex flex-wrap justify-between gap-2">
                  <Button variant="ghost" onClick={back} disabled={history.length === 0 || busy}><ChevronLeft className="h-4 w-4" aria-hidden />Oldingisi</Button>
                  <Button variant="ghost" onClick={skip} disabled={remaining < 2 || busy}>Keyinroq ko'raman<ChevronsRight className="h-4 w-4" aria-hidden /></Button>
                </div>
              </>
            )}
          </Card>
        )}
    </>
  );
}
