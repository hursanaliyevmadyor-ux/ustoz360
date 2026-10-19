"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { Field, Input, Select } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { BrandMark } from "@/components/brand-mark";
import { REGIONS } from "@/lib/regions";

/** Google/Telegram bilan birinchi kirishdan keyin: ism-familiya va yashash joyi. */
export default function Page() {
  const router = useRouter(); const toast = useToast();
  const [ready, setReady] = React.useState(false);
  const [first, setFirst] = React.useState(""); const [last, setLast] = React.useState("");
  const [region, setRegion] = React.useState(""); const [district, setDistrict] = React.useState(""); const [subject, setSubject] = React.useState("");
  const [busy, setBusy] = React.useState(false); const [err, setErr] = React.useState("");

  React.useEffect(() => {
    fetch("/api/me").then((r) => r.json()).then((d) => {
      if (!d.user) { router.replace("/kirish"); return; }
      if (d.user.onboarded) { router.replace("/dashboard"); return; }
      const parts = String(d.user.name ?? "").trim().split(/\s+/).filter(Boolean);
      if (parts.length) { setFirst(parts[0]); setLast(parts.slice(1).join(" ")); }
      setReady(true);
    }).catch(() => setReady(true));
  }, [router]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setErr("");
    if (!first.trim() || !last.trim()) { setErr("Ism va familiyani to'liq yozing."); return; }
    if (!region) { setErr("Viloyatni tanlang."); return; }
    if (!district.trim()) { setErr("Tuman yoki shahar nomini yozing."); return; }
    setBusy(true);
    try {
      const r = await fetch("/api/profile", {
        method: "PUT", headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: `${first.trim()} ${last.trim()}`, region, district: district.trim(), subjectFocus: subject.trim() || undefined, complete: true }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setErr(d.error ?? "Saqlab bo'lmadi. Qayta urinib ko'ring."); return; }
      toast("success", "Ro'yxatdan o'tdingiz. Xush kelibsiz!");
      router.push("/dashboard"); router.refresh();
    } catch { setErr("Server bilan aloqa yo'q."); } finally { setBusy(false); }
  };

  return (
    <div className="grid min-h-screen place-items-center bg-background px-5 py-10">
      <main className="w-full max-w-md">
        <div className="mb-8 flex items-center gap-2.5" aria-label="USTOZ 360">
          <BrandMark className="h-11 w-11" />
          <span className="text-xl font-extrabold tracking-tight">USTOZ <span className="text-primary">360</span></span>
        </div>
        <h1 className="text-3xl font-extrabold tracking-tight">Deyarli tayyor!</h1>
        <p className="mt-2 text-sm text-muted-foreground">Ro'yxatdan o'tishni yakunlash uchun o'zingiz haqingizda qisqa ma'lumot kiriting.</p>

        {!ready ? (
          <div className="mt-8 space-y-3" aria-hidden><div className="h-11 animate-pulse rounded-xl bg-muted" /><div className="h-11 animate-pulse rounded-xl bg-muted" /><div className="h-11 animate-pulse rounded-xl bg-muted" /></div>
        ) : (
          <form onSubmit={submit} className="mt-8 space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Ism"><Input value={first} onChange={(e) => setFirst(e.target.value)} autoComplete="given-name" required maxLength={40} /></Field>
              <Field label="Familiya"><Input value={last} onChange={(e) => setLast(e.target.value)} autoComplete="family-name" required maxLength={40} /></Field>
            </div>
            <Field label="Viloyat">
              <Select value={region} onChange={(e) => setRegion(e.target.value)} required>
                <option value="">Tanlang...</option>
                {REGIONS.map((r) => <option key={r} value={r}>{r}</option>)}
              </Select>
            </Field>
            <Field label="Tuman yoki shahar"><Input value={district} onChange={(e) => setDistrict(e.target.value)} autoComplete="address-level2" placeholder="Masalan: Chilonzor tumani" required maxLength={80} /></Field>
            <Field label="Qaysi fandan dars berasiz? (ixtiyoriy)"><Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Masalan: Matematika" maxLength={80} /></Field>
            {err && <p role="alert" className="rounded-xl bg-danger/10 p-3 text-sm text-danger">{err}</p>}
            <Button type="submit" size="lg" loading={busy} className="w-full">Ro'yxatdan o'tishni yakunlash</Button>
          </form>
        )}
      </main>
    </div>
  );
}
