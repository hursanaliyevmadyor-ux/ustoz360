"use client";
import * as React from "react";
import { modules } from "@/lib/modules";
import { PageHeader } from "@/components/layout/page";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, Th, Td } from "@/components/ui/table";
import { Input } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";

const levels = ["Boshlang'ich", "O'rta", "Yuqori"];
export default function Page() {
  const [rows, setRows] = React.useState(["Mavzuni tushunish", "Amaliy qo'llash", "Fikrni bayon etish"].map((c) => ({ c, v: ["", "", ""] })));
  const download = () => {
    const csv = ["Mezon," + levels.join(",")].concat(rows.map((r) => [r.c, ...r.v].map((x) => `"${x.replace(/"/g, '""')}"`).join(","))).join("\n");
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" })); a.download = "rubrika.csv"; a.click(); URL.revokeObjectURL(a.href);
  };
  return (
    <>
      <PageHeader module={modules[1]} title="Baholash materiallari" description="Rubrika, mezonlar va kuzatuv varaqalari" />
      <Tabs defaultValue="rubrika">
        <TabsList><TabsTrigger value="rubrika">Rubrika</TabsTrigger><TabsTrigger value="kuzatuv">Kuzatuv varaqasi</TabsTrigger><TabsTrigger value="fikr">Fikr-mulohaza</TabsTrigger></TabsList>
        <TabsContent value="rubrika"><Card><CardHeader><CardTitle>Rubrika muharriri</CardTitle><Button size="sm" variant="outline" onClick={download}><Download className="h-4 w-4" />CSV</Button></CardHeader>
          <CardContent className="px-0">
            <Table><thead><tr><Th>Mezon</Th>{levels.map((l) => <Th key={l}>{l}</Th>)}</tr></thead>
              <tbody>{rows.map((r, i) => <tr key={i}><Td className="font-semibold"><Input value={r.c} onChange={(e) => setRows(rows.map((x, k) => k === i ? { ...x, c: e.target.value } : x))} aria-label="Mezon" /></Td>
                {r.v.map((v, j) => <Td key={j}><Input value={v} placeholder="Tavsif" aria-label={`${r.c}: ${levels[j]}`} onChange={(e) => setRows(rows.map((x, k) => k === i ? { ...x, v: x.v.map((y, l) => l === j ? e.target.value : y) } : x))} /></Td>)}</tr>)}</tbody></Table>
            <div className="px-5 pt-4"><Button variant="outline" size="sm" onClick={() => setRows([...rows, { c: "Yangi mezon", v: ["", "", ""] }])}>Mezon qo'shish</Button></div>
          </CardContent></Card></TabsContent>
        <TabsContent value="kuzatuv"><Card className="p-6 text-sm text-muted-foreground">Kuzatuv varaqasi shabloni keyingi bosqichda qo'shiladi.</Card></TabsContent>
        <TabsContent value="fikr"><Card className="p-6 text-sm text-muted-foreground">Formativ fikr-mulohaza namunalari AI ulangach yaratiladi.</Card></TabsContent>
      </Tabs>
    </>
  );
}
