"use client";
import * as React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { AlertTriangle, ArrowLeft, ArrowRight, Check, CheckCircle2, Clock, ListChecks, LogOut, Maximize, XCircle } from "lucide-react";
import { BookLoader } from "@/components/book-loader";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type QView = { id: string; n: number; type: "CHOICE" | "WRITTEN"; text: string; options?: string[] };
type Ans = { c?: number; t?: string };
type Review = { n: number; id: string; type: "CHOICE" | "WRITTEN"; text: string; options?: string[]; chosen?: number | null; correct?: number; given?: string; accepted?: string[]; ok: boolean; explanation?: string | null };
type View = {
  id: string; serverNow: string; endsAt: string; submitted: boolean; leftCount: number;
  exam: { title: string; subject: string; kind: string; durationMin: number };
  answers?: Record<string, Ans>; questions?: QView[];
  result?: { score: number; total: number; submittedAt: string; startedAt: string; review: Review[]; ranking?: { counted: boolean; reason: string } };
};
type Kb = { lock?: (keys: string[]) => Promise<void>; unlock?: () => void };

const LETTERS = "ABCDEFGH";
const KIND: Record<string, string> = { TEST: "Test (variantli)", WRITTEN: "Yozma javobli", MIXED: "Aralash test" };
const fmt = (ms: number) => {
  const s = Math.max(0, Math.ceil(ms / 1000)); const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = s % 60;
  const p = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${p(m)}:${p(r)}` : `${p(m)}:${p(r)}`;
};
const kb = () => (typeof navigator === "undefined" ? undefined : (navigator as unknown as { keyboard?: Kb }).keyboard);
const hasAnswer = (q: QView, a?: Ans) => (q.type === "CHOICE" ? typeof a?.c === "number" : !!a?.t?.trim());

export default function Page() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [view, setView] = React.useState<View | null>(null);
  const [err, setErr] = React.useState("");
  const [answers, setAnswers] = React.useState<Record<string, Ans>>({});
  const [idx, setIdx] = React.useState(0);
  const [left, setLeft] = React.useState<number | null>(null);
  const [fs, setFs] = React.useState(false);
  const [started, setStarted] = React.useState(false);
  /** Brauzer to'liq ekranga ruxsat bermasa (masalan, ba'zi o'rnatilgan oynalar), imtihon baribir davom etadi. */
  const [fsFailed, setFsFailed] = React.useState(false);
  const [modal, setModal] = React.useState<null | "exit" | "finish">(null);
  const [palette, setPalette] = React.useState(false);
  const [warn, setWarn] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [me, setMe] = React.useState<{ name: string | null; email: string | null } | null>(null);

  const skew = React.useRef(0);
  const active = React.useRef(false);
  const wasFs = React.useRef(false);
  const modalRef = React.useRef<typeof modal>(null);
  const answersRef = React.useRef(answers);
  const finishing = React.useRef(false);
  const leaves = React.useRef(0);
  const timers = React.useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  modalRef.current = modal; answersRef.current = answers;

  const fsSupported = typeof document !== "undefined" && !!document.documentElement.requestFullscreen;
  const questions = view?.questions ?? [];
  const q = questions[idx];

  // ---- yuklash ----
  const loadedFor = React.useRef<string | null>(null);
  React.useEffect(() => {
    // Faqat bir marta yuklaymiz: qayta yuklash hali serverga yetib bormagan javoblarni eski ma'lumot bilan bosib ketmasligi uchun.
    if (loadedFor.current === id) return;
    loadedFor.current = id;
    fetch("/api/me").then((r) => r.json()).then((d) => setMe(d.user)).catch(() => {});
    fetch(`/api/exam/attempts/${id}`).then(async (r) => {
      const d = await r.json().catch(() => ({}));
      if (r.status === 401) { router.replace("/kirish"); return; }
      if (!r.ok) { setErr(d.error ?? "Imtihonni yuklab bo'lmadi."); return; }
      skew.current = new Date(d.serverNow).getTime() - Date.now();
      setView(d); setAnswers(d.answers ?? {});
      active.current = !d.submitted;
      if (document.fullscreenElement) { wasFs.current = true; setFs(true); setStarted(true); }
    }).catch(() => setErr("Server bilan aloqa yo'q."));
  }, [id, router]);

  // ---- to'liq ekran ----
  const enterFs = React.useCallback(async () => {
    // Brauzer javob bermay qolsa ham tugma osilib qolmasligi uchun vaqt chegarasi.
    const soft = (p: Promise<unknown> | undefined, ms: number) => Promise.race([(p ?? Promise.resolve()).catch(() => {}), new Promise((res) => setTimeout(res, ms))]);
    try { if (!document.fullscreenElement) await soft(document.documentElement.requestFullscreen({ navigationUI: "hide" }), 1500); } catch { /* ruxsat berilmasa ham davom etamiz */ }
    try { await soft(kb()?.lock?.(["Escape"]), 800); } catch { /* ba'zi brauzerlarda yo'q */ }
  }, []);
  const exitFs = React.useCallback(() => { try { kb()?.unlock?.(); if (document.fullscreenElement) void document.exitFullscreen(); } catch { /* e'tibor bermaymiz */ } }, []);

  const lastLeave = React.useRef(0);
  const noteLeave = React.useCallback(() => {
    // Bir necha soniya ichida takrorlangan hodisalar bitta deb hisoblanadi (server so'rovlari ko'payib ketmasligi uchun).
    if (Date.now() - lastLeave.current < 4000) return;
    lastLeave.current = Date.now();
    leaves.current += 1;
    void fetch(`/api/exam/attempts/${id}/leave`, { method: "POST" }).catch(() => {});
  }, [id]);

  const finish = React.useCallback(async () => {
    if (finishing.current) return;
    finishing.current = true; setBusy(true); setModal(null);
    Object.values(timers.current).forEach(clearTimeout);
    try {
      const r = await fetch(`/api/exam/attempts/${id}/submit`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ answers: answersRef.current }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setErr(d.error ?? "Topshirib bo'lmadi. Qayta urinib ko'ring."); finishing.current = false; return; }
      active.current = false; setView(d); exitFs();
    } catch { setErr("Server bilan aloqa yo'q. Internetni tekshirib, qayta urinib ko'ring."); finishing.current = false; }
    finally { setBusy(false); }
  }, [id, exitFs]);

  React.useEffect(() => {
    const onFs = () => {
      const on = !!document.fullscreenElement;
      setFs(on);
      if (on) { wasFs.current = true; setFsFailed(false); return; }
      // To'liq ekrandan chiqildi (Esc yoki tizim): tasdiq so'raymiz.
      if (wasFs.current && active.current && !finishing.current) { wasFs.current = false; noteLeave(); setModal("exit"); }
    };
    const onKey = (e: KeyboardEvent) => {
      if (!active.current) return;
      if (e.key === "Escape") { e.preventDefault(); if (modalRef.current === "exit") setModal(null); else { noteLeave(); setModal("exit"); } return; }
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA")) return;
      if (modalRef.current) return;
      if (e.key === "ArrowRight") setIdx((i) => Math.min(i + 1, Math.max(0, (view?.questions?.length ?? 1) - 1)));
      else if (e.key === "ArrowLeft") setIdx((i) => Math.max(0, i - 1));
    };
    const onVis = () => {
      if (!active.current) return;
      if (document.hidden) { noteLeave(); } else if (leaves.current > 0) { setWarn(`Siz imtihon oynasidan chiqdingiz (${leaves.current} marta). Bu qayd etiladi.`); setTimeout(() => setWarn(""), 7000); }
    };
    const onBefore = (e: BeforeUnloadEvent) => { if (active.current) { e.preventDefault(); e.returnValue = ""; } };
    // Telefonda "orqaga" tugmasi: sahifadan chiqib ketmaydi, tasdiq so'raydi.
    history.pushState({ exam: true }, "", location.href);
    const onPop = () => { if (!active.current) return; history.pushState({ exam: true }, "", location.href); if (modalRef.current !== "exit") { noteLeave(); setModal("exit"); } };
    document.addEventListener("fullscreenchange", onFs);
    window.addEventListener("keydown", onKey);
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("beforeunload", onBefore);
    window.addEventListener("popstate", onPop);
    return () => {
      document.removeEventListener("fullscreenchange", onFs); window.removeEventListener("keydown", onKey); document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("beforeunload", onBefore); window.removeEventListener("popstate", onPop);
    };
  }, [noteLeave, view?.questions?.length]);

  // ---- taymer (server vaqti bo'yicha) ----
  React.useEffect(() => {
    if (!view || view.submitted) return;
    const end = new Date(view.endsAt).getTime();
    const tick = () => { const ms = end - (Date.now() + skew.current); setLeft(ms); if (ms <= 0) void finish(); };
    tick(); const iv = setInterval(tick, 250);
    return () => clearInterval(iv);
  }, [view, finish]);

  // ---- javob belgilash ----
  const put = (qid: string, body: { c?: number | null; t?: string | null }) =>
    fetch(`/api/exam/attempts/${id}/answer`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ qid, ...body }) }).catch(() => {});
  const choose = (qq: QView, i: number) => {
    const cur = answersRef.current[qq.id]?.c;
    const next = cur === i ? undefined : i; // bosilgan variantni qayta bossa, belgi olinadi
    setAnswers((a) => { const n = { ...a }; if (next === undefined) delete n[qq.id]; else n[qq.id] = { c: next }; return n; });
    void put(qq.id, { c: next ?? null });
  };
  const write = (qq: QView, t: string) => {
    setAnswers((a) => { const n = { ...a }; if (t.trim()) n[qq.id] = { t }; else delete n[qq.id]; return n; });
    clearTimeout(timers.current[qq.id]);
    timers.current[qq.id] = setTimeout(() => { void put(qq.id, { t: t.trim() ? t : null }); }, 600);
  };
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!q || q.type !== "CHOICE" || modalRef.current || !active.current) return;
      const t = e.target as HTMLElement | null; if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA")) return;
      const k = e.key.toLowerCase(); const li = LETTERS.toLowerCase().indexOf(k); const di = /^[1-8]$/.test(k) ? Number(k) - 1 : -1;
      const i = li >= 0 ? li : di;
      if (i >= 0 && i < (q.options?.length ?? 0)) choose(q, i);
    };
    window.addEventListener("keydown", onKey); return () => window.removeEventListener("keydown", onKey);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  // ---- ko'rinish ----
  const answered = questions.filter((x) => hasAnswer(x, answers[x.id])).length;
  const initials = (me?.name ?? me?.email ?? "?").split(/[\s@]/).filter(Boolean).map((w) => w[0]).join("").slice(0, 2).toUpperCase();
  const low = left !== null && left < 5 * 60_000;

  if (err && !view) return (
    <Shell><div className="m-auto max-w-sm space-y-4 p-6 text-center"><AlertTriangle className="mx-auto h-10 w-10 text-danger" /><p className="font-bold">{err}</p><Button onClick={() => router.push("/imtihon")}>Imtihonlar ro'yxati</Button></div></Shell>
  );
  if (!view) return <Shell><div className="m-auto"><BookLoader variant={2} size="lg" label="Imtihon yuklanmoqda..." /></div></Shell>;

  if (view.submitted && view.result) return <Results v={view} onBack={() => router.push("/imtihon")} />;

  const Timer = ({ className }: { className?: string }) => (
    <div className={cn("flex items-center gap-2 font-mono font-extrabold tabular-nums", low ? "text-danger" : "text-foreground", className)} aria-label="Qolgan vaqt" role="timer">
      <Clock className={cn("h-5 w-5", low && "animate-pulse")} />{left === null ? "--:--" : fmt(left)}
    </div>
  );
  const Palette = ({ onPick }: { onPick?: () => void }) => (
    <div className="grid grid-cols-5 gap-2.5" role="group" aria-label="Savollar">
      {questions.map((x, i) => (
        <button key={x.id} type="button" onClick={() => { setIdx(i); onPick?.(); }} aria-label={`${x.n}-savol${hasAnswer(x, answers[x.id]) ? ", javob berilgan" : ""}`} aria-current={i === idx}
          className={cn("grid h-11 w-11 place-items-center rounded-full border-2 text-sm font-bold transition",
            hasAnswer(x, answers[x.id]) ? "border-success bg-success text-white" : "border-border bg-card text-foreground hover:border-primary",
            i === idx && "ring-2 ring-primary ring-offset-2 ring-offset-background")}>{x.n}</button>
      ))}
    </div>
  );

  const needGate = !started || (fsSupported && !fs && !fsFailed && !modal);

  return (
    <Shell>
      {/* Yuqori panel */}
      <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-border bg-card px-3 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-primary text-sm font-extrabold text-white">U</span>
          <p className="truncate text-sm font-bold sm:text-base">{view.exam.title}</p>
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="hidden text-right leading-tight sm:block"><p className="text-sm font-bold">{view.exam.subject}</p><p className="text-xs text-muted-foreground">{KIND[view.exam.kind] ?? view.exam.kind}</p></div>
          <div className="flex items-center gap-2 rounded-full bg-muted py-1 pl-1 pr-3">
            <span className="grid h-7 w-7 place-items-center rounded-full bg-primary/15 text-xs font-bold text-primary">{initials}</span>
            <span className="hidden max-w-[10rem] truncate text-sm font-semibold md:block">{me?.name ?? me?.email ?? "Foydalanuvchi"}</span>
          </div>
          <Button variant="outline" size="sm" onClick={() => { noteLeave(); setModal("exit"); }} aria-label="Chiqish"><LogOut className="h-4 w-4" /><span className="hidden sm:inline">Chiqish</span></Button>
        </div>
      </header>
      {warn && <div role="alert" className="flex items-center gap-2 bg-danger px-4 py-2 text-sm font-semibold text-white"><AlertTriangle className="h-4 w-4 shrink-0" />{warn}</div>}
      {err && <div role="alert" className="bg-danger/10 px-4 py-2 text-sm text-danger">{err}</div>}

      {/* Telefon: taymer va savollar tugmasi */}
      <div className="flex shrink-0 items-center justify-between border-b border-border bg-card px-4 py-2 lg:hidden">
        <Timer className="text-lg" />
        <Button variant="outline" size="sm" onClick={() => setPalette(true)}><ListChecks className="h-4 w-4" />{answered} / {questions.length}</Button>
      </div>

      <div className="flex min-h-0 flex-1">
        <main className="flex min-w-0 flex-1 flex-col">
          <div className="flex-1 overflow-y-auto px-4 py-6 sm:px-10 lg:px-14">
            {q && (
              <div className="mx-auto max-w-3xl">
                <p className="mb-3 text-sm font-semibold text-muted-foreground">{q.n}-savol / {questions.length}</p>
                <h1 className="whitespace-pre-wrap text-xl font-bold leading-relaxed sm:text-2xl">{q.text}</h1>

                {q.type === "CHOICE" ? (
                  <ul className="mt-6 space-y-3" role="radiogroup" aria-label="Javob variantlari">
                    {q.options?.map((o, i) => {
                      const on = answers[q.id]?.c === i;
                      return (
                        <li key={i}>
                          <button type="button" role="radio" aria-checked={on} onClick={() => choose(q, i)}
                            className={cn("flex w-full items-center gap-4 rounded-2xl border-2 p-4 text-left text-base transition sm:text-lg",
                              on ? "border-success bg-success/10" : "border-border bg-card hover:border-primary/60")}>
                            <span className={cn("grid h-10 w-10 shrink-0 place-items-center rounded-full border-2 text-base font-extrabold", on ? "border-success bg-success text-white" : "border-border")}>{on ? <Check className="h-5 w-5" /> : LETTERS[i]}</span>
                            <span className="min-w-0 flex-1 whitespace-pre-wrap">{o}</span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <div className="mt-6">
                    <label htmlFor="written" className="mb-2 block text-sm font-semibold text-muted-foreground">Javobingizni yozing</label>
                    <textarea id="written" key={q.id} rows={3} maxLength={300} defaultValue={answers[q.id]?.t ?? ""} onChange={(e) => write(q, e.target.value)}
                      onPaste={(e) => e.preventDefault()} autoComplete="off" spellCheck={false} placeholder="Masalan: 25"
                      className={cn("w-full resize-none rounded-2xl border-2 bg-card p-4 text-lg focus:outline-none", hasAnswer(q, answers[q.id]) ? "border-success" : "border-border focus:border-primary")} />
                    <p className="mt-2 text-xs text-muted-foreground">Javob yozilgach savol raqami yashil bo'ladi. Aniq va qisqa yozing.</p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Pastki: oldingi / keyingi */}
          <footer className="flex shrink-0 items-center justify-between gap-3 border-t border-border bg-card px-4 py-3 sm:px-10">
            <Button variant="outline" size="lg" disabled={idx === 0} onClick={() => setIdx((i) => Math.max(0, i - 1))}><ArrowLeft className="h-5 w-5" /><span className="hidden sm:inline">Oldingi</span></Button>
            <span className="text-sm font-semibold text-muted-foreground">{idx + 1} / {questions.length}</span>
            {idx < questions.length - 1
              ? <Button size="lg" onClick={() => setIdx((i) => i + 1)}><span className="hidden sm:inline">Keyingi</span><ArrowRight className="h-5 w-5" /></Button>
              : <Button size="lg" variant="success" onClick={() => setModal("finish")}>Yakunlash<CheckCircle2 className="h-5 w-5" /></Button>}
          </footer>
        </main>

        {/* Yon panel: vaqt va savollar raqami */}
        <aside className="hidden w-80 shrink-0 flex-col gap-6 overflow-y-auto border-l border-border bg-card p-6 lg:flex">
          <div className="rounded-2xl bg-muted p-4 text-center">
            <p className="mb-1 text-xs font-semibold text-muted-foreground">Qolgan vaqt</p>
            <Timer className="justify-center text-4xl" />
          </div>
          <div><p className="mb-3 text-sm font-bold">Savollar <span className="font-normal text-muted-foreground">({answered} / {questions.length} javob berilgan)</span></p><Palette /></div>
          <Button variant="success" size="lg" className="mt-auto" onClick={() => setModal("finish")} loading={busy}>Imtihonni yakunlash</Button>
        </aside>
      </div>

      {/* Telefon: savollar ro'yxati */}
      {palette && (
        <div className="fixed inset-0 z-[120] flex items-end bg-black/50 lg:hidden" onClick={() => setPalette(false)}>
          <div className="w-full rounded-t-3xl bg-card p-5 pb-8" onClick={(e) => e.stopPropagation()}>
            <p className="mb-4 text-sm font-bold">Savollar ({answered} / {questions.length})</p>
            <Palette onPick={() => setPalette(false)} />
            <Button variant="success" size="lg" className="mt-5 w-full" onClick={() => { setPalette(false); setModal("finish"); }}>Imtihonni yakunlash</Button>
          </div>
        </div>
      )}

      {/* Boshlash / to'liq ekranga qaytish */}
      {needGate && !modal && (
        <Overlay>
          <Maximize className="mx-auto h-10 w-10 text-primary" />
          <h2 className="text-2xl font-extrabold">{started ? "To'liq ekranga qayting" : "Imtihon to'liq ekranda o'tadi"}</h2>
          <ul className="space-y-2 text-left text-sm text-muted-foreground">
            <li>• Chiqish uchun kompyuterda <b className="text-foreground">Esc</b>, telefonda <b className="text-foreground">«Chiqish»</b> tugmasi. Chiqishdan oldin tasdiq so'raladi.</li>
            <li>• Savollar va variantlar har safar boshqacha tartibda tushadi.</li>
            <li>• Vaqt tugasa, javoblar o'zi topshiriladi.</li>
            <li>• Boshqa oynaga o'tish qayd etiladi.</li>
          </ul>
          <Button size="lg" className="w-full" onClick={async () => { await enterFs(); setStarted(true); setFsFailed(!document.fullscreenElement); }}>{started ? "Davom etish" : "Imtihonni boshlash"}</Button>
        </Overlay>
      )}

      {modal === "exit" && (
        <Overlay>
          <AlertTriangle className="mx-auto h-10 w-10 text-amber" />
          <h2 className="text-2xl font-extrabold">Rostan ham chiqmoqchimisiz?</h2>
          <p className="text-sm text-muted-foreground">Chiqsangiz imtihon shu zahoti yakunlanadi va hozirgi javoblaringiz bo'yicha natija hisoblanadi. Qayta kira olmaysiz.</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Button size="lg" onClick={() => { setModal(null); void enterFs(); }}>Imtihonda qolish</Button>
            <Button size="lg" variant="danger" loading={busy} onClick={() => void finish()}>Chiqish</Button>
          </div>
        </Overlay>
      )}

      {modal === "finish" && (
        <Overlay>
          <CheckCircle2 className="mx-auto h-10 w-10 text-success" />
          <h2 className="text-2xl font-extrabold">Imtihonni yakunlaysizmi?</h2>
          <p className="text-sm text-muted-foreground">Javob berilgan: <b className="text-foreground">{answered}</b> / {questions.length}.{questions.length - answered > 0 && <> Javobsiz qolgan: <b className="text-danger">{questions.length - answered}</b>.</>}</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Button size="lg" variant="outline" onClick={() => setModal(null)}>Qaytish</Button>
            <Button size="lg" variant="success" loading={busy} onClick={() => void finish()}>Yakunlash</Button>
          </div>
        </Overlay>
      )}
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return <div className="fixed inset-0 z-[100] flex select-none flex-col bg-background text-foreground" onContextMenu={(e) => e.preventDefault()}>{children}</div>;
}
function Overlay({ children }: { children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-[130] grid place-items-center bg-background/90 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md space-y-5 rounded-3xl border border-border bg-card p-7 text-center shadow-pop">{children}</div>
    </div>
  );
}

function Results({ v, onBack }: { v: View; onBack: () => void }) {
  const r = v.result!;
  const pct = r.total ? Math.round((r.score / r.total) * 100) : 0;
  const secs = Math.max(0, Math.round((new Date(r.submittedAt).getTime() - new Date(r.startedAt).getTime()) / 1000));
  const unanswered = r.review.filter((x) => (x.type === "CHOICE" ? x.chosen === null || x.chosen === undefined : !x.given)).length;
  const wrong = r.review.filter((x) => !x.ok).length - unanswered;
  const [rank, setRank] = React.useState<{ ranked: boolean; overall: { rank: number; total: number; index: number } | null; inDirection: { rank: number; total: number } | null; directionLabel: string | null; comparing: boolean; nextStep: { text: string; href: string } | null; blockers: string[] } | null>(null);
  React.useEffect(() => { fetch("/api/leaderboard/me").then((x) => (x.ok ? x.json() : null)).then(setRank).catch(() => {}); }, []);
  const toErrors = () => document.getElementById("javoblar")?.scrollIntoView({ behavior: "smooth", block: "start" });
  return (
    <Shell>
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-card px-4 sm:px-6">
        <p className="truncate font-bold">{v.exam.title}</p>
        <Button size="sm" onClick={onBack}>Imtihonlar ro'yxati</Button>
      </header>
      <div className="flex-1 select-text overflow-y-auto px-4 py-8 sm:px-10">
        <div className="mx-auto max-w-3xl space-y-8">
          <div className="rounded-3xl border border-border bg-card p-8 text-center shadow-soft">
            <p className="text-sm font-semibold text-muted-foreground">{v.exam.subject} · {KIND[v.exam.kind] ?? v.exam.kind}</p>
            <p className={cn("mt-3 text-6xl font-extrabold", pct >= 60 ? "text-success" : "text-danger")}>{r.score}<span className="text-3xl text-muted-foreground"> / {r.total}</span></p>
            <p className="mt-1 text-xl font-bold">{pct}%</p>
            <p className="mt-3 text-sm text-muted-foreground">Sarflangan vaqt: {fmt(secs * 1000)}{v.leftCount > 0 && <> · Oynadan chiqishlar: {v.leftCount}</>}</p>
            <dl className="mx-auto mt-5 grid max-w-md grid-cols-3 gap-3 text-sm">
              <div className="rounded-xl bg-success/10 p-3"><dd className="text-2xl font-extrabold text-success">{r.score}</dd><dt className="text-xs text-muted-foreground">To&apos;g&apos;ri</dt></div>
              <div className="rounded-xl bg-danger/10 p-3"><dd className="text-2xl font-extrabold text-danger">{Math.max(0, wrong)}</dd><dt className="text-xs text-muted-foreground">Noto&apos;g&apos;ri</dt></div>
              <div className="rounded-xl bg-muted p-3"><dd className="text-2xl font-extrabold">{unanswered}</dd><dt className="text-xs text-muted-foreground">Javobsiz</dt></div>
            </dl>
          </div>

          {r.ranking && (
            <div className={cn("rounded-2xl border p-5", r.ranking.counted ? "border-teal/40 bg-teal/5" : "border-border bg-card")}>
              <p className="font-bold">{r.ranking.counted ? "Reytingga hisoblandi" : "Reytingga hisoblanmadi"}</p>
              <p className="mt-1 text-sm text-muted-foreground">{r.ranking.reason}</p>
              {rank && (
                <p className="mt-3 text-sm">
                  {rank.ranked && rank.overall ? <>Umumiy o&apos;rningiz: <b>{rank.overall.rank}</b> / {rank.overall.total}{rank.inDirection && rank.directionLabel ? <> · {rank.directionLabel}: <b>{rank.inDirection.rank}</b> / {rank.inDirection.total}</> : null}. Tayyorgarlik indeksi: <b>{rank.overall.index}</b>.</>
                    : rank.comparing ? "Natijangiz saqlandi. Yetarli ishtirokchi to'planguncha umumiy o'rin hisoblanmaydi."
                    : rank.nextStep ? <>Reytingga kirish uchun: <Link href={rank.nextStep.href} className="font-semibold text-primary hover:underline">{rank.nextStep.text}</Link>.</> : (rank.blockers[0] ?? "")}
                </p>
              )}
            </div>
          )}

          <div className="flex flex-wrap gap-3">
            <Button variant="outline" onClick={toErrors}>Xatolarimni ko&apos;rish</Button>
            <Button asChild variant="outline"><Link href="/ustoz-ai/natijalar">Natijalarim</Link></Button>
            <Button asChild><Link href="/reyting">Reytingdagi o&apos;rnim</Link></Button>
          </div>

          <div id="javoblar">
            <h2 className="mb-4 text-lg font-extrabold">Javoblar tahlili</h2>
            <ol className="space-y-4">
              {r.review.map((x) => (
                <li key={x.id} className="rounded-2xl border border-border bg-card p-5">
                  <div className="flex items-start gap-3">
                    {x.ok ? <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-success" /> : <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-danger" />}
                    <p className="whitespace-pre-wrap font-semibold">{x.n}. {x.text}</p>
                  </div>
                  {x.type === "CHOICE" ? (
                    <ul className="mt-3 space-y-1.5 pl-8 text-sm">
                      {x.options?.map((o, i) => (
                        <li key={i} className={cn("rounded-lg px-3 py-1.5", i === x.correct ? "bg-success/15 font-semibold" : i === x.chosen ? "bg-danger/10" : "")}>
                          <b>{LETTERS[i]}.</b> {o}{i === x.correct && "  ✓ to'g'ri"}{i === x.chosen && i !== x.correct && "  ✗ sizning javobingiz"}
                        </li>
                      ))}
                      {x.chosen === null && <li className="px-3 text-muted-foreground">Javob berilmagan</li>}
                    </ul>
                  ) : (
                    <div className="mt-3 space-y-1 pl-8 text-sm">
                      <p>Sizning javobingiz: <b>{x.given || "Javob berilmagan"}</b></p>
                      {!x.ok && <p>To'g'ri javob: <b className="text-success">{x.accepted?.[0]}</b></p>}
                    </div>
                  )}
                  {x.explanation && <p className="mt-3 pl-8 text-sm text-muted-foreground">{x.explanation}</p>}
                </li>
              ))}
            </ol>
          </div>
        </div>
      </div>
    </Shell>
  );
}
