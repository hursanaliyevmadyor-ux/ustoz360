import Link from "next/link";
import { ArrowRight, FileText, MessageSquare, Play, BookOpen, Upload, Video } from "lucide-react";
import { modules } from "@/lib/modules";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Jonli dars kartasi: telefonda ham, kompyuterda ham darrov ko'rinadi (bosh sahifa tepasida). */
export function LiveLessonCta() {
  return (
    <Link href="/dars" className="group mb-6 block overflow-hidden rounded-3xl bg-gradient-to-r from-[#0B2D6B] via-primary to-[#00B8D4] p-5 text-white shadow-lg" aria-label="Jonli dars o'tkazish">
      <div className="flex items-center gap-4">
        <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-white/20 ring-1 ring-white/30"><Video className="h-7 w-7" aria-hidden /></span>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-widest text-white/80"><span aria-hidden className="h-2 w-2 animate-pulse rounded-full bg-red-400" />Jonli dars</p>
          <p className="text-xl font-black leading-tight">Onlayn dars o'tkazing</p>
          <p className="text-sm text-white/85">Doska, video, so'rovnoma. O'quvchi ro'yxatdan o'tmasdan havola bilan kiradi.</p>
        </div>
        <span className="hidden shrink-0 items-center gap-1.5 rounded-xl bg-white px-4 py-2.5 text-sm font-extrabold text-primary transition-transform group-hover:translate-x-0.5 sm:inline-flex">Boshlash<ArrowRight className="h-4 w-4" aria-hidden /></span>
      </div>
      <span className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-white px-4 py-2.5 text-sm font-extrabold text-primary sm:hidden">Dars xonasini ochish<ArrowRight className="h-4 w-4" aria-hidden /></span>
    </Link>
  );
}

export function ModulesAndQuick() {
  return (
    <>
      <h2 className="mb-3 mt-8 text-lg font-extrabold">Xizmatlar</h2>
      <section aria-label="Modullar" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {modules.map((m) => (
          <Link key={m.key} href={m.href} className="group">
            <Card className="h-full p-5 transition-shadow group-hover:shadow-pop">
              <div className="flex items-center gap-3">
                <span className={cn("grid h-11 w-11 place-items-center rounded-xl text-white", m.bg)}><m.icon className="h-5 w-5" aria-hidden /></span>
                <div><p className="font-extrabold">{m.name}</p><p className="text-sm text-muted-foreground">{m.short}</p></div>
                <ArrowRight className="ml-auto h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-1" aria-hidden />
              </div>
              <ul className="mt-3 flex flex-wrap gap-1.5">{m.subs.slice(1, 4).map((s) => <li key={s.href} className={cn("rounded-full px-2.5 py-0.5 text-xs font-semibold", m.soft, m.text)}>{s.label}</li>)}</ul>
            </Card>
          </Link>
        ))}
      </section>

      <h2 className="mb-3 mt-8 text-lg font-extrabold">Tezkor tugmalar</h2>
      <div className="flex flex-wrap gap-2">
        <Button asChild><Link href="/dars"><Video className="h-4 w-4" />Jonli dars o'tkazish</Link></Button>
        <Button asChild variant="outline"><Link href="/ustoz-ai/diagnostika"><Play className="h-4 w-4" />Test boshlash</Link></Button>
        <Button asChild variant="outline"><Link href="/bilimxona/suhbat"><MessageSquare className="h-4 w-4" />AI bilan o'rganish</Link></Button>
        <Button asChild variant="outline"><Link href="/darsyor/dars-ishlanmasi"><FileText className="h-4 w-4" />Dars ishlanmasi yaratish</Link></Button>
        <Button asChild variant="outline"><Link href="/bilimxona/yuklash"><Upload className="h-4 w-4" />Kitob yuklash</Link></Button>
        <Button asChild variant="outline"><Link href="/market/mening-kurslarim"><BookOpen className="h-4 w-4" />Kurslarim</Link></Button>
      </div>
    </>
  );
}
