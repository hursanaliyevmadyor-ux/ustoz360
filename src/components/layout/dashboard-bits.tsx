import Link from "next/link";
import { ArrowRight, FileText, MessageSquare, Play, BookOpen, Upload } from "lucide-react";
import { modules } from "@/lib/modules";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

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
        <Button asChild variant="outline"><Link href="/ustoz-ai/diagnostika"><Play className="h-4 w-4" />Test boshlash</Link></Button>
        <Button asChild variant="outline"><Link href="/bilimxona/suhbat"><MessageSquare className="h-4 w-4" />AI bilan o'rganish</Link></Button>
        <Button asChild variant="outline"><Link href="/darsyor/dars-ishlanmasi"><FileText className="h-4 w-4" />Dars ishlanmasi yaratish</Link></Button>
        <Button asChild variant="outline"><Link href="/bilimxona/yuklash"><Upload className="h-4 w-4" />Kitob yuklash</Link></Button>
        <Button asChild variant="outline"><Link href="/market/mening-kurslarim"><BookOpen className="h-4 w-4" />Kurslarim</Link></Button>
      </div>
    </>
  );
}
