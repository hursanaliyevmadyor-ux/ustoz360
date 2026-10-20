"use client";
import Link from "next/link";
import { ArrowRight, Trophy } from "lucide-react";
import { Avatar } from "@/components/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { MyRank } from "@/lib/ranking-client";

const Stat = ({ k, v, hint }: { k: string; v: React.ReactNode; hint?: string }) => (
  <div className="rounded-xl bg-muted p-3 text-center"><dd className="text-xl font-extrabold tabular-nums">{v}</dd><dt className="text-xs text-muted-foreground">{k}</dt>{hint && <dt className="text-[11px] text-muted-foreground/80">{hint}</dt>}</div>
);

/** «Mening reytingim» kartasi (reyting sahifasida to'liq, dashboardda ixcham). Reytingda bo'lmasa aniq sabab va keyingi qadam ko'rsatiladi. */
export function MyRankCard({ me, name, compact }: { me: MyRank; name: string; compact?: boolean }) {
  const label = me.nickname ?? name;
  return (
    <Card className="p-5">
      <div className="flex items-center gap-3">
        <Avatar src={me.avatar} name={label} size={compact ? 48 : 56} />
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-extrabold leading-tight">Mening reytingim</h2>
          <p className="truncate text-sm text-muted-foreground">{me.nickname ? `@${me.nickname}` : "Nik tanlanmagan"}{me.directionLabel ? ` · ${me.directionLabel}` : ""}</p>
        </div>
        {me.ranked && <Badge variant="teal">Reytingda</Badge>}
      </div>

      {me.ranked && me.overall ? (
        <dl className="mt-4 grid grid-cols-3 gap-2">
          <Stat k="Umumiy o'rin" v={<>{me.overall.rank}<span className="text-sm font-semibold text-muted-foreground"> / {me.overall.total}</span></>} />
          <Stat k={me.directionLabel ? `${me.directionLabel}da` : "Yo'nalishda"} v={me.inDirection ? <>{me.inDirection.rank}<span className="text-sm font-semibold text-muted-foreground"> / {me.inDirection.total}</span></> : "—"} />
          <Stat k="Tayyorgarlik indeksi" v={me.overall.index.toFixed(1)} />
        </dl>
      ) : (
        <div className="mt-4 space-y-2 text-sm">
          {me.comparing ? (
            <p className="rounded-xl bg-amber/10 p-3">Shartlar bajarilgan, natijalaringiz saqlangan. Imtihonlar yetarli ishtirokchi (kamida {me.minParticipants} ta) to&apos;plagandan keyin adolatli taqqoslanadi va o&apos;rningiz hisoblanadi.</p>
          ) : (
            <>
              <p className="font-semibold">Reytingga kirish uchun diagnostika va bitta reyting sinovini yakunlang.</p>
              {me.blockers.length > 0 && <ul className="list-disc space-y-0.5 pl-5 text-muted-foreground">{me.blockers.map((b) => <li key={b}>{b}</li>)}</ul>}
            </>
          )}
        </div>
      )}

      {!compact && (
        <dl className="mt-3 grid grid-cols-2 gap-2">
          <Stat k="Reytingga kirgan sinovlar" v={me.counted.exams} />
          <Stat k="Diagnostikalar" v={me.counted.diagnostics} hint={me.personal.diagnosticPercent !== null ? `o'rtacha ${me.personal.diagnosticPercent}%` : undefined} />
        </dl>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        {me.nextStep && !me.ranked && <Button asChild size="sm"><Link href={me.nextStep.href}>{me.nextStep.text}<ArrowRight className="h-4 w-4" aria-hidden /></Link></Button>}
        {compact && <Button asChild size="sm" variant={me.ranked || !me.nextStep ? "primary" : "outline"}><Link href="/reyting"><Trophy className="h-4 w-4" aria-hidden />To&apos;liq reytingni ko&apos;rish →</Link></Button>}
        {!compact && <Button asChild size="sm" variant="outline"><Link href="/profil#reyting">Profil va maxfiylik</Link></Button>}
      </div>
    </Card>
  );
}
