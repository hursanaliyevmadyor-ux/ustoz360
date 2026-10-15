"use client";
import { DollarSign, Users, BookCopy, Percent } from "lucide-react";
import { modules } from "@/lib/modules";
import { PageHeader, StatCard } from "@/components/layout/page";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { NoBackendNote } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";

export default function Page() {
  const toast = useToast();
  return (
    <>
      <PageHeader module={modules[3]} title="Muallif kabineti" description="Kurs yarating va sotuvlarni kuzating" demo />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Sotuvlar" value="—" icon={DollarSign} tone="violet" /><StatCard label="O'quvchilar" value="—" icon={Users} tone="blue" />
        <StatCard label="Kurslar" value="0" icon={BookCopy} tone="teal" /><StatCard label="Komissiya" value="10–20%" icon={Percent} tone="amber" />
      </div>
      <Card className="mt-6 max-w-3xl"><CardHeader><CardTitle>Yangi mahsulot</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nomi"><Input placeholder="Kurs nomi" /></Field>
            <Field label="Turi"><Select><option>Videokurs</option><option>Test to'plami</option><option>Dars ishlanmasi</option><option>Elektron kitob</option><option>Mentorlik</option></Select></Field>
            <Field label="Narx (so'm)"><Input type="number" min={0} /></Field>
          </div>
          <Field label="Tavsif"><Textarea /></Field>
          <Button onClick={() => toast("info", "Mahsulot saqlanmaydi: backend ulanmagan. Haqiqiy tizimda u administrator tekshiruvidan o'tadi.")}>Tekshiruvga yuborish</Button>
          <NoBackendNote>Komissiya foizi sinov sifatida 10–20%, yakuniy qiymat kelishuvdan keyin belgilanadi.</NoBackendNote>
        </CardContent></Card>
    </>
  );
}
