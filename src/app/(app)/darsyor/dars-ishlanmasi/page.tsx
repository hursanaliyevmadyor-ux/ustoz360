"use client";
import * as React from "react";
import { Download, Wand2 } from "lucide-react";
import { modules } from "@/lib/modules";
import { PageHeader } from "@/components/layout/page";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { NoBackendNote } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";

const sections = ["Maqsad va kutiladigan natijalar", "Kerakli jihozlar", "Tashkiliy qism", "O'tgan mavzuni takrorlash", "Yangi mavzu", "Amaliy mashqlar", "Mustahkamlash", "Formativ baholash", "Uy vazifasi", "Refleksiya"];

export default function Page() {
  const [f, setF] = React.useState({ subject: "Matematika", grade: "3", topic: "", dur: "45", goal: "" });
  const [body, setBody] = React.useState<Record<string, string> | null>(null);
  const toast = useToast();
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });
  const [busy, setBusy] = React.useState(false);
  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!f.topic.trim()) { toast("error", "Mavzuni kiriting."); return; }
    setBusy(true);
    try {
      const r = await fetch("/api/ai/lesson", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ subject: f.subject, grade: f.grade, topic: f.topic, duration: f.dur, goal: f.goal }) });
      const d = await r.json();
      if (r.ok) { setBody(d.sections); toast("success", "Ishlanma yaratildi. Matnni tahrirlashingiz mumkin."); }
      else if (r.status === 401) { setBody(Object.fromEntries(sections.map((s) => [s, ""]))); toast("info", "AI uchun tizimga kiring. Hozircha bo'sh shablon berildi."); }
      else toast("error", d.error ?? "Xatolik yuz berdi.");
    } catch { toast("error", "Server bilan aloqa yo'q."); }
    setBusy(false);
  };
  const download = () => {
    const txt = `DARS ISHLANMASI\nFan: ${f.subject}\nSinf: ${f.grade}\nMavzu: ${f.topic}\nDavomiyligi: ${f.dur} daqiqa\nMaqsad: ${f.goal}\n\n` + sections.map((s) => `## ${s}\n${body?.[s] ?? ""}\n`).join("\n");
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([txt], { type: "text/plain;charset=utf-8" }));
    a.download = "dars-ishlanmasi.txt"; a.click(); URL.revokeObjectURL(a.href); toast("success", "Fayl yuklab olindi (.txt).");
  };
  return (
    <>
      <PageHeader module={modules[1]} title="Dars ishlanmasi" description="Parametrlarni tanlang va ishlanma shablonini oling" />
      <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
        <Card><CardHeader><CardTitle>Parametrlar</CardTitle></CardHeader>
          <form onSubmit={create}><CardContent className="space-y-4">
            <Field label="Fan"><Select value={f.subject} onChange={set("subject")}><option>Matematika</option><option>Ona tili</option><option>Tabiiy fanlar</option></Select></Field>
            <Field label="Sinf"><Select value={f.grade} onChange={set("grade")}>{[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((g) => <option key={g}>{g}</option>)}</Select></Field>
            <Field label="Mavzu"><Input value={f.topic} onChange={set("topic")} placeholder="Masalan: Kasrlarni solishtirish" /></Field>
            <Field label="Davomiyligi (daqiqa)"><Input type="number" min={10} max={120} value={f.dur} onChange={set("dur")} /></Field>
            <Field label="Dars maqsadi"><Textarea value={f.goal} onChange={set("goal")} placeholder="O'quvchi ... qila oladi" /></Field>
            <Button className="w-full" type="submit" disabled={busy}><Wand2 className="h-4 w-4" />{busy ? "AI yozmoqda (30-60 soniya)..." : "AI bilan yaratish"}</Button>
            <NoBackendNote>AI matni noto'g'ri bo'lishi mumkin: ishlatishdan oldin tekshiring. Kirmagan bo'lsangiz bo'sh shablon beriladi.</NoBackendNote>
          </CardContent></form></Card>
        <Card><CardHeader><CardTitle>Natija</CardTitle>{body && <Button size="sm" variant="outline" onClick={download}><Download className="h-4 w-4" />Yuklab olish (.txt)</Button>}</CardHeader>
          <CardContent className="space-y-4">
            {!body ? <p className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">Chapdagi formani to'ldirib "Yaratish"ni bosing.</p>
              : <><p className="text-sm text-muted-foreground"><b>{f.subject}</b>, {f.grade}-sinf · {f.topic} · {f.dur} daqiqa</p>
                {sections.map((s) => <Field key={s} label={s}><Textarea value={body[s]} onChange={(e) => setBody({ ...body, [s]: e.target.value })} /></Field>)}</>}
          </CardContent></Card>
      </div>
    </>
  );
}
