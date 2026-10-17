"use client";
import * as React from "react";
import Link from "next/link";
import { useApi } from "@/lib/use-api";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ErrorState, Skeleton } from "@/components/ui/states";

/**
 * Haqiqiy API ma'lumotini ko'rsatadi. Kirmagan bo'lsa kirishga yo'naltiradi;
 * backend yo'q bo'lsa halol xabar beradi va faqat foydalanuvchi so'rasa DEMO ma'lumotni ko'rsatadi.
 */
export function LiveGate<T>({ url, render, demo }: { url: string; render: (data: T) => React.ReactNode; demo: React.ReactNode }) {
  const [state, reload] = useApi<T>(url);
  const [showDemo, setShowDemo] = React.useState(false);
  // Namuna rejimi foydalanuvchi so'raganda ko'rsatiladi va doim aniq belgilanadi: haqiqiy natija bilan aralashmaydi.
  if (showDemo) return (
    <>
      <div role="status" className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber/40 bg-amber/10 px-4 py-3 text-sm">
        <span><b>NAMUNA.</b> Bu ma'lumotlar tasdiqlangan emas va sizning natijangiz emas.</span>
        <Button size="sm" variant="outline" onClick={() => setShowDemo(false)}>Namunadan chiqish</Button>
      </div>
      {demo}
    </>
  );
  if (state.status === "loading") return <div className="space-y-3"><Skeleton className="h-10 w-1/3" /><Skeleton className="h-40 w-full" /></div>;
  if (state.status === "anon") return (
    <Card className="max-w-xl"><CardContent className="space-y-3">
      <p className="font-bold">Natijalaringiz akkauntga saqlanadi</p>
      <p className="text-sm text-muted-foreground">Bu bo'lim ma'lumotlarini ko'rish uchun tizimga kiring va diagnostika topshiring.</p>
      <div className="flex flex-wrap gap-2"><Button asChild><Link href="/kirish">Kirish</Link></Button><Button variant="outline" onClick={() => setShowDemo(true)}>Namunani ko'rish</Button></div>
    </CardContent></Card>
  );
  if (state.status === "offline") return (
    <>
      <ErrorState title="Backend ulanmagan" text="Server yoki ma'lumotlar bazasi mavjud emas, shuning uchun sizning ma'lumotlaringizni ko'rsatib bo'lmaydi." onRetry={reload} />
      <div className="mt-4 flex justify-center"><Button variant="outline" onClick={() => setShowDemo(true)}>Namunani ko'rish</Button></div>
    </>
  );
  return <>{render(state.data)}</>;
}
