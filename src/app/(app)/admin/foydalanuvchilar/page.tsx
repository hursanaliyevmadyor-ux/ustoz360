"use client";
import * as React from "react";
import { Search, UserPlus } from "lucide-react";
import { adminUsers } from "@/lib/demo";
import { adminModule } from "@/lib/modules";
import { PageHeader } from "@/components/layout/page";
import { Card } from "@/components/ui/card";
import { Input, Select, Field } from "@/components/ui/form";
import { Table, Th, Td } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";

export default function Page() {
  const [q, setQ] = React.useState(""); const [plan, setPlan] = React.useState(""); const [open, setOpen] = React.useState(false); const toast = useToast();
  const rows = adminUsers.filter((u) => u.name.toLowerCase().includes(q.toLowerCase()) && (!plan || u.plan === plan));
  return (
    <>
      <PageHeader module={adminModule} title="Foydalanuvchilar" description="Barcha foydalanuvchilar ro'yxati" demo actions={<Button onClick={() => setOpen(true)}><UserPlus className="h-4 w-4" />Foydalanuvchi qo'shish</Button>} />
      <Card>
        <div className="flex flex-wrap gap-3 p-4">
          <div className="relative min-w-[200px] flex-1"><Search className="absolute left-3.5 top-3.5 h-4 w-4 text-muted-foreground" aria-hidden /><Input className="pl-10" placeholder="Ism bo'yicha qidirish" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Qidirish" /></div>
          <Select className="w-44" value={plan} onChange={(e) => setPlan(e.target.value)} aria-label="Tarif"><option value="">Barcha tariflar</option><option>FREE</option><option>PRO</option><option>PREMIUM</option></Select>
        </div>
        {rows.length ? <Table><thead><tr><Th>Ism familiya</Th><Th>Telefon</Th><Th>Rol</Th><Th>Tarif</Th><Th>Sana</Th><Th>Holat</Th></tr></thead><tbody>
          {rows.map((u) => <tr key={u.id}><Td className="font-semibold">{u.name}</Td><Td>{u.phone}</Td><Td>{u.role}</Td><Td><Badge variant={u.plan === "FREE" ? "neutral" : "blue"}>{u.plan}</Badge></Td><Td>{u.date}</Td>
            <Td><Badge variant={u.status === "Faol" ? "success" : "danger"}>{u.status}</Badge></Td></tr>)}</tbody></Table>
          : <div className="p-4 pt-0"><EmptyState title="Foydalanuvchi topilmadi" text="Qidiruv shartlarini o'zgartiring." /></div>}
      </Card>
      <Dialog open={open} onOpenChange={setOpen}><DialogContent title="Foydalanuvchi qo'shish">
        <div className="space-y-3"><Field label="Ism familiya"><Input /></Field><Field label="Telefon"><Input placeholder="+998" /></Field>
          <Field label="Rol"><Select><option>O'qituvchi</option><option>Kurs muallifi</option><option>Metodist</option><option>Administrator</option></Select></Field>
          <Button onClick={() => { setOpen(false); toast("info", "Saqlanmadi: backend va autentifikatsiya ulanmagan."); }}>Qo'shish</Button></div></DialogContent></Dialog>
    </>
  );
}
