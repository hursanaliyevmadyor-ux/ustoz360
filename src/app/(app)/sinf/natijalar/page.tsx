"use client";
import * as React from "react";
import { students } from "@/lib/demo";
import { modules } from "@/lib/modules";
import { PageHeader } from "@/components/layout/page";
import { Card } from "@/components/ui/card";
import { Table, Th, Td } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Field, Input } from "@/components/ui/form";
import { useToast } from "@/components/ui/toast";

export default function Page() {
  const [open, setOpen] = React.useState(false); const toast = useToast();
  return (
    <>
      <PageHeader module={modules[4]} title="Natijalar" description="3-A sinf, Matematika. Anonim identifikatorlar." demo actions={<Button onClick={() => setOpen(true)}>Natija kiritish</Button>} />
      <Card><Table><thead><tr><Th>ID</Th><Th>Taxallus</Th><Th>Natija</Th><Th>Qiyinchilik</Th><Th>Dinamika</Th></tr></thead>
        <tbody>{students.map((s) => <tr key={s.id}><Td>{s.id}</Td><Td className="font-semibold">{s.alias}</Td><Td><b>{s.score}%</b></Td><Td>{s.weak}</Td>
          <Td><Badge variant={s.trend === "yordam kerak" ? "amber" : s.trend === "o'sish" ? "success" : "neutral"}>{s.trend}</Badge></Td></tr>)}</tbody></Table></Card>
      <p className="mt-3 text-xs text-muted-foreground">Natijalar yorlig'i doimiy emas: "yordam kerak" holati vaqtinchalik tavsiya.</p>
      <Dialog open={open} onOpenChange={setOpen}><DialogContent title="Natija kiritish" description="Qo'lda kiritish">
        <div className="space-y-3"><Field label="O'quvchi ID"><Input placeholder="S-06" /></Field><Field label="Natija (%)"><Input type="number" min={0} max={100} /></Field>
          <Button onClick={() => { setOpen(false); toast("info", "Saqlanmadi: backend ulanmagan."); }}>Saqlash</Button></div></DialogContent></Dialog>
    </>
  );
}
