"use client";
import Link from "next/link";
import { CircleDashed, Repeat2, ShieldCheck, Sprout } from "lucide-react";
import { modules } from "@/lib/modules";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/layout/page";
import { LiveGate } from "@/components/layout/live-gate";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/states";
import { DemoMap } from "./demo";

type State = "NEW" | "LEARNING" | "REINFORCING" | "STABLE";
type T = { topicId: string; name: string; subject: string; correct: number; total: number; openErrors: number; state: State; label: string; hint: string };

/** Holat belgisi rang bilan birga ikonka va matn bilan ham beriladi (faqat rangga tayanilmaydi). */
const META: Record<State, { icon: React.ElementType; tone: string; order: number }> = {
  LEARNING: { icon: Sprout, tone: "bg-amber/15 text-warning", order: 0 },
  REINFORCING: { icon: Repeat2, tone: "bg-primary/10 text-primary", order: 1 },
  NEW: { icon: CircleDashed, tone: "bg-muted text-muted-foreground", order: 2 },
  STABLE: { icon: ShieldCheck, tone: "bg-success/10 text-success", order: 3 },
};

function Live({ topics }: { topics: T[] }) {
  const sorted = [...topics].sort((a, b) => META[a.state].order - META[b.state].order || b.openErrors - a.openErrors || a.name.localeCompare(b.name));
  const practiced = topics.filter((t) => t.total > 0).length;
  return (
    <>
      <PageHeader module={modules[0]} title="Bilim xaritasi" description="Mavzular bo'yicha o'rganish holati: natija, savollar soni, qiyinlik va xatolarga qarab"
        actions={<Button asChild variant="outline"><Link href="/toifa/reja?view=kunlik">Natijadan reja tuzish</Link></Button>} />
      {topics.length === 0 ? <EmptyState title="Mavzular hali qo'shilmagan" text="Mavzular admin tomonidan qo'shiladi." action={<Button asChild><Link href="/ustoz-ai/testlar">Testlar</Link></Button>} /> : (
        <>
          <ul className="mb-5 flex flex-wrap gap-2" aria-label="Holatlar izohi">
            {(["NEW", "LEARNING", "REINFORCING", "STABLE"] as State[]).map((s) => {
              const m = META[s], Icon = m.icon, label = topics.find((t) => t.state === s)?.label ?? { NEW: "Hali mashq qilinmagan", LEARNING: "O'rganilmoqda", REINFORCING: "Mustahkamlanmoqda", STABLE: "Barqaror natija kuzatilmoqda" }[s];
              return <li key={s} className={cn("flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold", m.tone)}><Icon className="h-3.5 w-3.5" aria-hidden />{label}</li>;
            })}
          </ul>
          {practiced === 0 && <p className="mb-4 rounded-xl bg-primary/5 p-3 text-sm">Hali birorta mavzu bo'yicha mashq qilinmagan. Mashq qilgan sari xaritangiz to'lib boradi.</p>}
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {sorted.map((t) => {
              const m = META[t.state], Icon = m.icon;
              const pct = t.total ? Math.round((t.correct / t.total) * 100) : null;
              return (
                <Card key={t.topicId} className="flex flex-col p-4">
                  <p className="text-xs font-semibold text-muted-foreground">{t.subject}</p>
                  <p className="mt-0.5 font-extrabold leading-snug">{t.name}</p>
                  <p className={cn("mt-2 inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold", m.tone)}><Icon className="h-3.5 w-3.5" aria-hidden />{t.label}</p>
                  <p className="mt-2 flex-1 text-sm text-muted-foreground">{t.hint}</p>
                  <dl className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    <div><dt className="inline">Savollar: </dt><dd className="inline font-bold text-foreground">{t.total}</dd></div>
                    {pct !== null && <div><dt className="inline">To'g'ri: </dt><dd className="inline font-bold text-foreground">{pct}%</dd></div>}
                    {t.openErrors > 0 && <div><dt className="inline">Ochiq xato: </dt><dd className="inline font-bold text-foreground">{t.openErrors}</dd></div>}
                  </dl>
                  <Button asChild variant="outline" size="sm" className="mt-3 self-start"><Link href={`/ustoz-ai/mashq/sozlash?kind=topic&topic=${t.topicId}`}>Mashq qilish</Link></Button>
                </Card>
              );
            })}
          </div>
          <p className="mt-5 text-xs text-muted-foreground">Holat faqat siz yechgan savollarga tayanadi va taxminiy. Savollar kam, faqat oson savollar yechilgan yoki ochiq xatolar bor mavzu eng yuqori holatga o'tmaydi. Bitta to'g'ri javob mavzuni o'zlashtirish degani emas.</p>
        </>
      )}
    </>
  );
}

export default function Page() {
  return <LiveGate<{ topics: T[] }> url="/api/practice/map" render={(d) => <Live topics={d.topics} />} demo={<DemoMap />} />;
}
