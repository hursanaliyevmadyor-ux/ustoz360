import Link from "next/link";
import { Users, GraduationCap, BookOpen, Wallet } from "lucide-react";
import { adminModule } from "@/lib/modules";
import { adminUsers, adminPayments, fmt } from "@/lib/demo";
import { PageHeader, StatCard } from "@/components/layout/page";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, Th, Td } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { LineChart, BarChart, Donut } from "@/components/charts/charts";

export default function Page() {
  return (
    <>
      <PageHeader module={adminModule} title="Admin dashboard" description="Tizim ko'rsatkichlari (namunaviy ma'lumotlar)" demo />
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatCard label="Foydalanuvchilar" value="1 284" delta="12% o'tgan oyga nisbatan" icon={Users} />
        <StatCard label="Metodistlar" value="14" delta="5%" icon={GraduationCap} tone="violet" />
        <StatCard label="Kurslar" value="24" delta="3%" icon={BookOpen} tone="teal" />
        <StatCard label="Daromad" value={fmt(12845000)} delta="18%" icon={Wallet} tone="amber" />
      </div>
      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <Card><CardHeader><CardTitle>Foydalanuvchilar dinamikasi</CardTitle></CardHeader><CardContent><LineChart data={[420, 560, 710, 880, 1040, 1284]} labels={["Noy", "Dek", "Yan", "Fev", "Mar", "Apr"]} /></CardContent></Card>
        <Card><CardHeader><CardTitle>Daromad va xarajat, mln so'm</CardTitle></CardHeader><CardContent>
          <BarChart data={[[8, 9, 10, 11, 12, 12.8], [4, 4.5, 5, 5.2, 5.5, 6]]} labels={["Noy", "Dek", "Yan", "Fev", "Mar", "Apr"]} series={2} colors={["#2563EB", "#0D9488"]} /></CardContent></Card>
        <Card><CardHeader><CardTitle>Tariflar bo'yicha</CardTitle></CardHeader><CardContent>
          <Donut center="1 284" sub="foydalanuvchi" parts={[{ label: "FREE", value: 820, color: "#9DB8DA" }, { label: "PRO", value: 310, color: "#2563EB" }, { label: "PREMIUM", value: 120, color: "#0D9488" }, { label: "MARKAZ", value: 34, color: "#F59E0B" }]} /></CardContent></Card>
      </div>
      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Card><CardHeader><CardTitle>So'nggi foydalanuvchilar</CardTitle><Link href="/admin/foydalanuvchilar" className="text-sm font-semibold text-primary">Barchasini ko'rish</Link></CardHeader>
          <CardContent className="px-0"><Table><thead><tr><Th>Ism</Th><Th>Tarif</Th><Th>Sana</Th><Th>Holat</Th></tr></thead><tbody>
            {adminUsers.slice(0, 3).map((u) => <tr key={u.id}><Td className="font-semibold">{u.name}</Td><Td>{u.plan}</Td><Td>{u.date}</Td><Td><Badge variant="success">{u.status}</Badge></Td></tr>)}</tbody></Table></CardContent></Card>
        <Card><CardHeader><CardTitle>So'nggi to'lovlar</CardTitle><Link href="/admin/tolovlar" className="text-sm font-semibold text-primary">Barchasini ko'rish</Link></CardHeader>
          <CardContent className="px-0"><Table><thead><tr><Th>Foydalanuvchi</Th><Th>Miqdor</Th><Th>Holat</Th></tr></thead><tbody>
            {adminPayments.slice(0, 3).map((p) => <tr key={p.id}><Td className="font-semibold">{p.user}</Td><Td>{fmt(p.amount)}</Td><Td><Badge variant={p.status === "To'langan" ? "success" : p.status === "Kutilmoqda" ? "amber" : "danger"}>{p.status}</Badge></Td></tr>)}</tbody></Table></CardContent></Card>
      </div>
    </>
  );
}
