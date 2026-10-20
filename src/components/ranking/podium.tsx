import { Crown, Medal } from "lucide-react";
import { Avatar } from "@/components/avatar";
import { MEDAL, type RankEntry } from "@/lib/ranking-client";
import { cn } from "@/lib/utils";

/** TOP-3: kompyuterda 2 | 1 | 3 tartibida (1-o'rin markazda, kattaroq va balandroq); telefonda ixcham ro'yxat. Medal ranglari: oltin, kumush, bronza. */
function Card({ e, place }: { e: RankEntry; place: 1 | 2 | 3 }) {
  const m = MEDAL[place], big = place === 1;
  return (
    <li className={cn("relative flex items-center gap-3 rounded-2xl border bg-card p-3.5 sm:flex-col sm:gap-2 sm:text-center", big ? "sm:px-5 sm:pb-7 sm:pt-6 sm:shadow-pop" : "sm:p-5", e.isMe && "ring-2 ring-primary")} style={{ borderColor: m.color }}
      aria-label={`${m.label}: ${e.nickname}, indeks ${e.index}`}>
      <span className="relative shrink-0">
        <Avatar src={e.avatar} name={e.nickname} size={big ? 88 : 64} tone="soft" className="ring-4" />
        <span className="absolute -right-1 -top-2 grid h-7 w-7 place-items-center rounded-full text-white shadow-soft sm:-top-3 sm:left-1/2 sm:right-auto sm:-translate-x-1/2" style={{ background: m.color }} aria-hidden>
          {place === 1 ? <Crown className="h-4 w-4" /> : <Medal className="h-4 w-4" />}
        </span>
      </span>
      <span className="min-w-0 flex-1 sm:flex-none">
        <span className="block text-xs font-bold uppercase tracking-wide" style={{ color: m.color }}>{m.label}</span>
        <span className={cn("block truncate font-extrabold", big ? "text-xl" : "text-lg")}>{e.nickname}</span>
        {e.directionLabel && <span className="block truncate text-xs text-muted-foreground">{e.directionLabel}</span>}
      </span>
      <span className="shrink-0 text-right sm:text-center">
        <span className={cn("block font-extrabold tabular-nums", big ? "text-3xl" : "text-2xl")}>{e.index.toFixed(1)}</span>
        <span className="block text-[11px] font-semibold text-muted-foreground">indeks</span>
      </span>
    </li>
  );
}

export function Podium({ podium }: { podium: RankEntry[] }) {
  if (!podium.length) return null;
  const [a, b, c] = podium;
  // Teng ballar: o'rin raqami e.rank bo'yicha medal beriladi (1,1,3 bo'lsa ikkalasi oltin)
  const place = (e: RankEntry) => (Math.min(3, e.rank) as 1 | 2 | 3);
  return (
    <ol aria-label="TOP-3" className="grid gap-3 sm:grid-cols-3 sm:items-end">
      {b && <div className="sm:order-1 [&>li]:h-full"><Card e={b} place={place(b)} /></div>}
      {a && <div className="sm:order-2 [&>li]:h-full"><Card e={a} place={place(a)} /></div>}
      {c && <div className="sm:order-3 [&>li]:h-full"><Card e={c} place={place(c)} /></div>}
    </ol>
  );
}
