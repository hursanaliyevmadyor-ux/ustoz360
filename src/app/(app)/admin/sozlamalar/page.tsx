"use client";
import * as React from "react";
import { adminModule } from "@/lib/modules";
import { PageHeader } from "@/components/layout/page";
import { Card, CardContent } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/form";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { NoBackendNote } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";

export default function Page() {
  const toast = useToast(); const [busy, setBusy] = React.useState(false);
  const save = () => { setBusy(true); setTimeout(() => { setBusy(false); toast("info", "Sozlamalar saqlanmadi: backend ulanmagan."); }, 700); };
  return (
    <>
      <PageHeader module={adminModule} title="Sozlamalar" description="Tizim sozlamalari" demo actions={<Button loading={busy} onClick={save}>Saqlash</Button>} />
      <Card className="max-w-2xl"><CardContent className="space-y-4">
        <Field label="Tizim nomi"><Input defaultValue="USTOZ 360" /></Field>
        <Field label="Til"><Select><option>O'zbekcha (UZ)</option></Select></Field>
        <Field label="AI so'rov limiti (FREE, kuniga)"><Input type="number" defaultValue={5} /></Field>
        {["Bildirishnomalar", "Yangi ro'yxatdan o'tishlar", "Rasmiy ma'lumotlarni ko'rsatish"].map((l) => (
          <label key={l} className="flex items-center justify-between rounded-xl border border-border p-3.5 text-sm font-semibold">{l}<Switch aria-label={l} defaultChecked /></label>))}
        <NoBackendNote />
      </CardContent></Card>
    </>
  );
}
