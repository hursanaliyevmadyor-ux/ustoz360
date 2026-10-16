"use client";
import * as React from "react";
import Link from "next/link";
import { History, PlayCircle } from "lucide-react";
import { MODES } from "@/components/tests/modes";
import { ChoiceCard } from "@/components/layout/choice-card";
import { SectionHeader } from "@/components/layout/section-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/states";
import { call, fmtClock, KIND_LABEL, sessionHref, type Home } from "@/lib/practice-client";

export default function Page() {
  const [home, setHome] = React.useState<Home | null>(null);
  const [anon, setAnon] = React.useState(false);
  const [offline, setOffline] = React.useState(false);

  React.useEffect(() => {
    void (async () => {
      const r = await call<Home>("/api/practice/home");
      if (r.ok) setHome(r.data); else if (r.status === 401) setAnon(true); else setOffline(true);
    })();
  }, []);

  // Savollar bazasi bo'sh bo'lsa, tugma "tayyor" ko'rinmasligi uchun o'chiriladi va sababi yoziladi.
  const noteFor = (key: string): string | undefined => {
    if (!home) return undefined;
    if (home.approved === 0 && ["practice", "timed", "topic", "mixed", "situational"].includes(key)) return "Tasdiqlangan savollar hali yo'q";
    if (key === "situational" && home.situational === 0) return "Vaziyatli savollar hali yo'q";
    return undefined;
  };
  const badgeFor = (key: string) => {
    if (key === "errors" && home && home.errorsDue > 0) return <Badge variant="amber">{home.errorsDue} ta takrorlash vaqti kelgan</Badge>;
    return undefined;
  };

  return (
    <div className="mx-auto max-w-6xl">
      <SectionHeader title="Qanday mashq qilamiz?" lead="Bilimingizni mustahkamlang va sinovlarga tayyorlaning. Rejimni tanlang." />

      {anon && <p className="mb-4 rounded-xl bg-primary/5 p-3 text-sm">Natijalaringiz saqlanishi uchun avval <Link href="/kirish" className="font-bold text-primary hover:underline">tizimga kiring</Link>.</p>}
      {offline && <p role="alert" className="mb-4 rounded-xl bg-danger/10 p-3 text-sm text-danger">Server bilan aloqa yo'q. Mashqlarni boshlash uchun internet va ma'lumotlar bazasi kerak.</p>}

      {home?.active && (
        <Card className="mb-5 flex flex-wrap items-center gap-3 border-primary/30 bg-primary/5 p-4">
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-primary/10 text-primary"><PlayCircle className="h-5 w-5" aria-hidden /></span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold">Oxirgi mashqni davom ettirish</p>
            <p className="text-sm text-muted-foreground">
              {KIND_LABEL[home.active.kind]}: {home.active.answered} / {home.active.total} savol
              {home.active.remainingSec !== null && <> · qolgan vaqt <b className="text-foreground">{fmtClock(home.active.remainingSec)}</b></>}
            </p>
          </div>
          <Button asChild><Link href={sessionHref(home.active.kind, home.active.id)}>Davom ettirish</Link></Button>
        </Card>
      )}

      {!home && !anon && !offline ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{MODES.map((m) => <Skeleton key={m.key} className="h-[210px]" />)}</div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {MODES.map((m) => <ChoiceCard key={m.key} mode={m} badge={badgeFor(m.key)} disabledNote={noteFor(m.key)} />)}
        </div>
      )}

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <Button asChild variant="outline"><Link href="/ustoz-ai/testlar/tarix"><History className="h-4 w-4" aria-hidden />Mashqlar tarixi</Link></Button>
        {home && home.history[0] && <p className="text-sm text-muted-foreground">Oxirgi natija: <b className="text-foreground">{KIND_LABEL[home.history[0].kind]}, {home.history[0].score} / {home.history[0].total}</b></p>}
      </div>
    </div>
  );
}
