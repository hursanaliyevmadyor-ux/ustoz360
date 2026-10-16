"use client";
import * as React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Flag } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import { QuestionCard } from "@/components/practice/question";
import { SupportPanel } from "@/components/practice/support-panel";
import { AIExplanationPanel, type CoachMode } from "@/components/practice/feedback";
import { ReinforcementCard, type RfState } from "@/components/practice/reinforcement";
import { AITutorDrawer, type Msg } from "@/components/practice/tutor-drawer";
import { PracticeResults } from "@/components/practice/results";
import { RationaleCard } from "@/components/tests/rationale-card";
import { PanelAccordion, QuestionFlag, QuestionNavigator, TestHeader, TestSubmitDialog } from "@/components/tests/test-parts";
import { call, sessionHref, type AnswerRes, type CoachEntry, type ReinforceAnswerRes, type ReinforceRes, type Result, type View } from "@/lib/practice-client";

type CoachState = { entries: CoachEntry[]; loading: string | null; error?: string };
const EMPTY_COACH: CoachState = { entries: [], loading: null };

/** Barcha rejimlar uchun yagona savol ekrani: darhol tekshiriladigan (mashq) va yakunda tekshiriladigan (vaqtli, aralash) testlar. */
export function TestRunner() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const toast = useToast();
  const [view, setView] = React.useState<View | null>(null);
  const [loadErr, setLoadErr] = React.useState<{ text: string; anon: boolean } | null>(null);
  const [idx, setIdx] = React.useState(0);
  const [sel, setSel] = React.useState<string | null>(null);
  const [checking, setChecking] = React.useState(false);
  const [actErr, setActErr] = React.useState("");
  const [hint, setHint] = React.useState({ busy: false, error: "" });
  const [coach, setCoach] = React.useState<Record<string, CoachState>>({});
  const [rf, setRf] = React.useState<Record<string, RfState>>({});
  const [tutor, setTutor] = React.useState<{ open: boolean; msgs: Record<string, Msg[]>; busy: boolean; error?: string; notice?: string }>({ open: false, msgs: {}, busy: false });
  const [result, setResult] = React.useState<Result | null>(null);
  const [finishing, setFinishing] = React.useState(false);
  const [again, setAgain] = React.useState<"again" | "next" | null>(null);
  const [submitOpen, setSubmitOpen] = React.useState(false);
  const [expired, setExpired] = React.useState(false);
  const panelRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    let alive = true;
    (async () => {
      const r = await call<View>(`/api/practice/${id}`);
      if (!alive) return;
      if (!r.ok) { setLoadErr({ text: r.error, anon: r.status === 401 }); return; }
      setView(r.data);
      const deferred = r.data.policy === "deferred";
      if (r.data.status === "IN_PROGRESS") {
        // Yakunda tekshiriladigan testda oxirgi ko'rilgan joydan emas, birinchi javobsiz savoldan davom etamiz.
        const open = r.data.items.findIndex((i) => (deferred ? !i.selectedOptionId : !i.answer));
        setIdx(open >= 0 ? open : 0);
        return;
      }
      if (r.data.answered === 0 && !deferred) return;
      const res = await call<Result>(`/api/practice/${id}/finish`);
      if (!alive) return;
      if (res.ok) setResult(res.data); else setLoadErr({ text: res.error, anon: false });
    })();
    return () => { alive = false; };
  }, [id]);

  const item = view?.items[idx];
  const deferred = view?.policy === "deferred";
  const answered = !!item?.answer;

  // Javobdan keyin tushuntirish paneli ekranga olib chiqiladi va klaviatura fokusi unga o'tadi.
  React.useEffect(() => {
    if (answered) { panelRef.current?.focus({ preventScroll: true }); if (window.innerWidth < 1024) panelRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }); }
  }, [answered, idx]);
  React.useEffect(() => { window.scrollTo({ top: 0 }); }, [idx]);

  const patchItem = (i: number, fn: (it: View["items"][number]) => View["items"][number]) =>
    setView((v) => (v ? { ...v, items: v.items.map((it, k) => (k === i ? fn(it) : it)) } : v));

  // ---------- darhol tekshiriladigan rejimlar ----------
  const check = async () => {
    if (!item || !sel || checking) return;
    setChecking(true); setActErr("");
    const r = await call<AnswerRes>(`/api/practice/${id}/answer`, "POST", { questionId: item.id, optionId: sel });
    setChecking(false);
    if (!r.ok) { setActErr(r.error); return; }
    const { chosenOptionId, isCorrect, hintUsed, correctOptionId, explanation, superKey, skill, rationale } = r.data;
    patchItem(idx, (it) => ({ ...it, answer: { chosenOptionId, isCorrect, hintUsed, correctOptionId, explanation, superKey, skill, rationale } }));
  };

  const finish = React.useCallback(async () => {
    setFinishing(true); setSubmitOpen(false);
    const r = await call<Result>(`/api/practice/${id}/finish`, "POST");
    setFinishing(false);
    if (r.ok) { setResult(r.data); window.scrollTo({ top: 0 }); } else if (r.status === 400) setExpired(true); else toast("error", r.error);
  }, [id, toast]);

  const next = () => { if (!view) return; if (idx < view.total - 1) { setIdx(idx + 1); setSel(null); setActErr(""); } else void finish(); };

  const giveHint = async () => {
    if (!item) return;
    setHint({ busy: true, error: "" });
    const r = await call<{ hintOptionId: string }>(`/api/practice/${id}/hint`, "POST", { questionId: item.id });
    if (r.ok) { patchItem(idx, (it) => ({ ...it, hintOptionId: r.data.hintOptionId })); if (sel === r.data.hintOptionId) setSel(null); setHint({ busy: false, error: "" }); }
    else setHint({ busy: false, error: r.error });
  };

  // ---------- yakunda tekshiriladigan rejimlar ----------
  const select = async (oid: string) => {
    if (!item) return;
    const prev = item.selectedOptionId, nextSel = prev === oid ? null : oid;
    patchItem(idx, (it) => ({ ...it, selectedOptionId: nextSel }));
    const r = await call(`/api/practice/${id}/save`, "POST", { questionId: item.id, optionId: nextSel });
    if (!r.ok) { patchItem(idx, (it) => ({ ...it, selectedOptionId: prev })); setActErr(r.status === 409 ? "Vaqt tugagan yoki test yakunlangan." : `Javob saqlanmadi: ${r.error}`); } else setActErr("");
  };
  const toggleFlag = async () => {
    if (!item) return;
    const prev = item.flagged;
    patchItem(idx, (it) => ({ ...it, flagged: !prev }));
    const r = await call(`/api/practice/${id}/flag`, "POST", { questionId: item.id, flagged: !prev });
    if (!r.ok) { patchItem(idx, (it) => ({ ...it, flagged: prev })); setActErr(r.error); }
  };

  // ---------- AI murabbiy ----------
  const ask = async (mode: CoachMode, reason?: string) => {
    if (!item) return;
    const qid = item.id;
    setCoach((c) => ({ ...c, [qid]: { ...(c[qid] ?? EMPTY_COACH), loading: mode, error: undefined } }));
    const r = await call<CoachEntry>(`/api/practice/${id}/explain`, "POST", { questionId: qid, mode, ...(reason && { reason }) });
    setCoach((c) => {
      const cur = c[qid] ?? EMPTY_COACH;
      return { ...c, [qid]: r.ok ? { entries: [...cur.entries, { ...r.data, mode }], loading: null } : { ...cur, loading: null, error: r.error } };
    });
  };

  const submitRationale = async (text: string): Promise<{ ok: true; entry: CoachEntry } | { ok: false; error: string }> => {
    if (!item) return { ok: false, error: "Savol topilmadi." };
    const r = await call<CoachEntry>(`/api/practice/${id}/explain`, "POST", { questionId: item.id, mode: "rationale", message: text });
    return r.ok ? { ok: true, entry: r.data } : { ok: false, error: r.error };
  };

  const startRf = async () => {
    if (!item) return;
    const qid = item.id;
    if (rf[qid]) return;
    setRf((s) => ({ ...s, [qid]: { status: "loading", sel: null, checking: false } }));
    const r = await call<ReinforceRes>(`/api/practice/${id}/reinforce`, "POST", { questionId: qid });
    if (!r.ok) { setRf((s) => ({ ...s, [qid]: { status: "none", message: r.error, sel: null, checking: false } })); return; }
    if (!r.data.available) { setRf((s) => ({ ...s, [qid]: { status: "none", message: r.data.available === false ? r.data.message : undefined, sel: null, checking: false } })); return; }
    const data = r.data;
    let result: ReinforceAnswerRes | undefined;
    if (data.answered) { const a = await call<ReinforceAnswerRes>(`/api/practice/${id}/reinforce/answer`, "POST", { questionId: qid, optionId: data.options[0].id }); if (a.ok) result = a.data; }
    setRf((s) => ({ ...s, [qid]: { status: "ready", data, sel: result?.chosenOptionId ?? null, checking: false, result } }));
  };
  const checkRf = async () => {
    if (!item) return;
    const qid = item.id, st = rf[qid];
    if (!st?.sel) return;
    setRf((s) => ({ ...s, [qid]: { ...st, checking: true, error: undefined } }));
    const r = await call<ReinforceAnswerRes>(`/api/practice/${id}/reinforce/answer`, "POST", { questionId: qid, optionId: st.sel });
    setRf((s) => ({ ...s, [qid]: r.ok ? { ...st, checking: false, result: r.data } : { ...st, checking: false, error: r.error } }));
  };

  const sendTutor = async (text: string) => {
    if (!item) return;
    const qid = item.id, hist = tutor.msgs[qid] ?? [];
    setTutor((t) => ({ ...t, msgs: { ...t.msgs, [qid]: [...hist, { role: "user", content: text }] }, busy: true, error: undefined, notice: undefined }));
    const r = await call<CoachEntry>(`/api/practice/${id}/explain`, "POST", { questionId: qid, mode: "tutor", message: text, history: hist.slice(-6) });
    setTutor((t) => r.ok
      ? { ...t, busy: false, notice: r.data.notice, msgs: { ...t.msgs, [qid]: [...(t.msgs[qid] ?? []), { role: "assistant", content: r.data.text ?? "" }] } }
      : { ...t, busy: false, error: r.error });
  };

  const startAgain = async (body: Record<string, unknown>, which: "again" | "next") => {
    setAgain(which);
    const r = await call<{ id: string }>("/api/practice/start", "POST", body);
    if (r.ok) { router.push(sessionHref(String(body.kind), r.data.id)); return; }
    setAgain(null); toast("error", r.error);
  };

  if (loadErr) return (
    <div className="mx-auto max-w-xl">
      {loadErr.anon ? <EmptyState title="Tizimga kiring" text="Testni ko'rish uchun avval tizimga kirishingiz kerak." action={<Button asChild><Link href="/kirish">Kirish</Link></Button>} />
        : <ErrorState text={loadErr.text} onRetry={() => location.reload()} />}
    </div>
  );
  if (!view) return <div className="mx-auto max-w-6xl space-y-4"><Skeleton className="h-16" /><div className="grid gap-5 lg:grid-cols-[1fr_300px]"><Skeleton className="h-[420px]" /><Skeleton className="h-[420px]" /></div></div>;

  if (result) {
    const a = result.again;
    return (
      <PracticeResults r={result} againBusy={again === "again"} nextBusy={again === "next"}
        onAgain={() => void startAgain({
          kind: a.kind, ...(a.kind !== "errors" && a.topicIds.length > 0 && { topicIds: a.topicIds }), difficulty: a.difficulty, count: a.count,
          ...(a.durationMin && { durationMin: a.durationMin }), ...(a.variant && { variant: a.variant }), ...(a.distribution && { distribution: a.distribution }),
        }, "again")}
        onNext={() => {
          if (result.next.action === "map") router.push("/ustoz-ai/bilim-xaritasi");
          else if (result.next.action === "errors") void startAgain({ kind: "errors", count: 10 }, "next");
          else if (result.next.action === "skills") void startAgain({ kind: "topic", skills: result.next.skills, count: 10 }, "next");
          else void startAgain({ kind: "topic", topicIds: result.next.topicId ? [result.next.topicId] : [], count: 10 }, "next");
        }} />
    );
  }
  if (expired) return <EmptyState title="Vaqt tugadi" text="Bu mashqda javob berilmagan, shuning uchun natija yo'q. Yangisini boshlang." action={<Button asChild><Link href="/ustoz-ai/testlar">Testlar</Link></Button>} />;
  if (!item) return <EmptyState title="Bu mashq yopilgan" text="Bu mashq yangi mashq boshlanganda yopilgan. Yangisini boshlang." action={<Button asChild><Link href="/ustoz-ai/testlar">Testlar</Link></Button>} />;

  const total = view.total;
  const answeredCount = deferred ? view.items.filter((i) => i.selectedOptionId).length : view.items.filter((i) => i.answer).length;
  const correct = view.items.filter((i) => i.answer?.isCorrect).length;
  const flaggedCount = view.items.filter((i) => i.flagged).length;
  const c = coach[item.id] ?? EMPTY_COACH;
  const last = idx >= total - 1;
  const timer = view.timer ? { remainingSec: view.timer.remainingSec } : null;
  const header = <TestHeader mode={view.kindLabel} topic={item.topic} index={idx} total={total} answered={answeredCount} timer={timer} onExpire={() => void finish()} />;

  // ---------- yakunda tekshiriladigan test ----------
  if (deferred) {
    return (
      <div className="mx-auto max-w-6xl">
        {header}
        <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
          <div className="min-w-0">
            <QuestionCard item={item} selectedId={item.selectedOptionId} onSelect={(oid) => void select(oid)} />
            {actErr && <p role="alert" className="mt-3 rounded-xl bg-danger/10 p-3 text-sm text-danger">{actErr}</p>}
            <div className="mt-4 flex flex-wrap items-center gap-2.5">
              <Button variant="outline" size="lg" onClick={() => setIdx(idx - 1)} disabled={idx === 0}><ArrowLeft className="h-4 w-4" aria-hidden />Oldingi</Button>
              <QuestionFlag flagged={item.flagged} onToggle={() => void toggleFlag()} />
              {!last
                ? <Button size="lg" className="ml-auto" onClick={() => setIdx(idx + 1)}>Keyingi<ArrowRight className="h-4 w-4" aria-hidden /></Button>
                : <Button size="lg" className="ml-auto" onClick={() => setSubmitOpen(true)}>Yakunlash</Button>}
            </div>
          </div>
          <PanelAccordion title={`Savollar navigatori (${answeredCount} / ${total})`}>
            <aside className="space-y-3" aria-label="Test paneli">
              <div className="rounded-2xl border border-border bg-card p-4 shadow-soft">
                <p className="mb-3 text-sm font-extrabold">Savollar</p>
                <QuestionNavigator items={view.items.map((i) => ({ id: i.id, answered: !!i.selectedOptionId, flagged: i.flagged }))} current={idx} onGo={(i) => { setIdx(i); setActErr(""); }} />
              </div>
              <Button variant="outline" className="w-full" onClick={() => setSubmitOpen(true)} loading={finishing}><Flag className="h-4 w-4" aria-hidden />Testni yakunlash</Button>
              <p className="text-xs text-muted-foreground">To'g'ri javoblar va izohlar test yakunlangandan keyin ochiladi. Yakunlashgacha javoblarni o'zgartirishingiz mumkin.</p>
            </aside>
          </PanelAccordion>
        </div>
        <TestSubmitDialog open={submitOpen} onOpenChange={setSubmitOpen} total={total} answered={answeredCount} flagged={flaggedCount} busy={finishing} onConfirm={() => void finish()} />
      </div>
    );
  }

  // ---------- darhol tekshiriladigan mashq ----------
  const support = (
    <SupportPanel correct={correct} wrong={answeredCount - correct} left={total - answeredCount} canHint={item.options.length >= 3} hintUsed={!!item.hintOptionId} hintLoading={hint.busy} hintError={hint.error}
      onHint={() => void giveHint()} onSave={() => router.push("/ustoz-ai/testlar")} />
  );
  return (
    <div className="mx-auto max-w-6xl">
      {header}
      <div className={cn("grid items-start gap-5", answered ? "lg:grid-cols-[minmax(0,1fr)_minmax(0,0.95fr)]" : "lg:grid-cols-[minmax(0,1fr)_300px]")}>
        <div className="min-w-0">
          <QuestionCard item={item} selectedId={sel} onSelect={setSel} />
          {actErr && <p role="alert" className="mt-3 rounded-xl bg-danger/10 p-3 text-sm text-danger">{actErr}</p>}
          {!answered ? (
            <Button size="lg" className="mt-4 h-14 w-full text-base" disabled={!sel} loading={checking} onClick={() => void check()}>Javobni tekshirish<ArrowRight className="h-5 w-5" aria-hidden /></Button>
          ) : (
            <Button size="lg" className="mt-4 h-14 w-full text-base" loading={finishing} onClick={next}>{last ? "Natijani ko'rish" : "Keyingi savol"}<ArrowRight className="h-5 w-5" aria-hidden /></Button>
          )}
          {answeredCount > 0 && !(last && answered) && (
            <button type="button" onClick={() => void finish()} className="mt-3 flex items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground"><Flag className="h-4 w-4" aria-hidden />Mashqni hozir yakunlash</button>
          )}
        </div>
        {answered ? (
          <div ref={panelRef} tabIndex={-1} className="min-w-0 outline-none">
            <AIExplanationPanel item={item} aiAvailable={view.aiAvailable} entries={c.entries} loadingMode={c.loading} error={c.error}
              onAsk={(m, reason) => void ask(m, reason)} onTutor={() => setTutor((t) => ({ ...t, open: true }))} onReinforce={() => void startRf()} reinforceBusy={rf[item.id]?.status === "loading"}
              beforeActions={item.situational ? <RationaleCard key={item.id} initial={item.answer?.rationale ?? null} aiAvailable={view.aiAvailable} onSubmit={submitRationale} /> : undefined}>
              {rf[item.id] && <ReinforcementCard state={rf[item.id]} onSelect={(oid) => setRf((s) => ({ ...s, [item.id]: { ...s[item.id], sel: oid } }))} onCheck={() => void checkRf()} />}
            </AIExplanationPanel>
          </div>
        ) : <PanelAccordion title="Ishora va joriy natija">{support}</PanelAccordion>}
      </div>
      <AITutorDrawer open={tutor.open} onOpenChange={(o) => setTutor((t) => ({ ...t, open: o }))} messages={tutor.msgs[item.id] ?? []} busy={tutor.busy} error={tutor.error} notice={tutor.notice} onSend={(t) => void sendTutor(t)} />
    </div>
  );
}
