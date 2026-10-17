"use client";
import * as React from "react";
import Link from "next/link";
import type { Query } from "@/lib/use-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ErrorState, Skeleton } from "@/components/ui/states";

/** Yuklanish / kirish kerak / xato / tayyor holatlarini bir joyda boshqaradi (har sahifada takrorlanmasligi uchun). */
export function QueryView<T>({ q, children, skeleton }: { q: Query<T>; children: (data: T) => React.ReactNode; skeleton?: React.ReactNode }) {
  if (q.loading && !q.data) return <>{skeleton ?? <div className="space-y-3" aria-busy="true"><Skeleton className="h-10 w-1/3" /><Skeleton className="h-40 w-full" /></div>}</>;
  if (q.status === 401) return (
    <Card className="max-w-xl"><CardContent className="space-y-3">
      <p className="font-bold">Avval tizimga kiring</p>
      <p className="text-sm text-muted-foreground">Bu bo'limda ma'lumotlaringiz akkauntga saqlanadi.</p>
      <Button asChild><Link href="/kirish">Kirish</Link></Button>
    </CardContent></Card>
  );
  if (q.error || !q.data) return <ErrorState text={q.error ?? "Ma'lumotni yuklab bo'lmadi."} onRetry={q.reload} />;
  return <>{children(q.data)}</>;
}
