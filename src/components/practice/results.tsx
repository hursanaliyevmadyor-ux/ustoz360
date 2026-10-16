"use client";
import * as React from "react";
import Link from "next/link";
import { ArrowRight, Check, Clock, Compass, Flag, Info, Map as MapIcon, NotebookPen, RefreshCw, TrendingUp, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Confetti, RobotArt, TrophyArt } from "@/components/practice/illustrations";
import { SuperKeyCard } from "@/components/practice/feedback";
import { fmtDuration, type Result } from "@/lib/practice-client";

export function ScoreRing({ percent }: { percent: number }) {
  const r = 42, c = 2 * Math.PI * r;
  const tone = percent >= 70 ? "stroke-success" : percent >= 50 ? "stroke-amber" : "stroke-danger";
  return (
    <div className="relative h-28 w-28 shrink-0" role="img" aria-label={`Natija: ${percent} foiz`}>
      <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
        <circle cx="50" cy="50" r={r} fill="none" strokeWidth="9" className="stroke-muted" />
        <circle cx="50" cy="50" r={r} fill="none" strokeWidth="9" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - percent / 100)} className={cn("transition-all duration-700", tone)} />
      </svg>
      <span className="absolute inset-0 grid place-items-center text-2xl font-extrabold">{percent}%</span>
    </div>
  );
}

