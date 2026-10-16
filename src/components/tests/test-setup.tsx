"use client";
import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, ArrowRight, Info, Target, Timer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/states";
import { Switch } from "@/components/ui/switch";
import { SearchSelect, Segmented } from "@/components/practice/search-select";
import { SETUP, TONES, type SetupMode } from "@/components/tests/modes";
import { call, sessionHref, type ErrorsProgress, type TopicInfo, type TopicsData } from "@/lib/practice-client";
import { cn } from "@/lib/utils";

const ALL = "__all__";
const DIFFS = [{ value: "EASY", label: "Oson" }, { value: "MEDIUM", label: "O'rta" }, { value: "HARD", label: "Qiyin" }, { value: "MIXED", label: "Aralash" }];

/** Savollar soniga mos vaqtlar (daqiqa): savolga ~1, ~1.5 va ~2 daqiqa. (Server tomondagi timeOptions bilan bir xil qoida.) */
const timeOptions = (count: number) => { const r = (x: number) => Math.max(5, Math.round(x / 5) * 5); return [...new Set([r(count), r(count * 1.5), r(count * 2)])]; };

function TimeField({ required, count, minutes, setMinutes, enabled, setEnabled }: { required: boolean; count: number; minutes: number; setMinutes: (n: number) => void; enabled: boolean; setEnabled: (v: boolean) => void }) {
  const presets = timeOptions(count);
  return (
    <div>
      {!required && (
        <div className="mb-2 flex items-center justify-between gap-3">
          <label htmlFor="timer-sw" className="flex items-center gap-2 text-sm font-bold"><Timer className="h-4 w-4 text-muted-foreground" aria-hidden />Taymer qo'shish</label>
          <Switch id="timer-sw" checked={enabled} onCheckedChange={setEnabled} aria-label="Taymer qo'shish" />
        </div>
      )}
      {required && <p className="mb-1.5 text-sm font-bold">Vaqt (daqiqa)</p>}
      {(required || enabled) && (
        <>
          <div role="radiogroup" aria-label="Vaqt" className="flex flex-wrap items-center gap-2">
            {presets.map((m) => (
              <button key={m} type="button" role="radio" aria-checked={m === minutes} onClick={() => setMinutes(m)}
                className={cn("h-11 min-w-[64px] rounded-full border px-4 text-sm font-bold transition-colors", m === minutes ? "border-primary bg-primary text-white shadow-soft" : "border-border bg-card hover:border-primary/50 hover:bg-primary/5")}>{m} daq</button>
            ))}
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              Boshqa:
              <input type="number" min={1} max={180} value={minutes} onChange={(e) => setMinutes(Math.min(180, Math.max(1, Number(e.target.value) || 1)))} aria-label="Vaqt, daqiqada"
                className="h-11 w-20 rounded-xl border border-border bg-card px-3 text-sm font-bold text-foreground" />
            </label>
          </div>
          <p className="mt-1.5 text-xs text-muted-foreground">Vaqt server soatida hisoblanadi: sahifani yangilasangiz ham qayta boshlanmaydi. Vaqt tugasa, test avtomatik yakunlanadi.</p>
        </>
      )}
    </div>
  );
}

