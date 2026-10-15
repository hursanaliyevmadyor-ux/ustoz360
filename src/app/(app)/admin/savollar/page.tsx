"use client";
import * as React from "react";
import { adminQuestions } from "@/lib/demo";
import { adminModule } from "@/lib/modules";
import { PageHeader } from "@/components/layout/page";
import { Card } from "@/components/ui/card";
import { Table, Th, Td } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { NoBackendNote } from "@/components/ui/states";

const st = ["Hammasi", "Draft", "Review", "Approved", "Rejected", "Archived"];
const tone = { Draft: "neutral", Review: "amber", Approved: "success", Rejected: "danger", Archived: "neutral" } as const;
export default function Page() {
  const [f, setF] = React.useState("Hammasi");
  const rows = adminQuestions.filter((q) => f === "Hammasi" || q.status === f);
  return (
    <>
      <PageHeader module={adminModule} title="Savollar banki" description="Faqat Approved savollar rasmiy diagnostikaga kiradi" demo />
      <Tabs value={f} onValueChange={setF}><TabsList>{st.map((s) => <TabsTrigger key={s} value={s}>{s}</TabsTrigger>)}</TabsList></Tabs>
      <Card className="mt-4">{rows.length === 0 ? <p className="p-8 text-center text-sm text-muted-foreground">Bu holatda savol yo'q.</p> :
        <Table><thead><tr><Th>ID</Th><Th>Savol</Th><Th>Mavzu</Th><Th>Holat</Th></tr></thead><tbody>
          {rows.map((q) => <tr key={q.id}><Td>{q.id}</Td><Td className="font-semibold">{q.q}</Td><Td>{q.topic}</Td><Td><Badge variant={tone[q.status as keyof typeof tone]}>{q.status}</Badge></Td></tr>)}</tbody></Table>}</Card>
      <div className="mt-4"><NoBackendNote>Holatlarni o'zgartirish (Draft → Review → Approved) va metodist tekshiruvi backend bilan ishlaydi.</NoBackendNote></div>
    </>
  );
}
