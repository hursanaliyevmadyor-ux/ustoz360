import { Avatar } from "@/components/avatar";
import type { RankEntry } from "@/lib/ranking-client";
import { cn } from "@/lib/utils";

/** Reyting qatori: O'rin | Avatar | Nik | Yo'nalish | Indeks. `featured`: TOP-10 (qolganlardan vizual ajralib turadi). */
export function Row({ e, featured }: { e: RankEntry; featured?: boolean }) {
  return (
    <li className={cn("flex min-w-0 items-center gap-3 rounded-xl px-3 py-2.5", featured ? "border border-border bg-card shadow-soft" : "border-b border-border/60", e.isMe && "bg-primary/5 ring-1 ring-primary/40")}>
      <span className={cn("grid h-8 min-w-8 shrink-0 place-items-center rounded-lg px-1 text-sm font-extrabold tabular-nums", featured ? "bg-navy text-white" : "bg-muted text-muted-foreground")} aria-label={`${e.rank}-o'rin`}>{e.rank}</span>
      <Avatar src={e.avatar} name={e.nickname} size={featured ? 40 : 34} tone="soft" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-bold">{e.nickname}{e.isMe && <span className="ml-1.5 text-xs font-semibold text-primary">(siz)</span>}</span>
        <span className="block truncate text-xs text-muted-foreground sm:hidden">{e.directionLabel ?? "Yo'nalish belgilanmagan"}</span>
      </span>
      <span className="hidden w-40 shrink-0 truncate text-sm text-muted-foreground sm:block">{e.directionLabel ?? "—"}</span>
      <span className="w-16 shrink-0 text-right text-base font-extrabold tabular-nums">{e.index.toFixed(1)}</span>
    </li>
  );
}
