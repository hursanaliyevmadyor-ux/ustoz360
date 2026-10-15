"use client";
import * as React from "react";
import { user } from "@/lib/demo";
import { PageHeader } from "@/components/layout/page";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { NoBackendNote } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";

export function DemoProfile() {
  const toast = useToast();
  return (
    <>
      <PageHeader title="Profil" description="Shaxsiy ma'lumotlar va tayyorgarlik sozlamalari" demo />
      <Card className="max-w-3xl"><CardHeader><CardTitle>Ma'lumotlar</CardTitle></CardHeader>
        <form onSubmit={(e) => { e.preventDefault(); toast("info", "Saqlanmadi: backend ulanmagan."); }}><CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Ism familiya"><Input defaultValue={user.name} /></Field><Field label="Telefon"><Input placeholder="+998" inputMode="tel" /></Field>
            <Field label="Fan yo'nalishi"><Select><option>Boshlang'ich sinf</option><option>Matematika</option><option>Ona tili</option></Select></Field>
            <Field label="O'qitadigan sinflari"><Input defaultValue="3, 4" /></Field>
            <Field label="Malaka toifasi (ixtiyoriy)"><Input /></Field><Field label="Tayyorlanayotgan imtihon"><Select><option>Attestatsiya</option><option>Milliy sertifikat</option></Select></Field>
            <Field label="Imtihon sanasi"><Input type="date" /></Field><Field label="Kunlik o'qish vaqti"><Select><option>30 daqiqa</option><option>60 daqiqa</option><option>90 daqiqa</option></Select></Field>
          </div>
          <Button type="submit">Saqlash</Button><NoBackendNote />
        </CardContent></form></Card>
    </>
  );
}
