"use client";
import * as React from "react";
import { Send } from "lucide-react";
import { documents } from "@/lib/demo";
import { modules } from "@/lib/modules";
import { PageHeader } from "@/components/layout/page";
import { Card } from "@/components/ui/card";
import { Select, Input } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { NoBackendNote, } from "@/components/ui/states";
import { DemoBadge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export default function Page() {
  const [msgs, setMsgs] = React.useState<{ me: boolean; t: string }[]>([]); const [t, setT] = React.useState("");
  const send = (e: React.FormEvent) => { e.preventDefault(); if (!t.trim()) return;
    setMsgs((m) => [...m, { me: true, t }, { me: false, t: "Manbali AI hali ulanmagan, shuning uchun hujjatdan javob topilmadi. Ulangach javob qisqa tushuntirish, tushunchalar, misollar va sahifa havolasi bilan keladi; manba topilmasa shu haqda ogohlantiriladi." }]); setT(""); };
  const tools = ["Konspekt", "Test", "Flashcard", "Savol-javob", "Dars ishlanmasiga aylantirish", "Super kalit"];
  return (
    <>
      <PageHeader module={modules[5]} title="Hujjat bilan suhbat" description="Tanlangan hujjatga tayanib javob beradi" demo />
      <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
        <Card className="space-y-3 p-5 self-start"><label className="block text-sm font-semibold">Hujjat<Select className="mt-1.5">{documents.map((d) => <option key={d.id}>{d.name}</option>)}</Select></label>
          <p className="pt-1 text-sm font-bold">Hujjat asosida yaratish</p>
          <div className="flex flex-wrap gap-2">{tools.map((x) => <button key={x} disabled className="rounded-full border border-border px-3 py-1.5 text-xs font-semibold opacity-60" title="AI ulangach ishlaydi">{x}</button>)}</div></Card>
        <Card className="flex min-h-[420px] flex-col p-5">
          <NoBackendNote>AI va hujjat qidiruvi ulanmagan. Quyida faqat interfeys.</NoBackendNote>
          <div className="mt-4 flex-1 space-y-3" aria-live="polite">
            <div className="max-w-[85%] rounded-2xl bg-muted p-3.5 text-sm"><DemoBadge className="mb-1" /><p>Hujjatni tanlang va savol bering.</p></div>
            {msgs.map((m, i) => <div key={i} className={cn("max-w-[85%] rounded-2xl p-3.5 text-sm", m.me ? "ml-auto bg-primary text-white" : "bg-amber/10")}>{m.t}</div>)}
          </div>
          <form onSubmit={send} className="mt-4 flex gap-2"><Input value={t} onChange={(e) => setT(e.target.value)} placeholder="Savolingizni yozing" aria-label="Savol" /><Button aria-label="Yuborish" size="icon"><Send className="h-4 w-4" /></Button></form>
        </Card>
      </div>
    </>
  );
}
