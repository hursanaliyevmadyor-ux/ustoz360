"use client";
import * as React from "react";
import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

/** Admin bo'limi faqat ADMIN/SUPERADMIN uchun. Bu faqat qulaylik uchun ko'rinish: haqiqiy himoya har bir admin API'sida serverda (requireAdmin). */
export function AdminGate({ children }: { children: React.ReactNode }) {
  const [state, setState] = React.useState<"loading" | "ok" | "anon" | "denied">("loading");
  React.useEffect(() => {
    fetch("/api/me").then((r) => r.json()).then((d) => {
      if (!d.user) setState("anon");
      else setState((d.user.roles as string[]).some((x) => x === "ADMIN" || x === "SUPERADMIN") ? "ok" : "denied");
    }).catch(() => setState("anon"));
  }, []);
  if (state === "ok") return <>{children}</>;
  if (state === "loading") return <p className="text-sm text-muted-foreground">Tekshirilmoqda...</p>;
  return (
    <Card className="max-w-xl"><CardContent className="space-y-3">
      <ShieldAlert className="h-8 w-8 text-amber" aria-hidden />
      <p className="text-lg font-extrabold">{state === "anon" ? "Avval tizimga kiring" : "Bu bo'lim faqat adminlar uchun"}</p>
      <p className="text-sm text-muted-foreground">{state === "anon" ? "Admin paneliga kirish uchun akkauntingiz bilan kiring." : "Sizning akkauntingizda admin huquqi yo'q."}</p>
      <Button asChild>{state === "anon" ? <Link href="/kirish">Kirish</Link> : <Link href="/dashboard">Bosh sahifaga</Link>}</Button>
    </CardContent></Card>
  );
}