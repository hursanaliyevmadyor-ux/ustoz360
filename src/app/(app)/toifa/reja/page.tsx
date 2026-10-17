"use client";
import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CalendarView, DailyPlanView, RoadmapView, type ToifaState } from "@/components/toifa/views";
import { QueryView } from "@/components/layout/query-view";
import { SectionHeader } from "@/components/layout/section-header";
import { useQuery } from "@/lib/use-query";
import { Skeleton } from "@/components/ui/states";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const VIEWS = ["yol-xaritasi", "kalendar", "kunlik"] as const;

/** Reja: yo'l xaritasi, tayyorgarlik kalendari va kunlik reja bitta joyda; hammasi bazadagi haqiqiy ma'lumot. */
function Inner() {
  const router = useRouter();
  const q = useSearchParams().get("view");
  const view = (VIEWS as readonly string[]).includes(q ?? "") ? (q as string) : "yol-xaritasi";
  const data = useQuery<ToifaState>("/api/toifa");
  return (
    <div className="mx-auto max-w-6xl">
      <SectionHeader title="Reja" lead="Imtihongacha yo'l xaritasi, kalendar va kunlik reja." back={{ href: "/toifa", label: "TOIFA NAVIGATOR" }} />
      <Tabs value={view} onValueChange={(v) => router.replace(`/toifa/reja?view=${v}`, { scroll: false })}>
        <TabsList><TabsTrigger value="yol-xaritasi">Yo'l xaritasi</TabsTrigger><TabsTrigger value="kalendar">Kalendar</TabsTrigger><TabsTrigger value="kunlik">Kunlik reja</TabsTrigger></TabsList>
        <QueryView q={data}>{() => (
          <>
            <TabsContent value="yol-xaritasi"><RoadmapView q={data} /></TabsContent>
            <TabsContent value="kalendar"><CalendarView q={data} /></TabsContent>
            <TabsContent value="kunlik"><DailyPlanView q={data} /></TabsContent>
          </>)}</QueryView>
      </Tabs>
    </div>
  );
}

export default function Page() {
  return <React.Suspense fallback={<Skeleton className="mx-auto h-96 max-w-6xl" />}><Inner /></React.Suspense>;
}
