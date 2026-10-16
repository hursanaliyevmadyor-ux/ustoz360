"use client";
import * as React from "react";
import Link from "next/link";
import { classTopics, classes, students } from "@/lib/demo";
import { modules } from "@/lib/modules";
import { PageHeader } from "@/components/layout/page";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Field, Input } from "@/components/ui/form";
import { Table, Th, Td } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/toast";
import { LineChart } from "@/components/charts/charts";

/** Sinf tahlili va o'quvchilar natijalari bitta bo'limda: mavzular bo'yicha tahlil va har bir o'quvchining natijasi. */
export default function Page() {
  const weak = classTopics.filter((t) => t.v < 55);
  const [open, setOpen] = React.useState(false);
  const toast = useToast();
  return (
    <>
      <PageHeader module={modules[4]} title="Tahlil va natijalar" description="3-A sinf, Matematika. O'quvchilar anonim identifikator bilan yuritiladi." demo />
      <p className="mb-4 rounded-xl bg-amber/10 p-3 text-sm"><b>Namunaviy ma'lumotlar.</b> Haqiqiy sinf natijalari backend ulangandan keyin shu yerda ko'rinadi.</p>
      <Tabs defaultValue="tahlil">
        <TabsList><TabsTrigger value="tahlil">Mavzular tahlili</TabsTrigger><TabsTrigger value="natijalar">O'quvchilar natijalari</TabsTrigger></TabsList>
        <TabsContent value="tahlil">
          <div className="grid gap-6 lg:grid-cols-2">
            <Card><CardHeader><div><CardTitle>Mavzular bo'yicha o'zlashtirish</CardTitle></div></CardHeader><CardContent className="space-y-4">
              {classTopics.map((t) => <div key={t.name}><div className="mb-1 flex justify-between text-sm"><span className="font-semibold">{t.name}</span><b>{t.v}%</b></div>
                <Progress value={t.v} barClass={t.v < 55 ? "bg-danger" : t.v < 75 ? "bg-amber" : "bg-success"} label={t.name} /></div>)}</CardContent></Card>
            <Card><CardHeader><div><CardTitle>O'sish dinamikasi</CardTitle><CardDescription>O'rtacha natija, %</CardDescription></div></CardHeader>
              <CardContent><LineChart data={classes[0].trend} labels={["Sen", "Okt", "Noy", "Dek", "Yan"]} color="#E11D48" /></CardContent></Card>
          </div>
          <Card className="mt-6 p-5"><p className="font-extrabold">Qo'shimcha yordam kerak: {weak.map((w) => w.name).join(", ")}</p>
            <p className="mt-1 text-sm text-muted-foreground">Individual topshiriqlar DARSYOR → Materiallar → Test generatorida tayyorlanadi: o'qituvchi tasdiqlamaguncha o'quvchilarga yuborilmaydi.</p>
            <Button asChild className="mt-3"><Link href="/darsyor/test-generator">Topshiriq tayyorlash</Link></Button></Card>
        </TabsContent>
        <TabsContent value="natijalar">
          <div className="mb-3 flex justify-end"><Button onClick={() => setOpen(true)}>Natija kiritish</Button></div>
          <Card><Table><thead><tr><Th>ID</Th><Th>Taxallus</Th><Th>Natija</Th><Th>Qiyinchilik</Th><Th>Dinamika</Th></tr></thead>
            <tbody>{students.map((s) => <tr key={s.id}><Td>{s.id}</Td><Td className="font-semibold">{s.alias}</Td><Td><b>{s.score}%</b></Td><Td>{s.weak}</Td>
              <Td><Badge variant={s.trend === "yordam kerak" ? "amber" : s.trend === "o'sish" ? "success" : "neutral"}>{s.trend}</Badge></Td></tr>)}</tbody></Table></Card>
          <p className="mt-3 text-xs text-muted-foreground">Natijalar yorlig'i doimiy emas: "yordam kerak" holati vaqtinchalik tavsiya.</p>
        </TabsContent>
      </Tabs>
      <Dialog open={open} onOpenChange={setOpen}><DialogContent title="Natija kiritish" description="Qo'lda kiritish">
        <div className="space-y-3"><Field label="O'quvchi ID"><Input placeholder="S-06" /></Field><Field label="Natija (%)"><Input type="number" min={0} max={100} /></Field>
          <Button onClick={() => { setOpen(false); toast("info", "Saqlanmadi: backend ulanmagan."); }}>Saqlash</Button></div></DialogContent></Dialog>
    </>
  );
}
