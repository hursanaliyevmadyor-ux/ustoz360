"use client";
import * as React from "react";
import { adminPayments, fmt } from "@/lib/demo";
import { adminModule } from "@/lib/modules";
import { PageHeader } from "@/components/layout/page";
import { Card } from "@/components/ui/card";
import { Table, Th, Td } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/form";
import { NoBackendNote } from "@/components/ui/states";

export default function Page() {
  const [s, setS] = React.useState("");
  const rows = adminPayments.filter((p) => !s || p.status === s);
  return (
    <>
      <PageHeader module={adminModule} title="To'lovlar" description="To'lov va obuna operatsiyalari" demo />
      <Card><div className="p-4"><Select className="w-56" value={s} onChange={(e) => setS(e.target.value)} aria-label="Holat"><option value="">Barcha holatlar</option><option>To'langan</option><option>Kutilmoqda</option><option>Bekor qilingan</option></Select></div>
        <Table><thead><tr><Th>ID</Th><Th>Foydalanuvchi</Th><Th>Tarif</Th><Th>Miqdor</Th><Th>Sana</Th><Th>Holat</Th></tr></thead><tbody>
          {rows.map((p) => <tr key={p.id}><Td>{p.id}</Td><Td className="font-semibold">{p.user}</Td><Td>{p.plan}</Td><Td>{fmt(p.amount)}</Td><Td>{p.date}</Td>
            <Td><Badge variant={p.status === "To'langan" ? "success" : p.status === "Kutilmoqda" ? "amber" : "danger"}>{p.status}</Badge></Td></tr>)}</tbody></Table></Card>
      <div className="mt-4"><NoBackendNote>Haqiqiy tizimda to'lov holati faqat provayder webhooki serverda tekshirilgandan keyin o'zgaradi.</NoBackendNote></div>
    </>
  );
}