export function TopicProgressCard({ title, icon: Icon, tone, items, empty }: { title: string; icon: React.ElementType; tone: "success" | "danger" | "primary"; items: string[]; empty: string }) {
  const toneCls = { success: "bg-success/10 text-success", danger: "bg-danger/10 text-danger", primary: "bg-primary/10 text-primary" }[tone];
  return (
    <Card className="p-4">
      <p className="flex items-center gap-2 text-sm font-extrabold"><span className={cn("grid h-8 w-8 place-items-center rounded-lg", toneCls)}><Icon className="h-4 w-4" aria-hidden /></span>{title}</p>
      {items.length === 0 ? <p className="mt-3 text-sm text-muted-foreground">{empty}</p> : (
        <ul className="mt-3 space-y-2">
          {items.map((t) => (
            <li key={t} className="flex items-start gap-2 text-sm">
              {tone === "success" ? <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden /> : <X className="mt-0.5 h-4 w-4 shrink-0 text-danger" aria-hidden />}{t}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

/** Natijalar paneli: "Bugungi natijangiz". Natija taxminiy ekanini ochiq aytadi, bitta to'g'ri javob = o'zlashtirish deb ko'rsatmaydi. */
export function PracticeResults({ r, againBusy, onAgain, onNext, nextBusy }: { r: Result; againBusy: boolean; onAgain: () => void; onNext: () => void; nextBusy: boolean }) {
  const [showWrong, setShowWrong] = React.useState(false);
  const note = r.percent >= 80 ? "Ajoyib natija!" : r.percent >= 50 ? "Yaxshi natija!" : "Hali yo'lning boshida";
  const noteText = r.percent >= 80 ? "Siz bu mavzularni yaxshi tushunyapsiz. Davom eting va vaqti-vaqti bilan qayta tekshirib turing."
    : r.percent >= 50 ? "Asosiy fikrlarni tushunibsiz. Xatolar ustida ishlab, natijani mustahkamlang."
    : "Xato qilish o'rganishning bir qismi. Izohlarni o'qib, mashqni qayta yeching.";
  const t = r.timing;
  return (
    <div className="mx-auto max-w-4xl">
      <section className="relative overflow-hidden rounded-3xl border border-border bg-card px-5 pb-6 pt-5 text-center shadow-soft">
        {r.percent >= 80 && <Confetti className="pointer-events-none absolute inset-0 h-full w-full" />}
        {r.percent >= 50 ? <TrophyArt className="relative mx-auto h-24 w-24" /> : <RobotArt className="relative mx-auto h-24 w-24" />}
        <p className="relative mt-1 text-xs font-bold uppercase tracking-wide text-muted-foreground">{r.kindLabel}</p>
        <h1 className="relative text-2xl font-extrabold tracking-tight sm:text-3xl">Bugungi natijangiz</h1>
        <p className="relative mt-1 text-muted-foreground">{r.headline.title} {r.headline.text}</p>
      </section>

      <Card className="mt-4 grid items-center gap-5 p-5 sm:grid-cols-[1fr_auto_1fr]">
        <div className="text-center sm:text-left">
          <p className="text-4xl font-extrabold tracking-tight text-primary"><span className="text-success">{r.score}</span> / {r.total}</p>
          <p className="text-sm text-muted-foreground">to'g'ri javob</p>
          {r.policy === "deferred" && <p className="mt-1 text-xs text-muted-foreground">Noto'g'ri: {r.answered - r.score} · Javobsiz: {r.skipped}</p>}
        </div>
        <div className="mx-auto"><ScoreRing percent={r.percent} /></div>
        <div className="rounded-xl bg-teal/10 p-3.5"><p className="text-sm font-extrabold">{note}</p><p className="mt-0.5 text-sm text-muted-foreground">{noteText}</p></div>
      </Card>

      {t.spentSec !== null && t.limitSec && (
        <Card className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-1 p-4 text-sm">
          <span className="flex items-center gap-2 font-bold"><Clock className="h-4 w-4 text-muted-foreground" aria-hidden />Sarflangan vaqt: {fmtDuration(t.spentSec)}</span>
          <span className="text-muted-foreground">Berilgan vaqt: {fmtDuration(t.limitSec)}{t.timedOut && " · vaqt tugab, test avtomatik yakunlandi"}</span>
          {r.flagged > 0 && <span className="flex items-center gap-1.5 text-muted-foreground"><Flag className="h-4 w-4" aria-hidden />Belgilangan: {r.flagged}</span>}
        </Card>
      )}

      {(r.approximate || (r.policy === "instant" && r.skipped > 0)) && (
        <p className="mt-3 flex items-start gap-2 rounded-xl bg-amber/10 p-3 text-sm"><Info className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden />
          <span>{r.approximate && <>Bu taxminiy natija: savollar soni kam ({r.total} ta), shuning uchun mavzuni o'zlashtirgansiz deb xulosa qilinmaydi. </>}{r.policy === "instant" && r.skipped > 0 && <>{r.skipped} ta savolga javob berilmadi.</>}</span></p>
      )}

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <TopicProgressCard title="Kuchli mavzular" icon={TrendingUp} tone="success" items={r.strengths} empty="Hozircha aniq kuchli mavzu ko'rinmayapti. Mashqni davom ettiring." />
        <TopicProgressCard title="Mustahkamlash kerak" icon={NotebookPen} tone="danger" items={r.toReinforce} empty="Hammasi joyida: mustahkamlash kerak mavzu yo'q." />
        <Card className="flex flex-col p-4">
          <p className="flex items-center gap-2 text-sm font-extrabold"><span className="grid h-8 w-8 place-items-center rounded-lg bg-primary/10 text-primary"><Compass className="h-4 w-4" aria-hidden /></span>Tavsiya</p>
          <p className="mt-3 flex-1 text-sm">{r.next.text}</p>
          <Button variant="outline" size="sm" className="mt-3 self-start" loading={nextBusy} onClick={onNext}>{r.next.action === "map" ? "Xaritani ochish" : "Boshlash"}<ArrowRight className="h-4 w-4" aria-hidden /></Button>
        </Card>
      </div>

      {r.skills.length > 0 && (
        <Card className="mt-3 p-4">
          <p className="text-sm font-extrabold">Tushunchalar bo'yicha</p>
          <ul className="mt-2 grid gap-x-6 gap-y-1.5 sm:grid-cols-2">
            {r.skills.map((s) => (
              <li key={s.skill} className="flex items-center justify-between gap-3 text-sm">
                <span className="min-w-0 truncate">{s.skill}</span>
                <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-xs font-bold", s.correct === s.total ? "bg-success/10 text-success" : "bg-danger/10 text-danger")}>{s.correct === s.total ? <Check className="mr-1 inline h-3 w-3" aria-hidden /> : <X className="mr-1 inline h-3 w-3" aria-hidden />}{s.correct} / {s.total}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <button type="button" onClick={() => setShowWrong((v) => !v)} aria-expanded={showWrong} disabled={r.wrong.length === 0}
          className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-navy px-4 text-sm font-bold text-background shadow-soft transition-opacity hover:opacity-90 disabled:opacity-50"><NotebookPen className="h-4 w-4" aria-hidden />Xatolarni ko'rish</button>
        <Button size="lg" className="h-12 text-sm" loading={againBusy} onClick={onAgain}><RefreshCw className="h-4 w-4" aria-hidden />Qayta mashq qilish</Button>
        <Button asChild variant="outline" className="h-12 text-sm"><Link href="/ustoz-ai/bilim-xaritasi"><MapIcon className="h-4 w-4" aria-hidden />Bilim xaritasiga o'tish</Link></Button>
      </div>
      {r.wrong.length === 0 && <p className="mt-2 text-center text-sm text-muted-foreground">Bu mashqda xato yo'q: tahlil qilinadigan savol qolmadi.</p>}

      {showWrong && r.wrong.length > 0 && (
        <section className="mt-5 space-y-3" aria-label="Xatolar tahlili">
          <h2 className="text-lg font-extrabold">Xatolaringizni birga ko'rib chiqamiz</h2>
          {r.wrong.map((w) => (
            <Card key={w.questionId} className="p-4">
              <p className="text-xs font-semibold text-muted-foreground">{w.topic}{w.skill && ` · ${w.skill}`}</p>
              <p className="mt-1 font-bold leading-snug">{w.text}</p>
              <dl className="mt-3 space-y-1.5 text-sm">
                <div className="flex gap-2"><dt className="shrink-0 font-semibold text-danger">Sizning javobingiz:</dt><dd>{w.chosen ?? "javob berilmagan"}</dd></div>
                <div className="flex gap-2"><dt className="shrink-0 font-semibold text-success">To'g'ri javob:</dt><dd>{w.correct}</dd></div>
              </dl>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{w.explanation}</p>
              {w.superKey && <div className="mt-3"><SuperKeyCard text={w.superKey} /></div>}
            </Card>
          ))}
        </section>
      )}
    </div>
  );
}
