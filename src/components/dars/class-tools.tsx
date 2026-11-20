"use client";
import * as React from "react";
import { BarChart3, Check, ClipboardList, Copy, Download, Link2, Lock, LockOpen, PenLine, Play, Plus, Shuffle, Square, ThumbsUp, Timer as TimerIcon, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/form";
import { cn } from "@/lib/utils";
import { MAX_OPT, MAX_OPTS, MAX_Q, MIN_OPTS, OPT_LETTERS, PULSE, attendanceCsv, attendanceText, fmtClock, fmtTimer } from "@/lib/class-tools";
import type { ClassApi } from "./use-class";

function beep() {
  try {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new AC();
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.connect(g); g.connect(ctx.destination);
    o.frequency.value = 880;
    g.gain.setValueAtTime(0.25, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.7);
    o.start(); o.stop(ctx.currentTime + 0.7);
    setTimeout(() => void ctx.close(), 900);
  } catch { /* brauzer ovozga ruxsat bermadi: jim o'tamiz */ }
}

/** Taymer: hamma ko'radi; vaqt tugaganda qisqa signal beradi. */
export function TimerChip({ end, total }: { end: number; total: number }) {
  const [now, setNow] = React.useState(() => Date.now());
  const beeped = React.useRef(false);
  React.useEffect(() => { beeped.current = false; const t = setInterval(() => setNow(Date.now()), 250); return () => clearInterval(t); }, [end]);
  const left = Math.max(0, (end - now) / 1000);
  React.useEffect(() => { if (left <= 0 && !beeped.current) { beeped.current = true; beep(); } }, [left]);
  const done = left <= 0;
  return (
    <div className={cn("flex items-center gap-3 rounded-2xl border p-3", done ? "border-danger bg-danger/10" : left <= 10 ? "border-amber bg-amber/10" : "border-border bg-card")} role="timer" aria-label="Taymer">
      <TimerIcon className={cn("h-6 w-6 shrink-0", done ? "text-danger" : "text-primary")} aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="text-2xl font-extrabold tabular-nums leading-none">{done ? "Vaqt tugadi!" : fmtTimer(left)}</p>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted"><div className={cn("h-full rounded-full", done ? "bg-danger" : "bg-primary")} style={{ width: `${total > 0 ? Math.min(100, (left / total) * 100) : 0}%` }} /></div>
      </div>
    </div>
  );
}

function Bars({ labels, counts, correct, mine, total }: { labels: string[]; counts: number[]; correct?: number | null; mine?: number | null; total: number }) {
  const max = Math.max(1, ...counts);
  return (
    <ul className="space-y-2">
      {labels.map((l, i) => (
        <li key={i}>
          <div className="flex items-center justify-between gap-2 text-sm">
            <span className="min-w-0 truncate font-semibold">{OPT_LETTERS[i]}. {l}{correct === i && <Check className="ml-1 inline h-4 w-4 text-success" aria-label="to'g'ri javob" />}{mine === i && <span className="ml-1 text-xs text-muted-foreground">(sizning javobingiz)</span>}</span>
            <span className="shrink-0 tabular-nums text-muted-foreground">{counts[i] ?? 0}{total > 0 ? ` · ${Math.round(((counts[i] ?? 0) / total) * 100)}%` : ""}</span>
          </div>
          <div className="mt-1 h-2.5 overflow-hidden rounded-full bg-muted"><div className={cn("h-full rounded-full", correct === i ? "bg-success" : "bg-primary")} style={{ width: `${((counts[i] ?? 0) / max) * 100}%` }} /></div>
        </li>
      ))}
    </ul>
  );
}

/** Hamma uchun: taymer, tanlangan o'quvchi, "tushundingizmi?", so'rovnoma va materiallar. Ustoz bularni o'zining asboblar panelidan boshqaradi. */
export function ClassBar({ api, meId }: { api: ClassApi; meId: string }) {
  const { cls, isHost, timerEnd, guest } = api;
  const [dismissed, setDismissed] = React.useState(0);
  const pick = cls.pick;
  React.useEffect(() => {
    if (!pick) return;
    const t = setTimeout(() => setDismissed(pick.id), 25_000);
    return () => clearTimeout(t);
  }, [pick]);
  const poll = cls.poll;
  const nothing = !timerEnd && !(pick && dismissed !== pick.id) && !(!isHost && (cls.pulse || poll)) && !(!isHost && cls.mats.length);
  if (nothing) return null;
  return (
    <div className="space-y-3" aria-live="polite">
      {timerEnd && cls.timer && <TimerChip end={timerEnd} total={cls.timer.total} />}

      {pick && dismissed !== pick.id && (
        <div className={cn("flex items-center gap-3 rounded-2xl p-3 text-white", pick.who === meId ? "bg-success" : "bg-primary")} role="status">
          <Shuffle className="h-6 w-6 shrink-0" aria-hidden />
          <p className="min-w-0 flex-1 font-bold">{pick.who === meId ? "Sizning navbatingiz! Mikrofonni yoqib, javob bering." : `Navbat: ${pick.name}`}</p>
          <button type="button" onClick={() => setDismissed(pick.id)} className="grid h-8 w-8 place-items-center rounded-lg bg-white/20" aria-label="Yopish"><X className="h-4 w-4" aria-hidden /></button>
        </div>
      )}

      {!isHost && cls.pulse && (
        <Card className="p-4">
          <p className="font-extrabold">Mavzuni tushundingizmi?</p>
          <div className="mt-2 grid grid-cols-3 gap-2">
            {PULSE.map((p) => (
              <button key={p.v} type="button" onClick={() => guest.sendPulse(p.v)} aria-pressed={guest.myPulse === p.v}
                className={cn("rounded-xl border-2 px-2 py-3 text-sm font-bold", guest.myPulse === p.v ? (p.tone === "success" ? "border-success bg-success text-white" : p.tone === "amber" ? "border-amber bg-amber text-white" : "border-danger bg-danger text-white") : "border-border bg-card")}>
                {p.label}
              </button>
            ))}
          </div>
          {guest.myPulse !== null && <p className="mt-2 text-xs text-muted-foreground">Javobingiz ustozga yuborildi. Fikringiz o&apos;zgarsa, boshqasini bosing.</p>}
        </Card>
      )}

      {!isHost && poll && (
        <Card className="p-4">
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">So&apos;rovnoma</p>
          <p className="mt-1 text-lg font-extrabold leading-snug">{poll.q}</p>
          {poll.open ? (
            <>
              <div className="mt-3 grid gap-2">
                {poll.opts.map((o, i) => (
                  <button key={i} type="button" onClick={() => guest.vote(i)} aria-pressed={guest.myVote === i}
                    className={cn("flex items-center gap-3 rounded-xl border-2 px-3 py-3 text-left text-sm font-semibold", guest.myVote === i ? "border-primary bg-primary text-white" : "border-border bg-card")}>
                    <span className={cn("grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-extrabold", guest.myVote === i ? "bg-white/25" : "bg-primary/10 text-primary")}>{OPT_LETTERS[i]}</span>{o}
                  </button>
                ))}
              </div>
              <p className="mt-2 text-xs text-muted-foreground">{guest.myVote !== null ? "Javobingiz qabul qilindi. Ustoz yopguncha o'zgartirishingiz mumkin." : "Javobni tanlang."}</p>
            </>
          ) : poll.show && poll.counts ? (
            <div className="mt-3 space-y-3">
              {poll.correct !== null && guest.myVote !== null && (
                <p className={cn("rounded-xl p-2.5 text-center text-sm font-extrabold", guest.myVote === poll.correct ? "bg-success/15 text-success" : "bg-danger/10 text-danger")}>{guest.myVote === poll.correct ? "To'g'ri javob!" : `Noto'g'ri. To'g'ri javob: ${OPT_LETTERS[poll.correct]}`}</p>
              )}
              <Bars labels={poll.opts} counts={poll.counts} correct={poll.correct} mine={guest.myVote} total={poll.counts.reduce((a, b) => a + b, 0)} />
            </div>
          ) : (
            <p className="mt-3 rounded-xl bg-muted p-3 text-sm text-muted-foreground">Ovoz berish yopildi. Ustoz natijani ko&apos;rsatishini kuting.{guest.myVote !== null ? ` Sizning javobingiz: ${OPT_LETTERS[guest.myVote]}.` : ""}</p>
          )}
        </Card>
      )}

      {!isHost && cls.mats.length > 0 && (
        <Card className="p-4">
          <p className="flex items-center gap-2 font-extrabold"><Link2 className="h-4 w-4 text-primary" aria-hidden />Materiallar ({cls.mats.length})</p>
          <ul className="mt-2 space-y-1.5">
            {cls.mats.map((m) => (
              <li key={m.id}><a href={m.url} target="_blank" rel="noopener noreferrer" className="block truncate rounded-lg bg-muted px-3 py-2 text-sm font-semibold text-primary hover:underline">{m.title}</a></li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}

type Panel = "poll" | "pulse" | "timer" | "pick" | "mats" | "attend" | null;

function Tool({ icon: Icon, label, on, onClick }: { icon: React.ComponentType<{ className?: string }>; label: string; on?: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={on} className={cn("flex min-h-16 flex-col items-center justify-center gap-1.5 rounded-xl border-2 px-2 py-2 text-center text-xs font-bold", on ? "border-primary bg-primary/10 text-primary" : "border-border bg-card")}>
      <Icon className="h-5 w-5" aria-hidden />{label}
    </button>
  );
}

/** Ustozning asboblar paneli. */
export function HostTools({ api, title }: { api: ClassApi; title: string }) {
  const { cls, host, timerEnd, counts, voters, pulseCounts, pulseVoters, attendance } = api;
  const [panel, setPanel] = React.useState<Panel>(null);
  const toggle = (p: Exclude<Panel, null>) => setPanel((cur) => (cur === p ? null : p));
  return (
    <Card className="p-4">
      <h2 className="text-sm font-extrabold">Dars asboblari</h2>
      <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
        <Tool icon={PenLine} label={cls.stage === "board" ? "Doskani yopish" : "Doska"} on={cls.stage === "board"} onClick={() => api.patch({ stage: cls.stage === "board" ? "auto" : "board" })} />
        <Tool icon={BarChart3} label="So'rovnoma" on={panel === "poll" || !!cls.poll} onClick={() => toggle("poll")} />
        <Tool icon={ThumbsUp} label="Tushundingizmi?" on={panel === "pulse" || !!cls.pulse} onClick={() => toggle("pulse")} />
        <Tool icon={TimerIcon} label="Taymer" on={panel === "timer" || !!timerEnd} onClick={() => toggle("timer")} />
        <Tool icon={Shuffle} label="Tasodifiy o'quvchi" on={panel === "pick"} onClick={() => toggle("pick")} />
        <Tool icon={Link2} label={`Materiallar${cls.mats.length ? ` (${cls.mats.length})` : ""}`} on={panel === "mats"} onClick={() => toggle("mats")} />
        <Tool icon={ClipboardList} label="Davomat" on={panel === "attend"} onClick={() => toggle("attend")} />
        <Tool icon={cls.lock ? Lock : LockOpen} label={cls.lock ? "Chatni yoqish" : "Chatni to'xtatish"} on={cls.lock} onClick={() => api.patch({ lock: !cls.lock })} />
      </div>
      {cls.lock && <p className="mt-2 text-xs font-semibold text-amber">Chat o&apos;quvchilar uchun to&apos;xtatilgan: faqat siz yoza olasiz.</p>}

      {panel === "poll" && <PollPanel api={api} counts={counts} voters={voters} />}
      {panel === "pulse" && (
        <div className="mt-4 space-y-3 border-t border-border pt-4">
          <p className="text-sm text-muted-foreground">O&apos;quvchilarga «Tushundim / Sekinroq / Tushunmadim» tugmalari chiqadi. Natijani faqat siz ko&apos;rasiz.</p>
          {cls.pulse ? (
            <>
              <Bars labels={PULSE.map((p) => p.label)} counts={pulseCounts} total={pulseVoters} />
              <p className="text-xs text-muted-foreground">Javob berdi: {pulseVoters}</p>
              <Button variant="outline" onClick={host.stopPulse}><Square className="h-4 w-4" aria-hidden />So&apos;rovni yopish</Button>
            </>
          ) : (
            <>
              {pulseVoters > 0 && <><p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Oxirgi natija</p><Bars labels={PULSE.map((p) => p.label)} counts={pulseCounts} total={pulseVoters} /></>}
              <Button onClick={host.startPulse}><Play className="h-4 w-4" aria-hidden />«Tushundingizmi?» deb so&apos;rash</Button>
            </>
          )}
        </div>
      )}
      {panel === "timer" && <TimerPanel api={api} />}
      {panel === "pick" && <PickPanel api={api} />}
      {panel === "mats" && <MatsPanel api={api} />}
      {panel === "attend" && (
        <div className="mt-4 space-y-3 border-t border-border pt-4">
          <p className="text-sm text-muted-foreground">Dars paytida kirgan o&apos;quvchilar ({attendance.length}). Ro&apos;yxat shu sahifada turadi: sahifani yopsangiz yo&apos;qoladi, shuning uchun dars oxirida nusxalab oling.</p>
          {attendance.length === 0 ? <p className="rounded-xl bg-muted p-3 text-sm text-muted-foreground">Hali o&apos;quvchi kirmadi.</p> : (
            <ul className="max-h-56 divide-y divide-border overflow-y-auto rounded-xl border border-border text-sm">
              {attendance.map((a, i) => (
                <li key={a.identity} className="flex items-center justify-between gap-2 px-3 py-2">
                  <span className="min-w-0 truncate font-semibold">{i + 1}. {a.name}</span>
                  <span className={cn("shrink-0 text-xs", a.last ? "text-muted-foreground" : "font-semibold text-success")}>{fmtClock(a.first)}{a.last ? ` - ${fmtClock(a.last)}` : " · xonada"}</span>
                </li>
              ))}
            </ul>
          )}
          <AttendanceButtons title={title} rows={attendance} />
        </div>
      )}
    </Card>
  );
}

function AttendanceButtons({ title, rows }: { title: string; rows: ClassApi["attendance"] }) {
  const [copied, setCopied] = React.useState(false);
  async function copy() {
    const text = attendanceText(title, rows, Date.now());
    try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { window.prompt("Nusxalang:", text); }
  }
  function csv() {
    const url = URL.createObjectURL(new Blob(["﻿" + attendanceCsv(rows)], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url; a.download = "davomat.csv"; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return (
    <div className="flex flex-wrap gap-2">
      <Button variant="outline" disabled={rows.length === 0} onClick={() => void copy()}>{copied ? <Check className="h-4 w-4" aria-hidden /> : <Copy className="h-4 w-4" aria-hidden />}{copied ? "Nusxalandi" : "Matnni nusxalash"}</Button>
      <Button variant="outline" disabled={rows.length === 0} onClick={csv}><Download className="h-4 w-4" aria-hidden />CSV yuklab olish</Button>
    </div>
  );
}

function PollPanel({ api, counts, voters }: { api: ClassApi; counts: number[]; voters: number }) {
  const { cls, host } = api;
  const [q, setQ] = React.useState("");
  const [opts, setOpts] = React.useState(["", ""]);
  const [correct, setCorrect] = React.useState<number | null>(null);
  const [err, setErr] = React.useState("");
  const poll = cls.poll;
  const total = counts.reduce((a, b) => a + b, 0);
  function start(e: React.FormEvent) {
    e.preventDefault();
    if (!host.startPoll(q, opts, correct)) setErr(`Savolni va kamida ${MIN_OPTS} ta variantni yozing.`);
    else { setErr(""); setQ(""); setOpts(["", ""]); setCorrect(null); }
  }
  if (poll) {
    return (
      <div className="mt-4 space-y-3 border-t border-border pt-4">
        <p className="font-extrabold">{poll.q}</p>
        <Bars labels={poll.opts} counts={counts} correct={poll.correct} total={total} />
        <p className="text-xs text-muted-foreground">Javob berdi: {voters}. {poll.open ? "Ovoz berish ochiq." : poll.show ? "Natija o'quvchilarga ko'rsatilgan." : "Ovoz berish yopilgan."}</p>
        <div className="flex flex-wrap gap-2">
          {poll.open && <Button onClick={host.closePoll}><Square className="h-4 w-4" aria-hidden />Ovozni yopish</Button>}
          {!poll.show ? <Button variant={poll.open ? "outline" : "primary"} onClick={() => host.showPoll(true)}>Natijani ko&apos;rsatish</Button> : <Button variant="outline" onClick={() => host.showPoll(false)}>Natijani yashirish</Button>}
          <Button variant="outline" onClick={host.clearPoll}><Trash2 className="h-4 w-4" aria-hidden />Yangi so&apos;rovnoma</Button>
        </div>
      </div>
    );
  }
  return (
    <form className="mt-4 space-y-3 border-t border-border pt-4" onSubmit={start}>
      <p className="text-sm text-muted-foreground">Tezkor savol yoki mini-test: o&apos;quvchilar variantni bosadi, natijani siz ko&apos;rasiz. To&apos;g&apos;ri javobni belgilasangiz, ko&apos;rsatganingizda o&apos;quvchi o&apos;zi tekshiradi.</p>
      <Input value={q} onChange={(e) => setQ(e.target.value)} maxLength={MAX_Q} placeholder="Savol. Masalan: 2 + 2 × 2 = ?" aria-label="Savol" />
      <ul className="space-y-2">
        {opts.map((o, i) => (
          <li key={i} className="flex items-center gap-2">
            <input type="radio" name="togri" className="h-4 w-4 shrink-0 accent-[hsl(var(--success))]" checked={correct === i} onChange={() => setCorrect(i)} aria-label={`${OPT_LETTERS[i]} variant to'g'ri javob`} title="To'g'ri javob" />
            <span className="w-5 shrink-0 text-sm font-extrabold text-muted-foreground">{OPT_LETTERS[i]}</span>
            <Input value={o} onChange={(e) => setOpts((a) => a.map((x, j) => (j === i ? e.target.value : x)))} maxLength={MAX_OPT} placeholder={`${i + 1}-variant`} aria-label={`${OPT_LETTERS[i]} variant`} />
            {opts.length > MIN_OPTS && <Button type="button" size="icon" variant="ghost" aria-label="Variantni o'chirish" onClick={() => { setOpts((a) => a.filter((_, j) => j !== i)); setCorrect((c) => (c === null ? null : c === i ? null : c > i ? c - 1 : c)); }}><X className="h-4 w-4" aria-hidden /></Button>}
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap items-center gap-2">
        {opts.length < MAX_OPTS && <Button type="button" variant="outline" size="sm" onClick={() => setOpts((a) => [...a, ""])}><Plus className="h-4 w-4" aria-hidden />Variant qo&apos;shish</Button>}
        {correct !== null && <button type="button" className="text-xs font-semibold text-primary underline" onClick={() => setCorrect(null)}>To&apos;g&apos;ri javobni olib tashlash</button>}
      </div>
      {err && <p role="alert" className="text-sm font-semibold text-danger">{err}</p>}
      <Button type="submit"><Play className="h-4 w-4" aria-hidden />So&apos;rovnomani boshlash</Button>
    </form>
  );
}

function TimerPanel({ api }: { api: ClassApi }) {
  const [min, setMin] = React.useState("");
  const running = !!api.timerEnd && !!api.cls.timer;
  return (
    <div className="mt-4 space-y-3 border-t border-border pt-4">
      <p className="text-sm text-muted-foreground">Hamma o&apos;quvchi ekranida chiqadi; vaqt tugaganda signal beradi. Mustaqil ish, juftlikda muhokama yoki chiqish savoli uchun qulay.</p>
      {running && api.timerEnd && api.cls.timer && <TimerChip end={api.timerEnd} total={api.cls.timer.total} />}
      <div className="flex flex-wrap gap-2">
        {[1, 3, 5, 10, 15].map((m) => <Button key={m} variant="outline" size="sm" onClick={() => api.host.startTimer(m * 60)}>{m} daqiqa</Button>)}
      </div>
      <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); const n = Number(min.replace(",", ".")); if (n > 0) { api.host.startTimer(n * 60); setMin(""); } }}>
        <Input value={min} onChange={(e) => setMin(e.target.value)} inputMode="decimal" placeholder="Daqiqa (masalan 2.5)" aria-label="Daqiqa" className="max-w-44" />
        <Button type="submit" variant="outline" disabled={!(Number(min.replace(",", ".")) > 0)}>Boshlash</Button>
      </form>
      {running && <Button variant="danger" onClick={api.host.stopTimer}><Square className="h-4 w-4" aria-hidden />To&apos;xtatish</Button>}
    </div>
  );
}

function PickPanel({ api }: { api: ClassApi }) {
  const [allow, setAllow] = React.useState(true);
  const [msg, setMsg] = React.useState("");
  const pick = api.cls.pick;
  return (
    <div className="mt-4 space-y-3 border-t border-border pt-4">
      <p className="text-sm text-muted-foreground">Xonadagi o&apos;quvchilardan tasodifiy birini tanlaydi: hamma ekranida ismi chiqadi. Hamma navbat olmaguncha bir kishi ikki marta tanlanmaydi.</p>
      <label className="flex cursor-pointer items-center gap-2.5 text-sm">
        <input type="checkbox" className="h-5 w-5 accent-[hsl(var(--primary))]" checked={allow} onChange={(e) => setAllow(e.target.checked)} />
        <span>Tanlanganga gapirishga ruxsat ham berilsin</span>
      </label>
      <Button onClick={() => setMsg(api.host.pickStudent(allow) ? "" : "Xonada o'quvchi yo'q.")}><Shuffle className="h-4 w-4" aria-hidden />O&apos;quvchi tanlash</Button>
      {msg && <p role="alert" className="text-sm font-semibold text-danger">{msg}</p>}
      {pick && <p className="rounded-xl bg-primary/10 p-3 text-sm font-bold">Tanlandi: {pick.name} <button type="button" className="ml-2 text-xs font-semibold text-primary underline" onClick={api.host.clearPick}>Yashirish</button></p>}
    </div>
  );
}

function MatsPanel({ api }: { api: ClassApi }) {
  const [title, setTitle] = React.useState("");
  const [url, setUrl] = React.useState("");
  const [err, setErr] = React.useState("");
  return (
    <div className="mt-4 space-y-3 border-t border-border pt-4">
      <p className="text-sm text-muted-foreground">Dars materiallarini (video, hujjat, test havolasi) hammaga yuboring: o&apos;quvchilar ekranida bosiladigan ro&apos;yxat bo&apos;ladi.</p>
      <form className="grid gap-2 sm:grid-cols-[1fr_1.4fr_auto]" onSubmit={(e) => { e.preventDefault(); const r = api.host.addMat(title, url); setErr(r ?? ""); if (!r) { setTitle(""); setUrl(""); } }}>
        <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} placeholder="Nomi (ixtiyoriy)" aria-label="Material nomi" />
        <Input value={url} onChange={(e) => setUrl(e.target.value)} maxLength={300} placeholder="https://..." aria-label="Havola" inputMode="url" />
        <Button type="submit" disabled={!url.trim()}><Plus className="h-4 w-4" aria-hidden />Qo&apos;shish</Button>
      </form>
      {err && <p role="alert" className="text-sm font-semibold text-danger">{err}</p>}
      {api.cls.mats.length > 0 && (
        <ul className="space-y-1.5">
          {api.cls.mats.map((m) => (
            <li key={m.id} className="flex items-center gap-2 rounded-lg bg-muted px-3 py-2 text-sm">
              <a href={m.url} target="_blank" rel="noopener noreferrer" className="min-w-0 flex-1 truncate font-semibold text-primary hover:underline">{m.title}</a>
              <button type="button" onClick={() => api.host.removeMat(m.id)} className="grid h-7 w-7 shrink-0 place-items-center rounded-lg hover:bg-border" aria-label={`${m.title} ni o'chirish`}><Trash2 className="h-4 w-4" aria-hidden /></button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
