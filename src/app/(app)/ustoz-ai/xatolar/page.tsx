"use client";
import * as React from "react";
import Link from "next/link";
import { modules } from "@/lib/modules";
import { PageHeader } from "@/components/layout/page";
import { LiveGate } from "@/components/layout/live-gate";
import { Card } from "@/components/ui/card";
import { Select } from "@/components/ui/form";
import { Table, Th, Td } from "@/components/ui/table";
import { Badge, DemoBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/states";
import { DemoErrors } from "./demo";

type Card = { id: string; text: string; topic: string; isDemo: boolean; mistakes: number; mastered: boolean; nextReviewAt: string; lastMistakeAt: string };
const fmtDate = (s: string) => new Date(s).toLocaleDateString("uz-UZ", { day: "numeric", month: "short" });
const when = (s: string) => { const d = Math.ceil((new Date(s).getTime() - Date.now()) / 86_400_000); return d <= 0 ? "Bugun" : d === 1 ? "Ertaga" : `${d} kundan so'ng`; };

function Explain({ id }: { id: string }) {
  const [t, setT] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const go = async () => {
    setBusy(true);
    try {
      const r = await fetch("/api/ai/explain-error", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ cardId: id }) });
      const d = await r.json(); setT(r.ok ? d.explanation : d.error ?? "Xatolik.");
    } catch { setT("Server bilan aloqa yo'q."); }
    setBusy(false);
  };
  return t ? <p className="max-w-xs whitespace-pre-wrap text-xs">{t}</p> : <Button size="sm" variant="outline" onClick={go} disabled={busy}>{busy ? "Yozmoqda..." : "AI tushuntirish"}</Button>;
}

function Live({ cards }: { cards: Card[] }) {
  const [topic, setTopic] = React.useState("");
  const topics = [...new Set(cards.map((c) => c.topic))];
  const rows = cards.filter((c) => !topic || c.topic === topic);
  const due = cards.filter((c) => !c.mastered && new Date(c.nextReviewAt) <= new Date()).length;
  return (
    <>
      <PageHeader module={modules[0]} title="Xatolar daftari" description={`${cards.length} ta xato, bugun takrorlash kerak: ${due}`} actions={due > 0 ? <Button asChild><Link href="/ustoz-ai/xatolar/takrorlash">Takrorlashni boshlash ({due})</Link></Button> : undefined} />
      {cards.length === 0 ? <EmptyState title="Hali xato yo'q" text="Diagnostika topshiring: xato qilingan savollar shu yerga avtomatik tushadi." action={<Button asChild><Link href="/ustoz-ai/diagnostika">Diagnostikani boshlash</Link></Button>} /> : (
        <Card>
          <div className="flex flex-wrap items-center gap-3 p-4">
            <Select className="max-w-xs" value={topic} onChange={(e) => setTopic(e.target.value)} aria-label="Mavzu bo'yicha filtr"><option value="">Barcha mavzular</option>{topics.map((t) => <option key={t}>{t}</option>)}</Select>
            <span className="text-sm text-muted-foreground">{rows.length} ta</span>
          </div>
          <Table>
            <thead><tr><Th>Savol</Th><Th>Mavzu</Th><Th>Oxirgi xato</Th><Th>Xato soni</Th><Th>Takrorlash</Th><Th>Holat</Th><Th>AI</Th></tr></thead>
            <tbody>{rows.map((c) => {
              const isDue = !c.mastered && new Date(c.nextReviewAt) <= new Date();
              return (
                <tr key={c.id}>
                  <Td className="max-w-xs font-semibold">{c.text} {c.isDemo && <DemoBadge />}</Td><Td>{c.topic}</Td><Td>{fmtDate(c.lastMistakeAt)}</Td><Td>{c.mistakes}</Td>
                  <Td>{c.mastered ? "—" : when(c.nextReviewAt)}</Td>
                  <Td><Badge variant={c.mastered ? "success" : isDue ? "danger" : "amber"}>{c.mastered ? "O'zlashtirildi" : isDue ? "Takrorlash kerak" : "O'zlashtirilmoqda"}</Badge></Td>
                  <Td>{c.isDemo ? "—" : <Explain id={c.id} />}</Td>
                </tr>);
            })}</tbody>
          </Table>
        </Card>)}
    </>
  );
}

export default function Page() {
  return <LiveGate<{ cards: Card[] }> url="/api/errors" render={(d) => <Live cards={d.cards} />} demo={<DemoErrors />} />;
}
