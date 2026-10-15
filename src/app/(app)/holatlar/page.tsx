"use client";
import * as React from "react";
import { PageHeader } from "@/components/layout/page";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState, SuccessState, Skeleton } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";

export default function Page() {
  const toast = useToast(); const [loading, setLoading] = React.useState(false);
  return (
    <>
      <PageHeader title="Holatlar namunasi" description="Loading, empty, error va success holatlari" />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card><CardHeader><CardTitle>Tugma holatlari</CardTitle></CardHeader><CardContent className="flex flex-wrap gap-2">
          <Button loading={loading} onClick={() => { setLoading(true); setTimeout(() => { setLoading(false); toast("success", "Muvaffaqiyatli bajarildi."); }, 1200); }}>Loading</Button>
          <Button variant="danger" onClick={() => toast("error", "Xatolik yuz berdi.")}>Error toast</Button><Button variant="success" onClick={() => toast("success", "Saqlandi.")}>Success toast</Button><Button disabled>Disabled</Button></CardContent></Card>
        <Card><CardHeader><CardTitle>Loading (skeleton)</CardTitle></CardHeader><CardContent className="space-y-3"><Skeleton className="h-6 w-1/2" /><Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-4/5" /></CardContent></Card>
        <EmptyState title="Bo'sh holat" text="Hozircha ma'lumot yo'q. Boshlash uchun amalni bajaring." action={<Button size="sm">Boshlash</Button>} />
        <ErrorState text="Ma'lumotni yuklab bo'lmadi." onRetry={() => toast("info", "Qayta urinish...")} />
        <SuccessState title="Muvaffaqiyatli" text="Amal yakunlandi." />
      </div>
    </>
  );
}
