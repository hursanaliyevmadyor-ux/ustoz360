"use client";
import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Clock, FileQuestion, Maximize, PenLine, Play, RotateCcw, Shuffle, ShieldCheck, Trophy } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

type Item = { slug: string; title: string; subject: string; kind: string; durationMin: number; questionCount: number; choiceCount: number; writtenCount: number; openAttemptId: string | null; last: { id: string; score: number | null; total: number | null; at: string | null } | null; directionLabel: string | null; ranked: boolean; maxAttempts: number };
type Summary = { rankingOn: boolean; rankedCompleted: number; last: { id: string; title: string; score: number | null; total: number | null; at: string | null } | null };
const KIND: Record<string, { label: string; icon: React.ElementType }> = {
  TEST: { label: "Test (variantli)", icon: FileQuestion }, WRITTEN: { label: "Yozma javobli", icon: PenLine }, MIXED: { label: "Aralash", icon: Shuffle },
};

export default function Page() {
  const router = useRouter();
  const [items, setItems] = React.useState<Item[] | null>(null);
  const [summary, setSummary] = React.useState<Summary | null>(null);
  const [anon, setAnon] = React.useState(false);
  const [busy, setBusy] = React.useState<string | null>(null);
  const [err, setErr] = React.useState("");

  React.useEffect(() => {
    fetch("/api/exam").then(async (r) => {
      if (r.status === 401) { setAnon(true); return; }
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setErr(d.error ?? "Imtihonlarni yuklab bo'lmadi."); return; }
      setItems(d.exams); setSummary(d.summary ?? null);
    }).catch(() => setErr("Server bilan aloqa yo'q."));
  }, []);

  const start = async (it: Item) => {
    if (busy) return; setBusy(it.slug); setErr("");
    // To'liq ekranga o'tish foydalanuvchi bosgan paytda bo'lishi shart (brauzer talabi), shuning uchun so'rovdan oldin.
    // Brauzer javob bermay qolsa ham imtihon boshlanishi uchun har bir so'rovga vaqt chegarasi qo'yilgan.
    const soft = (p: Promise<unknown> | undefined, ms: number) => Promise.race([(p ?? Promise.resolve()).catch(() => {}), new Promise((res) => setTimeout(res, ms))]);
    try { if (document.documentElement.requestFullscreen && !document.fullscreenElement) await soft(document.documentElement.requestFullscreen({ navigationUI: "hide" }), 1500); } catch { /* imtihon sahifasi qayta so'raydi */ }
    try { await soft((navigator as unknown as { keyboard?: { lock?: (k: string[]) => Promise<void> } }).keyboard?.lock?.(["Escape"]), 800); } catch { /* ba'zi brauzerlarda yo'q */ }
    try {
      const r = await fetch("/api/exam/start", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ slug: it.slug }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setErr(d.error ?? "Imtihonni boshlab bo'lmadi."); if (document.fullscreenElement) void document.exitFullscreen(); return; }
      router.push(`/imtihon/${d.id}`);
    } catch { setErr("Server bilan aloqa yo'q."); if (document.fullscreenElement) void document.exitFullscreen(); }
    finally { setBusy(null); }
  };

  return (
    <>
      <header className="mb-6">
        <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">Haqiqiy sinovga tayyormisiz?</h1>
        <p className="mt-1.5 text-muted-foreground">Bilimingizni imtihon sharoitida sinang, natijalaringizni tahlil qiling va reytingdagi o&apos;rningizni kuzating.</p>
      </header>

      {summary && (
        <section aria-label="Sizning natijalaringiz" className="mb-6 grid gap-3 sm:grid-cols-3">
          <Card className="p-4">
            <p className="text-xs font-semibold text-muted-foreground">Oxirgi natija</p>
            {summary.last && summary.last.total ? <><p className="mt-1 text-2xl font-extrabold">{summary.last.score} / {summary.last.total} <span className="text-base text-muted-foreground">({Math.round(((summary.last.score ?? 0) / summary.last.total) * 100)}%)</span></p>
              <p className="truncate text-sm text-muted-foreground">{summary.last.title} · <Link className="font-semibold text-primary hover:underline" href={`/imtihon/${summary.last.id}`}>ko&apos;rish</Link></p></> : <p className="mt-1 text-sm text-muted-foreground">Hali imtihon topshirmagansiz.</p>}
          </Card>
          <Card className="p-4">
            <p className="text-xs font-semibold text-muted-foreground">Yakunlangan reyting sinovlari</p>
            <p className="mt-1 text-2xl font-extrabold">{summary.rankedCompleted}</p>
            <p className="text-sm text-muted-foreground">{summary.rankingOn ? "Faqat «Reytingga hisoblanadi» belgili imtihonlar." : "Reyting hozir o'chiq."}</p>
          </Card>
          <Card className="flex flex-col justify-between p-4">
            <p className="text-xs font-semibold text-muted-foreground">Ustozlar reytingi</p>
            <p className="text-sm text-muted-foreground">Reytingdagi o&apos;rningizni va tayyorgarlik indeksingizni ko&apos;ring.</p>
            <Button asChild variant="outline" size="sm" className="mt-2 w-fit"><Link href="/reyting"><Trophy className="h-4 w-4" aria-hidden />Reytingga o&apos;tish</Link></Button>
          </Card>
        </section>
      )}

      <Card className="mb-6"><CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { i: Maximize, t: "To'liq ekran", d: "Boshlanganda butun ekranni egallaydi." },
          { i: ShieldCheck, t: "Chiqishda tasdiq", d: "Kompyuterda Esc, telefonda «Chiqish» bosilsa, rostan chiqish-chiqmasligingiz so'raladi." },
          { i: Shuffle, t: "Har safar boshqacha", d: "Savollar va variantlar tartibi har urinishda yangicha." },
          { i: Clock, t: "Taymer", d: "Vaqt tugasa, javoblar avtomatik topshiriladi." },
        ].map((x) => (
          <div key={x.t} className="flex gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"><x.i className="h-5 w-5" aria-hidden /></span><div><p className="text-sm font-bold">{x.t}</p><p className="text-sm text-muted-foreground">{x.d}</p></div></div>
        ))}
      </CardContent></Card>

      <p className="mb-4 rounded-xl bg-amber/10 p-3 text-sm"><b>Trening simulyatsiyasi.</b> Bu imtihonlar rasmiy imtihon spetsifikatsiyasi bilan tasdiqlanmagan, shuning uchun ular rasmiy profil sifatida ko'rsatilmaydi. Haqiqiy imtihondagi natija kafolatlanmaydi.</p>
      {err && <p role="alert" className="mb-4 rounded-xl bg-danger/10 p-3 text-sm text-danger">{err}</p>}

      {anon ? (
        <Card className="max-w-xl"><CardContent className="space-y-3">
          <p className="font-bold">Imtihon topshirish uchun tizimga kiring</p>
          <p className="text-sm text-muted-foreground">Natijalaringiz akkauntingizga saqlanadi.</p>
          <Button asChild><Link href="/kirish">Kirish</Link></Button>
        </CardContent></Card>
      ) : items === null && !err ? (
        <p className="text-sm text-muted-foreground">Yuklanmoqda...</p>
      ) : items && items.length === 0 ? (
        <Card className="max-w-xl"><CardContent><p className="font-bold">Hozircha imtihonlar yo'q</p><p className="text-sm text-muted-foreground">Yangi imtihonlar tez orada qo'shiladi.</p></CardContent></Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {items?.map((it) => {
            const K = KIND[it.kind] ?? KIND.TEST;
            return (
              <Card key={it.slug} className="flex flex-col p-5">
                <div className="flex items-start justify-between gap-3">
                  <span className="grid h-11 w-11 place-items-center rounded-xl bg-primary/10 text-primary"><K.icon className="h-5 w-5" aria-hidden /></span>
                  <Badge variant="blue">{K.label}</Badge>
                </div>
                <p className="mt-3 text-lg font-extrabold leading-snug">{it.title}</p>
                <p className="text-sm text-muted-foreground">{it.subject}{it.directionLabel ? ` · ${it.directionLabel}` : " · Umumiy"}</p>
                <p className="mt-2"><Badge variant={it.ranked ? "teal" : "neutral"}>{it.ranked ? `Reytingga hisoblanadi (${it.maxAttempts} ta urinish)` : "Mashq sinovi: reytingga hisoblanmaydi"}</Badge></p>
                <dl className="mt-4 grid grid-cols-3 gap-2 text-center text-sm">
                  <div className="rounded-xl bg-muted p-2"><dt className="text-xs text-muted-foreground">Savol</dt><dd className="font-extrabold">{it.questionCount}</dd></div>
                  <div className="rounded-xl bg-muted p-2"><dt className="text-xs text-muted-foreground">Vaqt</dt><dd className="font-extrabold">{it.durationMin} daq</dd></div>
                  <div className="rounded-xl bg-muted p-2"><dt className="text-xs text-muted-foreground">Turi</dt><dd className="text-sm font-extrabold">{it.choiceCount && it.writtenCount ? `${it.choiceCount} test + ${it.writtenCount} yozma` : it.writtenCount ? "Yozma" : "Test"}</dd></div>
                </dl>
                {it.last && <p className="mt-3 text-sm text-muted-foreground">Oxirgi natija: <b className="text-foreground">{it.last.score} / {it.last.total}</b> <Link className="font-semibold text-primary hover:underline" href={`/imtihon/${it.last.id}`}>ko'rish</Link></p>}
                <div className="mt-auto pt-4">
                  <Button className="w-full" loading={busy === it.slug} onClick={() => void start(it)}>
                    {it.openAttemptId ? <><RotateCcw className="h-4 w-4" />Davom ettirish</> : <><Play className="h-4 w-4" />Boshlash</>}
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}
