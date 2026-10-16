"use client";
import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Clock, FileQuestion, Maximize, PenLine, Play, RotateCcw, Shuffle, ShieldCheck } from "lucide-react";
import { modules } from "@/lib/modules";
import { PageHeader } from "@/components/layout/page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

type Item = { slug: string; title: string; subject: string; kind: string; durationMin: number; questionCount: number; choiceCount: number; writtenCount: number; openAttemptId: string | null; last: { id: string; score: number | null; total: number | null; at: string | null } | null };
const KIND: Record<string, { label: string; icon: React.ElementType }> = {
  TEST: { label: "Test (variantli)", icon: FileQuestion }, WRITTEN: { label: "Yozma javobli", icon: PenLine }, MIXED: { label: "Aralash", icon: Shuffle },
};

export default function Page() {
  const router = useRouter();
  const [items, setItems] = React.useState<Item[] | null>(null);
  const [anon, setAnon] = React.useState(false);
  const [busy, setBusy] = React.useState<string | null>(null);
  const [err, setErr] = React.useState("");

  React.useEffect(() => {
    fetch("/api/exam").then(async (r) => {
      if (r.status === 401) { setAnon(true); return; }
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setErr(d.error ?? "Imtihonlarni yuklab bo'lmadi."); return; }
      setItems(d.exams);
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
      <PageHeader module={modules[0]} title="Imtihon simulyatori" description="Haqiqiy imtihondagidek: to'liq ekran, taymer va har safar aralash savollar" />

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
                <p className="text-sm text-muted-foreground">{it.subject}</p>
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
