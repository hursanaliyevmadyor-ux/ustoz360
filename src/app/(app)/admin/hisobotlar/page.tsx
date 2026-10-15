import { Wallet, TrendingUp, Cpu } from "lucide-react";
import { adminModule } from "@/lib/modules";
import { fmt } from "@/lib/demo";
import { PageHeader, StatCard } from "@/components/layout/page";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LineChart } from "@/components/charts/charts";

const bars = [["Pedagogik mahorat testlari", 40], ["Dars generatori", 28], ["BILIMXONA", 18], ["Boshqa", 14]] as const;
export default function Page() {
  return (
    <>
      <PageHeader module={adminModule} title="Hisobotlar" description="Daromad va AI xarajatlari" demo />
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Umumiy daromad" value={fmt(128450000)} delta="18%" icon={Wallet} /><StatCard label="Sof foyda" value={fmt(104150000)} delta="21%" icon={TrendingUp} tone="teal" />
        <StatCard label="AI xarajati (oy)" value={fmt(6200000)} delta="-4%" icon={Cpu} tone="amber" /></div>
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card><CardHeader><CardTitle>Daromad grafigi</CardTitle></CardHeader><CardContent><LineChart data={[30, 42, 55, 61, 78, 96]} labels={["Noy", "Dek", "Yan", "Fev", "Mar", "Apr"]} /></CardContent></Card>
        <Card><CardHeader><CardTitle>AI so'rovlar taqsimoti, %</CardTitle></CardHeader><CardContent className="space-y-3">
          {bars.map(([l, v]) => <div key={l}><div className="mb-1 flex justify-between text-sm"><span>{l}</span><b>{v}%</b></div><div className="h-2.5 rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${v * 2}%` }} /></div></div>)}</CardContent></Card>
      </div>
    </>
  );
}
