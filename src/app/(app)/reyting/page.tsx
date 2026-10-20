"use client";
import * as React from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Search, Trophy } from "lucide-react";
import { useQuery } from "@/lib/use-query";
import type { Board, DirectionTab, MyRank } from "@/lib/ranking-client";
import { QueryView } from "@/components/layout/query-view";
import { useShell } from "@/components/layout/shell-context";
import { MyRankCard } from "@/components/ranking/my-rank";
import { Podium } from "@/components/ranking/podium";
import { Row } from "@/components/ranking/rows";
import { Button } from "@/components/ui/button";
import { EmptyState, Skeleton } from "@/components/ui/states";
import { cn } from "@/lib/utils";

function Board({ b, q, setQ, setPage }: { b: Extract<Board, { enabled: true }>; q: string; setQ: (v: string) => void; setPage: (p: number) => void }) {
  if (b.calibrating) {
    return (
      <EmptyState icon={Trophy} title="Reyting shakllanmoqda"
        text={`Adolatli taqqoslash uchun har bir reyting sinovini kamida ${b.minParticipants} ta ustoz topshirishi kerak. Natijangiz saqlanadi va shartlar bajarilishi bilan o'rningiz hisoblanadi.`}
        action={<Button asChild><Link href="/imtihon">Imtihon simulyatoriga o&apos;tish</Link></Button>} />
    );
  }
  if (b.total === 0) return <EmptyState icon={Trophy} title="Bu yo'nalishda hali ishtirokchi yo'q" text="Birinchi bo'lib reytingga kiring: nik tanlang, rozilik bering, diagnostika va reyting sinovini yakunlang." action={<Button asChild><Link href="/profil#reyting">Profilni sozlash</Link></Button>} />;
  return (
    <div className="space-y-6">
      <Podium podium={b.podium} />

      {b.top.length > 0 && (
        <section aria-label="TOP 4–10" className="space-y-2">
          <h2 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">TOP-10</h2>
          <ul className="space-y-2">{b.top.map((e) => <Row key={`${e.rank}-${e.nickname}`} e={e} featured />)}</ul>
        </section>
      )}

      {(b.total > 10 || q) && (
        <section aria-label="Barcha ustozlar" className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">{q ? "Qidiruv natijasi" : "11-o'rindan keyin"}</h2>
            <label className="relative block w-full sm:w-64">
              <span className="sr-only">Nik bo&apos;yicha qidirish</span>
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <input value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} maxLength={30} placeholder="Nik bo'yicha qidirish"
                className="h-10 w-full rounded-xl border border-border bg-card pl-9 pr-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40" />
            </label>
          </div>
          {b.list.items.length === 0 ? <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">{q ? "Bu nik bo'yicha hech kim topilmadi." : "Boshqa ishtirokchi yo'q."}</p> : (
            <ul>{b.list.items.map((e) => <Row key={`${e.rank}-${e.nickname}`} e={e} />)}</ul>
          )}
          {b.list.pages > 1 && (
            <nav aria-label="Sahifalar" className="flex items-center justify-center gap-3">
              <Button variant="outline" size="sm" disabled={b.list.page <= 1} onClick={() => setPage(b.list.page - 1)}><ChevronLeft className="h-4 w-4" aria-hidden />Oldingi</Button>
              <span className="text-sm text-muted-foreground">{b.list.page} / {b.list.pages}</span>
              <Button variant="outline" size="sm" disabled={b.list.page >= b.list.pages} onClick={() => setPage(b.list.page + 1)}>Keyingi<ChevronRight className="h-4 w-4" aria-hidden /></Button>
            </nav>
          )}
        </section>
      )}
    </div>
  );
}

export default function Page() {
  const { me } = useShell();
  const tabs = useQuery<{ enabled: boolean; directions: DirectionTab[] }>("/api/leaderboard/directions");
  const [dir, setDir] = React.useState("ALL");
  const [q, setQ] = React.useState("");
  const [dq, setDq] = React.useState("");
  const [page, setPage] = React.useState(1);
  React.useEffect(() => { const t = setTimeout(() => setDq(q.trim()), 300); return () => clearTimeout(t); }, [q]);
  const board = useQuery<Board>(`/api/leaderboard?direction=${encodeURIComponent(dir)}&page=${page}${dq ? `&q=${encodeURIComponent(dq)}` : ""}`);
  const my = useQuery<MyRank>("/api/leaderboard/me");
  const list = tabs.data?.directions ?? [{ key: "ALL", label: "Umumiy", count: 0 }];
  const pick = (k: string) => { setDir(k); setPage(1); setQ(""); setDq(""); };

  return (
    <div className="mx-auto max-w-5xl">
      <header className="mb-6 rounded-3xl bg-navy p-6 text-white sm:p-8">
        <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">Bilimingiz bilan yuqorilang!</h1>
        <p className="mt-1.5 text-white/75">Ustozlarning tayyorgarlik natijalari asosidagi reyting.</p>
        <div role="tablist" aria-label="Reyting yo'nalishlari" className="mt-5 flex gap-2 overflow-x-auto pb-1">
          {list.map((t) => (
            <button key={t.key} role="tab" aria-selected={dir === t.key} onClick={() => pick(t.key)}
              className={cn("shrink-0 whitespace-nowrap rounded-full border px-4 py-2 text-sm font-semibold transition-colors", dir === t.key ? "border-white bg-white text-navy" : "border-white/30 text-white hover:bg-white/10")}>
              {t.label}
            </button>
          ))}
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
        <div className="min-w-0 lg:order-1">
          <QueryView q={board} skeleton={<div className="space-y-3" aria-busy="true"><Skeleton className="h-44" /><Skeleton className="h-14" /><Skeleton className="h-14" /></div>}>
            {(b) => b.enabled ? <Board b={b} q={q} setQ={setQ} setPage={setPage} /> : <EmptyState icon={Trophy} title="Reyting hozircha o'chirilgan" text="Administrator reytingni yoqqanda shu yerda ko'rinadi." />}
          </QueryView>
        </div>
        <aside className="lg:order-2 lg:sticky lg:top-24" aria-label="Mening reytingim">
          {my.loading && !my.data ? <Skeleton className="h-64" /> : my.data ? <MyRankCard me={my.data} name={me?.name ?? me?.email ?? "Foydalanuvchi"} /> : null}
        </aside>
      </div>
    </div>
  );
}
