"use client";
import Link from "next/link";
import { Users, GraduationCap, BookOpen, Wallet, ClipboardList, Layers, CalendarDays, FlaskConical, Brain, Library } from "lucide-react";
import { adminModule } from "@/lib/modules";
import { fmtUzs } from "@/lib/plans";
import { useQuery } from "@/lib/use-query";
import { QueryView } from "@/components/layout/query-view";
import { PageHeader, StatCard } from "@/components/layout/page";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LineChart, BarChart, Donut } from "@/components/charts/charts";
import type { adminStats } from "@/server/adminstats";

type Stats = Awaited<ReturnType<typeof adminStats>>;
const n = (v: number | undefined) => (v ?? 0).toLocaleString("ru-RU").replace(/ /g, " ");
const sum = (o: Record<string, number>) => Object.values(o).reduce((a, b) => a + b, 0);

const links = [
  { href: "/admin/foydalanuvchilar", icon: Users, t: "Foydalanuvchilar", d: "Qidirish, rollar, bloklash, tarif berish" },
  { href: "/admin/savollar", icon: FlaskConical, t: "Savollar banki", d: "Mashq savollari: qo'shish, tasdiqlash, AI qoralamalari" },
  { href: "/admin/imtihonlar", icon: ClipboardList, t: "Imtihonlar", d: "Test va yozma imtihonlar, savollar kiritish" },
  { href: "/admin/mavzular", icon: Layers, t: "Mavzular", d: "Fanlar, mavzular va o'quv maqsadlari" },
  { href: "/admin/seminarlar", icon: CalendarDays, t: "Seminarlar", d: "Seminar e'lonlarini qo'shish va tahrirlash" },
  { href: "/admin/kurslar", icon: BookOpen, t: "Kurslar", d: "Muallif kurslarini tekshirish va tasdiqlash" },
];

export default function Page() {
  const q = useQuery<Stats>("/api/admin/stats");
  return (
    <>
      <PageHeader module={adminModule} title="Admin dashboard" description="Kontentni boshqarish va tizimning haqiqiy ko'rsatkichlari" />
      <h2 className="mb-3 text-sm font-bold text-muted-foreground">Boshqaruv</h2>
      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {links.map((x) => (
          <Link key={x.href} href={x.href} className="group rounded-2xl border border-border bg-card p-5 shadow-soft transition hover:border-primary">
            <span className="grid h-11 w-11 place-items-center rounded-xl bg-primary/10 text-primary"><x.icon className="h-5 w-5" aria-hidden /></span>
            <p className="mt-3 font-extrabold group-hover:text-primary">{x.t}</p><p className="text-sm text-muted-foreground">{x.d}</p>
          </Link>
        ))}
      </div>
      <h2 className="mb-3 text-sm font-bold text-muted-foreground">Ko'rsatkichlar</h2>
      <QueryView q={q}>{(s) => (
        <>
          <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
            <StatCard label="Foydalanuvchilar" value={n(s.users)} delta={s.newUsers ? `${n(s.newUsers)} ta yangi (7 kun)` : undefined} icon={Users} />
            <StatCard label="Savollar (tasdiqlangan)" value={n(s.questions.APPROVED)} delta={s.questions.REVIEW ? `${n(s.questions.REVIEW)} ta tekshiruvda` : undefined} icon={FlaskConical} tone="teal" />
            <StatCard label="Testlar (30 kun)" value={n(s.testSessions30)} icon={GraduationCap} tone="violet" />
            <StatCard label="To'langan summa" value={fmtUzs(s.payments.paidAmount)} delta={s.payments.paidCount ? `${n(s.payments.paidCount)} ta to'lov` : undefined} icon={Wallet} tone="amber" />
          </div>
          <div className="mt-4 grid grid-cols-2 gap-4 xl:grid-cols-4">
            <StatCard label="AI so'rovlari (bugun)" value={n(s.ai.today)} delta={`30 kunda ${n(s.ai.requests30)} ta`} icon={Brain} tone="blue" />
            <StatCard label="Kurslar (tasdiqlangan)" value={n(s.courses.APPROVED)} delta={s.courses.REVIEW ? `${n(s.courses.REVIEW)} ta tekshiruvda` : undefined} icon={BookOpen} tone="violet" />
            <StatCard label="Faol imtihonlar" value={n(s.exams)} delta={`${n(s.examAttempts)} ta urinish`} icon={ClipboardList} tone="rose" />
            <StatCard label="Kutubxona hujjatlari" value={n(s.libraryDocs)} delta={s.questionReports ? `${n(s.questionReports)} ta savol xabari` : undefined} icon={Library} tone="teal" />
          </div>
          <div className="mt-6 grid gap-6 xl:grid-cols-3">
            <Card><CardHeader><CardTitle>Yangi foydalanuvchilar (14 kun)</CardTitle></CardHeader><CardContent><LineChart data={s.charts.users.length > 1 ? s.charts.users : [0, 0]} labels={s.charts.labels} /></CardContent></Card>
            <Card><CardHeader><CardTitle>Boshlangan testlar (14 kun)</CardTitle></CardHeader><CardContent><BarChart data={[s.charts.tests]} labels={s.charts.labels} colors={["#2563EB"]} /></CardContent></Card>
            <Card><CardHeader><CardTitle>Tariflar bo'yicha (faol)</CardTitle></CardHeader><CardContent>
              {(() => {
                const paid = s.subscriptions; const free = Math.max(0, s.users - sum(paid));
                return <Donut center={n(s.users)} sub="foydalanuvchi" parts={[{ label: "FREE", value: free, color: "#9DB8DA" }, { label: "PRO", value: paid.PRO ?? 0, color: "#2563EB" }, { label: "PREMIUM", value: paid.PREMIUM ?? 0, color: "#0D9488" }, { label: "MARKAZ", value: paid.MARKAZ ?? 0, color: "#F59E0B" }].filter((p) => p.value > 0)} />;
              })()}
            </CardContent></Card>
          </div>
          <div className="mt-6 grid gap-6 xl:grid-cols-2">
            <Card><CardHeader><CardTitle>Rollar</CardTitle></CardHeader><CardContent className="space-y-1.5 text-sm">
              {Object.entries(s.roles).map(([r, c]) => <p key={r} className="flex justify-between"><span>{r}</span><b>{n(c)}</b></p>)}
            </CardContent></Card>
            <Card><CardHeader><CardTitle>AI sarfi (30 kun)</CardTitle></CardHeader><CardContent className="space-y-1.5 text-sm">
              <p className="flex justify-between"><span>Tokenlar</span><b>{n(s.ai.tokens30)}</b></p>
              <p className="flex justify-between"><span>Taxminiy narx</span><b>{s.ai.costUsd30 ? `$${s.ai.costUsd30.toFixed(2)}` : "narx kiritilmagan"}</b></p>
              <p className="text-xs text-muted-foreground">Narx «Sozlamalar → AI» bo'limida kiritilgan token narxlariga qarab hisoblanadi.</p>
            </CardContent></Card>
          </div>
        </>
      )}</QueryView>
    </>
  );
}
