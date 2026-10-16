"use client";
import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CalendarView, DailyPlanView, RoadmapView } from "@/components/toifa/views";
import { SectionHeader } from "@/components/layout/section-header";
import { Skeleton } from "@/components/ui/states";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const VIEWS = ["yol-xaritasi", "kalendar", "kunlik"] as const;

/** Reja: yo'l xaritasi, tayyorgarlik kalendari va kunlik reja alohida bo'limlar emas, bitta joyda. */
function Inner() {
  const router = useRouter();
  const q = useSearchParams().get("view");
  const view = (VIEWS as readonly string[]).includes(q ?? "") ? (q as string) : "yol-xaritasi";
  return (
    <div className="mx-auto max-w-6xl">
      <SectionHeader title="Reja" lead="Imtihongacha yo'l xaritasi, kalendar va kunlik reja." back={{ href: "/toifa", label: "TOIFA NAVIGATOR" }} />
      <p className="mb-4 rounded-xl bg-amber/10 p-3 text-sm"><b>Namunaviy ma'lumotlar.</b> Rasmiy sanalar va reja backend ulangandan keyin haqiqiy bo'ladi: sanalarni taxmin qilmaymiz.</p>
      <Tabs value={view} onValueChange={(v) => router.replace(`/toifa/reja?view=${v}`, { scroll: false })}>
        <TabsList><TabsTrigger value="yol-xaritasi">Yo'l xaritasi</TabsTrigger><TabsTrigger value="kalendar">Kalendar</TabsTrigger><TabsTrigger value="kunlik">Kunlik reja</TabsTrigger></TabsList>
        <TabsContent value="yol-xaritasi"><RoadmapView /></TabsContent>
        <TabsContent value="kalendar"><CalendarView /></TabsContent>
        <TabsContent value="kunlik"><DailyPlanView /></TabsContent>
      </Tabs>
    </div>
  );
}

export default function Page() {
  return <React.Suspense fallback={<Skeleton className="mx-auto h-96 max-w-6xl" />}><Inner /></React.Suspense>;
}
