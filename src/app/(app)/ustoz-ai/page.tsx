"use client";
import * as React from "react";
import Link from "next/link";
import { ArrowRight, Compass } from "lucide-react";
import { HUB } from "@/components/tests/modes";
import { ChoiceCard } from "@/components/layout/choice-card";
import { SectionHeader } from "@/components/layout/section-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/states";
import { call, fmtClock, KIND_LABEL, sessionHref, type Home } from "@/lib/practice-client";

/** Keyingi qadam faqat haqiqiy ma'lumotga tayanadi: yangi foydalanuvchiga soxta statistika ko'rsatilmaydi. */
function nextStep(h: Home) {
  if (h.active) return { title: "Tugallanmagan mashqni davom ettiring", text: `${KIND_LABEL[h.active.kind]}: ${h.active.answered} / ${h.active.total} savol${h.active.remainingSec !== null ? `, qolgan vaqt ${fmtClock(h.active.remainingSec)}` : ""}.`, href: sessionHref(h.active.kind, h.active.id), cta: "Davom ettirish" };
  if (h.errorsDue > 0) return { title: `${h.errorsDue} ta xatoni takrorlash vaqti keldi`, text: "Xatolar o'z vaqtida takrorlansa, yaxshiroq eslab qolinadi.", href: "/ustoz-ai/testlar/sozlash?mode=errors", cta: "Xatolar testi" };
  if (h.history.length === 0) return { title: "Diagnostika bilan boshlang", text: "Bilim darajangiz mavzular bo'yicha aniqlanadi, keyingi mashqlar shunga moslab beriladi.", href: "/ustoz-ai/diagnostika", cta: "Diagnostikani boshlash" };
  return { title: "Yangi mashq boshlang", text: "Bilimingizni mustahkamlash uchun rejimni tanlang.", href: "/ustoz-ai/testlar", cta: "Rejimni tanlash" };
}

export default function Page() {
  const [home, setHome] = React.useState<Home | null>(null);
  const [anon, setAnon] = React.useState(false);

  React.useEffect(() => {
    void (async () => {
      const r = await call<Home>("/api/practice/home");
      if (r.ok) setHome(r.data); else if (r.status === 401) setAnon(true);
    })();
  }, []);

  const step = home ? nextStep(home) : null;
  return (
    <div className="mx-auto max-w-6xl">
      <SectionHeader title="USTOZ AI" lead="Bilimingizni aniqlang, mashq qiling, xatolar ustida ishlang va rivojlaning." />

      {anon ? (
        <Card className="mb-5 flex flex-wrap items-center gap-3 border-primary/30 bg-primary/5 p-4">
          <p className="min-w-0 flex-1 text-sm">Natijalaringiz va xatolaringiz akkauntingizga saqlanishi uchun avval tizimga kiring.</p>
          <Button asChild><Link href="/kirish">Kirish</Link></Button>
        </Card>
      ) : !home ? (
        <Skeleton className="mb-5 h-20" />
      ) : step && (
        <Card className="mb-5 flex flex-wrap items-center gap-3 border-primary/30 bg-primary/5 p-4">
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-primary/10 text-primary"><Compass className="h-5 w-5" aria-hidden /></span>
          <div className="min-w-0 flex-1"><p className="text-xs font-bold uppercase tracking-wide text-primary">Keyingi qadam</p><p className="font-bold">{step.title}</p><p className="text-sm text-muted-foreground">{step.text}</p></div>
          <Button asChild><Link href={step.href}>{step.cta}<ArrowRight className="h-4 w-4" aria-hidden /></Link></Button>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {HUB.map((m) => (
          <ChoiceCard key={m.key} mode={m}
            badge={m.key === "results" && home && home.errorsDue > 0 ? <Badge variant="amber">{home.errorsDue} ta takrorlash vaqti kelgan</Badge> : undefined} />
        ))}
      </div>
    </div>
  );
}
