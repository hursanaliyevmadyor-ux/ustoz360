"use client";
import * as React from "react";
import Link from "next/link";
import { api } from "@/lib/admin-client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/ui/toast";
import { NicknameEditor } from "./nickname-editor";

/** Reyting va maxfiylik: nik (yagona, band bo'lsa tushunarli xabar) va reytingda qatnashishga ixtiyoriy rozilik. Email, telefon va to'liq ism ommaga chiqmaydi. */
export function RatingSettings({ nickname, optIn, onChanged }: { nickname: string; optIn: boolean; onChanged: (p: { nickname?: string; optIn?: boolean }) => void }) {
  const toast = useToast();
  const [pBusy, setPBusy] = React.useState(false);
  const [consent, setConsent] = React.useState(false);

  const setParticipation = async (on: boolean) => {
    setPBusy(true);
    const r = await api("/api/leaderboard/participation", "POST", { optIn: on, ...(on && { consent: true }) });
    setPBusy(false);
    if (!r.ok) { toast("error", r.error); return; }
    toast("success", on ? "Reytingda qatnashasiz." : "Reytingdan chiqdingiz. Shaxsiy natijalaringiz saqlanib qoladi.");
    onChanged({ optIn: on }); setConsent(false);
  };

  return (
    <Card id="reyting" className="mt-6 max-w-3xl scroll-mt-24">
      <CardHeader><div><CardTitle>Nik va reyting</CardTitle><CardDescription>Nik va profil rasmi ustozlar reytingida ko&apos;rinadi. Email, telefon va to&apos;liq ismingiz ommaga chiqmaydi.</CardDescription></div></CardHeader>
      <CardContent className="space-y-5">
        <NicknameEditor nickname={nickname} onSaved={(n) => onChanged({ nickname: n })} />

        <div className="rounded-2xl border border-border p-4">
          <label className="flex items-start gap-3">
            <Switch checked={optIn} disabled={pBusy || (!optIn && (!nickname || !consent))} onCheckedChange={(v) => void setParticipation(v)} aria-label="Reytingda qatnashaman" />
            <span className="text-sm">
              <b>Reytingda qatnashaman</b>
              <span className="block text-muted-foreground">Ixtiyoriy. Istalgan vaqtda chiqishingiz mumkin; chiqsangiz ham shaxsiy natijalaringiz saqlanadi.</span>
            </span>
          </label>
          {!optIn && (
            <label className="mt-3 flex items-start gap-2.5 text-sm">
              <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5 h-4 w-4" />
              <span>Nik, profil rasmi va reyting indeksim boshqa foydalanuvchilarga ko&apos;rinishiga roziman.</span>
            </label>
          )}
          {!optIn && !nickname && <p className="mt-2 text-xs text-muted-foreground">Avval nik tanlab saqlang.</p>}
          <p className="mt-3 text-xs text-muted-foreground">Reytingga kirish uchun diagnostika va bitta reyting sinovini yakunlash kerak. <Link href="/reyting" className="font-semibold text-primary hover:underline">Reytingni ko&apos;rish</Link></p>
        </div>
      </CardContent>
    </Card>
  );
}
