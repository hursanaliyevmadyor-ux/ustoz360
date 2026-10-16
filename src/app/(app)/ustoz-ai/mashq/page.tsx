"use client";
import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PRACTICE } from "@/components/tests/modes";
import { ChoiceCard } from "@/components/layout/choice-card";
import { SectionHeader } from "@/components/layout/section-header";
import { Button } from "@/components/ui/button";
import { call, sessionHref, type Home } from "@/lib/practice-client";

/** Oddiy mashq: keyingi rejimni tanlash. Xatolar, vaqtli va boshqa rejimlar Testlar bo'limida takrorlanmaydi. */
export default function Page() {
  const router = useRouter();
  const [aiOn, setAiOn] = React.useState<boolean | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [notice, setNotice] = React.useState<{ text: string; anon: boolean } | null>(null);

  React.useEffect(() => { void call<Home>("/api/practice/home").then((r) => { if (r.ok) setAiOn(r.data.aiAvailable); }); }, []);

  const quick = async () => {
    if (busy) return;
    setBusy(true); setNotice(null);
    const r = await call<{ id: string }>("/api/practice/start", "POST", { kind: "quick", count: 5 });
    if (r.ok) { router.push(sessionHref("quick", r.data.id)); return; }
    setBusy(false); setNotice({ text: r.error, anon: r.status === 401 });
  };

  return (
    <div className="mx-auto max-w-6xl">
      <SectionHeader title="Oddiy mashq" lead="Vaqtsiz mashq: har javobdan keyin izoh ochiladi. Qanday davom etamiz?" back={{ href: "/ustoz-ai/testlar", label: "Testlar" }} />
      {notice && (
        <p role="alert" className="mb-4 rounded-xl bg-danger/10 p-3 text-sm text-danger">
          {notice.text} {notice.anon && <Button asChild size="sm" className="ml-2"><Link href="/kirish">Kirish</Link></Button>}
        </p>
      )}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {PRACTICE.map((m) => (
          <ChoiceCard key={m.key} mode={m} onClick={m.key === "quick" ? () => void quick() : undefined} loading={m.key === "quick" && busy}
            disabledNote={m.key === "ai" && aiOn === false ? "AI hozircha ulanmagan: mashq izohlar bilan ishlaydi" : undefined} />
        ))}
      </div>
    </div>
  );
}
