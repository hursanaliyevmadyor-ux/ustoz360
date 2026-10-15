"use client";
import * as React from "react";
import { modules } from "@/lib/modules";
import { PageHeader } from "@/components/layout/page";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { NoBackendNote } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";

const types = ["Bir javobli", "Ko'p javobli", "Moslashtirish", "Ketma-ketlik", "Ochiq savol", "Vaziyatli savol", "Mantiqiy topshiriq", "Matn asosida savol"];
export default function Page() {
  const toast = useToast();
  const [sel, setSel] = React.useState<string[]>(["Bir javobli"]);
  return (
    <>
      <PageHeader module={modules[1]} title="Test va topshiriq generatori" description="Har bir savolda javob va izoh bo'ladi" />
      <Card className="max-w-3xl"><CardHeader><CardTitle>Parametrlar</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Fan"><Select><option>Matematika</option><option>Ona tili</option></Select></Field>
            <Field label="Sinf"><Select>{[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((g) => <option key={g}>{g}</option>)}</Select></Field>
            <Field label="Mavzu"><Input placeholder="Mavzu nomi" /></Field>
            <Field label="Savollar soni"><Input type="number" defaultValue={10} min={1} max={50} /></Field>
            <Field label="Qiyinlik"><Select><option>Oson</option><option>O'rta</option><option>Murakkab</option></Select></Field>
          </div>
          <fieldset><legend className="mb-2 text-sm font-semibold">Test turlari</legend>
            <div className="flex flex-wrap gap-2">{types.map((t) => (
              <label key={t} className={`cursor-pointer rounded-full border px-3.5 py-1.5 text-sm font-semibold ${sel.includes(t) ? "border-primary bg-primary/10 text-primary" : "border-border"}`}>
                <input type="checkbox" className="sr-only" checked={sel.includes(t)} onChange={() => setSel((s) => s.includes(t) ? s.filter((x) => x !== t) : [...s, t])} />{t}</label>))}</div></fieldset>
          <Button onClick={() => toast("info", "Savollar yaratish AI backend ulangach ishlaydi. Yaratilgan savollar o'qituvchi tasdiqlamaguncha o'quvchilarga yuborilmaydi.")}>Yaratish</Button>
          <NoBackendNote />
        </CardContent></Card>
    </>
  );
}
