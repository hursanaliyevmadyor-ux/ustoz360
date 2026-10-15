"use client";
import * as React from "react";
import { PageHeader } from "@/components/layout/page";
import { LiveGate } from "@/components/layout/live-gate";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { DemoProfile } from "./demo";

type P = { name: string; email: string; subjectFocus: string; grades: string; experience: number | null; category: string; targetExam: string | null; examDate: string | null; dailyMinutes: number | null };

function Form({ initial }: { initial: P }) {
  const toast = useToast();
  const [f, setF] = React.useState(initial); const [busy, setBusy] = React.useState(false); const [err, setErr] = React.useState("");
  const set = <K extends keyof P>(k: K, v: P[K]) => setF((s) => ({ ...s, [k]: v }));
  const num = (v: string) => (v === "" ? null : Number(v));
  const save = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setErr("");
    const r = await fetch("/api/profile", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({
      name: f.name, subjectFocus: f.subjectFocus, grades: f.grades, experience: f.experience, category: f.category, targetExam: f.targetExam, examDate: f.examDate, dailyMinutes: f.dailyMinutes }) });
    setBusy(false);
    if (!r.ok) { setErr("Ma'lumotlar noto'g'ri. Qiymatlarni tekshiring (kunlik vaqt 10–480 daqiqa)."); toast("error", "Saqlab bo'lmadi."); return; }
    setF(await r.json()); toast("success", "Profil saqlandi.");
  };
  return (
    <>
      <PageHeader title="Profil" description="Shaxsiy ma'lumotlar va tayyorgarlik sozlamalari" />
      <Card className="max-w-3xl"><CardHeader><CardTitle>Ma'lumotlar</CardTitle></CardHeader>
        <form onSubmit={save}><CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Ism familiya"><Input value={f.name} onChange={(e) => set("name", e.target.value)} maxLength={80} /></Field>
            <Field label="Email" hint="O'zgartirib bo'lmaydi"><Input value={f.email} disabled /></Field>
            <Field label="Fan yo'nalishi"><Input value={f.subjectFocus} onChange={(e) => set("subjectFocus", e.target.value)} placeholder="Masalan: Matematika" /></Field>
            <Field label="O'qitadigan sinflari"><Input value={f.grades} onChange={(e) => set("grades", e.target.value)} placeholder="3, 4" /></Field>
            <Field label="Ish tajribasi (yil, ixtiyoriy)"><Input type="number" min={0} max={70} value={f.experience ?? ""} onChange={(e) => set("experience", num(e.target.value))} /></Field>
            <Field label="Malaka toifasi (ixtiyoriy)"><Input value={f.category} onChange={(e) => set("category", e.target.value)} /></Field>
            <Field label="Tayyorlanayotgan imtihon"><Select value={f.targetExam ?? ""} onChange={(e) => set("targetExam", e.target.value || null)}><option value="">Tanlanmagan</option><option value="ATTESTATSIYA">Attestatsiya</option><option value="MILLIY_SERTIFIKAT">Milliy sertifikat</option></Select></Field>
            <Field label="Imtihon sanasi (ma'lum bo'lsa)"><Input type="date" value={f.examDate ?? ""} onChange={(e) => set("examDate", e.target.value || null)} /></Field>
            <Field label="Kunlik o'qish vaqti (daqiqa)" error={err}><Input type="number" min={10} max={480} value={f.dailyMinutes ?? ""} onChange={(e) => set("dailyMinutes", num(e.target.value))} /></Field>
          </div>
          <Button type="submit" loading={busy}>Saqlash</Button>
        </CardContent></form></Card>
    </>
  );
}

export default function Page() {
  return <LiveGate<P> url="/api/profile" render={(d) => <Form initial={d} />} demo={<DemoProfile />} />;
}
