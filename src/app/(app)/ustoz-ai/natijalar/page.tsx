"use client";
import * as React from "react";
import { RESULTS } from "@/components/tests/modes";
import { ChoiceCard } from "@/components/layout/choice-card";
import { SectionHeader } from "@/components/layout/section-header";
import { Badge } from "@/components/ui/badge";
import { call, type Home } from "@/lib/practice-client";

export default function Page() {
  const [home, setHome] = React.useState<Home | null>(null);
  React.useEffect(() => { void call<Home>("/api/practice/home").then((r) => { if (r.ok) setHome(r.data); }); }, []);
  return (
    <div className="mx-auto max-w-6xl">
      <SectionHeader title="Natijalarim" lead="Nimani ko'rmoqchisiz? Ko'rinishni tanlang." />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {RESULTS.map((m) => (
          <ChoiceCard key={m.key} mode={m}
            badge={m.key === "errors" && home ? (home.errorsDue > 0 ? <Badge variant="amber">{home.errorsDue} ta takrorlash vaqti kelgan</Badge> : home.errorsOpen > 0 ? <Badge variant="neutral">{home.errorsOpen} ta ochiq xato</Badge> : undefined) : undefined} />
        ))}
      </div>
    </div>
  );
}