function TopicChecklist({ subjects, selected, setSelected }: { subjects: TopicsData["subjects"]; selected: string[]; setSelected: (ids: string[]) => void }) {
  const [q, setQ] = React.useState("");
  const toggle = (id: string) => setSelected(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);
  return (
    <fieldset>
      <legend className="mb-1.5 text-sm font-bold">Mavzular <span className="font-normal text-muted-foreground">({selected.length} ta tanlandi, kamida 2 ta kerak)</span></legend>
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Mavzu qidirish..." aria-label="Mavzu qidirish" className="mb-2 h-11 w-full rounded-xl border border-border bg-card px-3 text-sm" />
      <div className="max-h-72 space-y-3 overflow-y-auto rounded-xl border border-border p-2.5">
        {subjects.map((s) => {
          const list = s.topics.filter((t) => t.name.toLowerCase().includes(q.trim().toLowerCase()));
          if (list.length === 0) return null;
          const ids = list.map((t) => t.id), all = ids.every((i) => selected.includes(i));
          return (
            <div key={s.id}>
              <div className="mb-1 flex items-center justify-between gap-2">
                <p className="text-xs font-extrabold uppercase tracking-wide text-muted-foreground">{s.name}</p>
                <button type="button" className="text-xs font-semibold text-primary hover:underline" onClick={() => setSelected(all ? selected.filter((x) => !ids.includes(x)) : [...new Set([...selected, ...ids])])}>{all ? "Tanlovni bekor qilish" : "Hammasini tanlash"}</button>
              </div>
              <ul className="space-y-1">
                {list.map((t) => (
                  <li key={t.id}>
                    <label className={cn("flex min-h-[44px] cursor-pointer items-center gap-3 rounded-lg px-2.5 py-2 text-sm hover:bg-muted", t.total === 0 && "opacity-60")}>
                      <input type="checkbox" checked={selected.includes(t.id)} onChange={() => toggle(t.id)} className="h-5 w-5 shrink-0 accent-[hsl(var(--primary))]" />
                      <span className="min-w-0 flex-1 font-medium">{t.name}</span>
                      <span className="shrink-0 text-xs text-muted-foreground">{t.total ? `${t.total} ta savol` : "savol yo'q"}</span>
                    </label>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </fieldset>
  );
}

function ErrorsPanel({ p }: { p: ErrorsProgress | null }) {
  if (!p) return <Skeleton className="h-28" />;
  return (
    <div className="rounded-xl border border-border bg-muted/40 p-4">
      <p className="flex items-center gap-2 text-sm font-extrabold"><Target className="h-4 w-4 text-danger" aria-hidden />Sizning xatolaringiz</p>
      <dl className="mt-2 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
        {[["Ochiq", p.open], ["Takrorlash vaqti kelgan", p.due], ["7 kunda takrorlanadi", p.soon], ["Mustahkamlangan", p.mastered]].map(([k, v]) => (
          <div key={String(k)} className="rounded-lg bg-card p-2.5 text-center"><dd className="text-xl font-extrabold">{v}</dd><dt className="text-xs text-muted-foreground">{k}</dt></div>
        ))}
      </dl>
      {p.repeated.length > 0 && (
        <div className="mt-3"><p className="text-xs font-bold text-muted-foreground">Takrorlangan xatolar</p>
          <ul className="mt-1 space-y-1 text-sm">{p.repeated.map((r, i) => <li key={i}><b>{r.mistakes} marta:</b> {r.skill ?? r.topic}</li>)}</ul></div>
      )}
      {p.improved.length > 0 && <p className="mt-2 text-sm text-muted-foreground">Yaxshilanish bor: {p.improved.map((x) => `${x.topic} (${x.n} ta)`).join(", ")}.</p>}
    </div>
  );
}

/** Barcha rejimlar uchun yagona sozlash formasi: rejimga qarab faqat kerakli maydonlar ko'rsatiladi. */
export function TestSetup({ mode }: { mode: SetupMode }) {
  const cfg = SETUP[mode];
  const router = useRouter();
  const wantedTopic = useSearchParams().get("topic");
  const [data, setData] = React.useState<TopicsData | null>(null);
  const [err, setErr] = React.useState<{ text: string; anon: boolean } | null>(null);
  const [errors, setErrors] = React.useState<ErrorsProgress | null>(null);
  const [subjectId, setSubjectId] = React.useState<string | null>(null);
  const [topicId, setTopicId] = React.useState<string>(cfg.topic === "single" ? "" : ALL);
  const [multi, setMulti] = React.useState<string[]>([]);
  const [count, setCount] = React.useState(cfg.counts.includes(10) ? 10 : cfg.counts[0]);
  const [diff, setDiff] = React.useState("MIXED");
  const [timer, setTimer] = React.useState(false);
  const [minutes, setMinutes] = React.useState(timeOptions(10)[1] ?? 15);
  const [customTime, setCustomTime] = React.useState(false);
  const [variant, setVariant] = React.useState<"old" | "new">("old");
  const [distribution, setDistribution] = React.useState<"equal" | "weak">("equal");
  const [busy, setBusy] = React.useState(false);
  const [startErr, setStartErr] = React.useState("");

  React.useEffect(() => {
    void (async () => {
      if (mode === "errors") {
        const r = await call<ErrorsProgress>("/api/practice/errors");
        if (r.ok) { setErrors(r.data); setData({ subjects: [], last: null }); } else setErr({ text: r.error, anon: r.status === 401 });
        return;
      }
      const r = await call<TopicsData>("/api/practice/topics");
      if (!r.ok) { setErr({ text: r.error, anon: r.status === 401 }); return; }
      const d = r.data;
      setData(d);
      const all = d.subjects.flatMap((s) => s.topics);
      const fromUrl = wantedTopic && all.some((t) => t.id === wantedTopic) ? wantedTopic : null;
      const lastTopic = fromUrl ?? d.last?.topicIds[0];
      const sub = (lastTopic && d.subjects.find((s) => s.topics.some((t) => t.id === lastTopic))) || d.subjects.find((s) => s.topics.some((t) => t.total > 0)) || d.subjects[0];
      setSubjectId(sub?.id ?? null);
      if (cfg.topic === "single") setTopicId(lastTopic && sub?.topics.some((t) => t.id === lastTopic) ? lastTopic : sub?.topics.find((t) => t.total > 0)?.id ?? sub?.topics[0]?.id ?? "");
      else if (cfg.topic === "single-or-all" && lastTopic && sub?.topics.some((t) => t.id === lastTopic) && (fromUrl || (d.last?.topicIds.length ?? 0) === 1)) setTopicId(lastTopic);
      if (cfg.topic === "multi") setMulti(d.last && d.last.topicIds.length > 1 ? d.last.topicIds.filter((i) => all.some((t) => t.id === i)) : []);
      if (d.last) { if (cfg.counts.includes(d.last.count)) setCount(d.last.count); if (cfg.difficulty) setDiff(d.last.difficulty); }
    })();
  }, [mode, wantedTopic, cfg.topic, cfg.counts, cfg.difficulty]);

  const changeCount = (n: number) => { setCount(n); if (!customTime) setMinutes(timeOptions(n)[1] ?? timeOptions(n)[0]); };

  const subjects = data?.subjects ?? [];
  const subject = subjects.find((s) => s.id === subjectId);
  const topics = subject?.topics ?? [];
  const allTopics: TopicInfo[] = subjects.flatMap((s) => s.topics);
  const picked: TopicInfo[] = cfg.topic === "multi" ? allTopics.filter((t) => multi.includes(t.id))
    : cfg.topic === "none" ? [] : topicId === ALL ? topics : topics.filter((t) => t.id === topicId);
  const topicIds = picked.map((t) => t.id);
  const available = mode === "errors" ? errors?.open ?? 0
    : picked.reduce((n, t) => n + (mode === "situational" ? t.situational : diff === "MIXED" ? t.total : t.counts[diff as "EASY" | "MEDIUM" | "HARD"]), 0);
  const objectives = cfg.topic === "single" ? picked[0]?.objectives ?? [] : [];

  let blocker = "";
  if (mode === "errors") { if (errors && errors.open === 0) blocker = "Hozircha xatolaringiz yo'q."; }
  else if (cfg.topic === "multi" && multi.length < 2) blocker = "Kamida 2 ta mavzu tanlang.";
  else if (cfg.topic === "single" && !topicId) blocker = "Mavzuni tanlang.";
  else if (available === 0) blocker = mode === "situational" ? "Tanlovda vaziyatli savollar hozircha yo'q." : "Bu mavzuda hozircha tasdiqlangan savollar yo'q.";

  const start = async () => {
    setBusy(true); setStartErr("");
    const body: Record<string, unknown> = { kind: cfg.kind, count };
    if (cfg.topic !== "none") body.topicIds = topicIds;
    if (cfg.difficulty) body.difficulty = diff;
    if (cfg.time === "required" || (cfg.time === "optional" && timer)) body.durationMin = minutes;
    if (cfg.extra === "variant") body.variant = variant;
    if (cfg.extra === "distribution") body.distribution = distribution;
    const r = await call<{ id: string }>("/api/practice/start", "POST", body);
    if (r.ok) { router.push(sessionHref(cfg.kind, r.data.id)); return; }
    setBusy(false); setStartErr(r.error);
  };

  const back = mode === "practice" || mode === "ai" ? "/ustoz-ai/mashq" : "/ustoz-ai/testlar";
  return (
    <div className="mx-auto max-w-2xl">
      <Link href={back} className="mb-4 flex w-fit items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" aria-hidden />Orqaga</Link>
      <p className={cn("mb-2 inline-flex rounded-full px-3 py-1 text-xs font-bold", TONES.blue)}>{cfg.title}</p>
      <h1 className="text-3xl font-extrabold tracking-tight">Mashqingizni tayyorlaymiz</h1>
      <p className="mt-1.5 text-muted-foreground">{cfg.lead}</p>

      <div className="mt-6">
        {err?.anon ? <EmptyState title="Tizimga kiring" text="Mashq qilish uchun avval tizimga kirishingiz kerak." action={<Button asChild><Link href="/kirish">Kirish</Link></Button>} />
          : err ? <ErrorState text={err.text} onRetry={() => location.reload()} />
          : !data ? <Skeleton className="h-96" />
          : mode !== "errors" && subjects.length === 0 ? <EmptyState title="Hozircha fanlar yo'q" text="Fanlar va mavzular admin tomonidan qo'shiladi." />
          : (
            <Card className="space-y-5 p-5 sm:p-6">
              {mode === "errors" && <ErrorsPanel p={errors} />}
              {cfg.extra === "variant" && (
                <div>
                  <Segmented label="Qanday mashq qilamiz?" value={variant} onChange={setVariant} options={[{ value: "old", label: "Eski xatolarim" }, { value: "new", label: "Yangi vaziyatda sinash" }]} />
                  <p className="mt-1.5 text-xs text-muted-foreground">{variant === "old" ? "Avval xato qilgan savollaringiz qayta beriladi, eng avval takrorlash vaqti kelganlari." : "Xuddi shu ko'nikmaga oid, lekin boshqa savollar beriladi: tushunchani yodlab emas, tushunib o'zlashtirganingiz tekshiriladi."}</p>
                </div>
              )}

              {cfg.topic !== "none" && cfg.topic !== "multi" && <SearchSelect label="Fan" value={subjectId} onChange={(id) => { setSubjectId(id); setTopicId(cfg.topic === "single" ? subjects.find((s) => s.id === id)?.topics[0]?.id ?? "" : ALL); }} options={subjects.map((s) => ({ id: s.id, name: s.name, hint: `${s.topics.length} ta mavzu` }))} />}
              {(cfg.topic === "single-or-all" || cfg.topic === "single") && (
                <SearchSelect label="Mavzu" value={topicId || null} onChange={setTopicId} placeholder="Mavzuni tanlang"
                  options={[...(cfg.topic === "single-or-all" ? [{ id: ALL, name: "Fandagi barcha mavzular" }] : []), ...topics.map((t) => ({ id: t.id, name: t.name, hint: t.total ? `${t.total} ta savol` : "savollar hali yo'q" }))]} />
              )}
              {cfg.topic === "multi" && <TopicChecklist subjects={subjects} selected={multi} setSelected={setMulti} />}

              {objectives.length > 0 && (
                <div className="rounded-xl bg-teal/10 p-4">
                  <p className="text-sm font-extrabold">Bu mavzuda nimalarni bilib olasiz?</p>
                  <ul className="mt-1.5 list-disc space-y-1 pl-5 text-sm">{objectives.map((o) => <li key={o}>{o}</li>)}</ul>
                </div>
              )}

              <Segmented label="Savollar soni" value={count} options={cfg.counts.map((n) => ({ value: n, label: String(n) }))} onChange={changeCount} />
              {cfg.difficulty && <Segmented label="Murakkablik" value={diff} options={DIFFS} onChange={setDiff} />}
              {cfg.extra === "distribution" && (
                <div>
                  <Segmented label="Savollar taqsimoti" value={distribution} onChange={setDistribution} options={[{ value: "equal", label: "Teng taqsimlash" }, { value: "weak", label: "Zaif mavzular ko'proq" }]} />
                  <p className="mt-1.5 text-xs text-muted-foreground">{distribution === "equal" ? "Har bir tanlangan mavzudan taxminan teng sondagi savol tushadi." : "Natijangiz past yoki hali yechilmagan mavzulardan ko'proq savol tushadi."}</p>
                </div>
              )}
              {cfg.time !== "none" && <TimeField required={cfg.time === "required"} count={count} minutes={minutes} setMinutes={(n) => { setMinutes(n); setCustomTime(true); }} enabled={timer} setEnabled={setTimer} />}

              {blocker ? (
                <div role="status" className="rounded-xl border border-amber/40 bg-amber/10 p-4">
                  <p className="font-bold">{blocker}</p>
                  {mode !== "errors" && <p className="mt-1 text-sm text-muted-foreground">Boshqa mavzu yoki murakkablikni tanlang. Savollar soni soxta ma'lumot bilan to'ldirilmaydi.</p>}
                  {mode === "errors" && <Button asChild variant="outline" size="sm" className="mt-3"><Link href="/ustoz-ai/testlar">Boshqa rejimni tanlash</Link></Button>}
                </div>
              ) : (
                mode !== "errors" && <p className="flex items-start gap-2 text-sm text-muted-foreground"><Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />{available < count ? `Tanlovda atigi ${available} ta tasdiqlangan savol bor, test shuncha savol bilan boshlanadi.` : `Tanlovda ${available} ta tasdiqlangan savol bor.`}</p>
              )}
              {startErr && <p role="alert" className="rounded-xl bg-danger/10 p-3 text-sm text-danger">{startErr}</p>}
              <Button size="lg" className="h-14 w-full text-base" disabled={!!blocker} loading={busy} onClick={() => void start()}>Boshlash<ArrowRight className="h-5 w-5" aria-hidden /></Button>
            </Card>
          )}
      </div>
    </div>
  );
}
