"use client";
import * as React from "react";
import { Check, X } from "lucide-react";
import { api } from "@/lib/admin-client";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/form";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

type Avail = { available: boolean; message: string; code: string };

/** Nik yaratish/o'zgartirish: yozish paytida bo'shligi tekshiriladi (band bo'lsa tushunarli xabar). Profil sahifasi va profil sarlavhasidagi oynada bir xil ishlatiladi. */
export function NicknameEditor({ nickname, onSaved, autoFocus }: { nickname: string; onSaved: (nickname: string) => void; autoFocus?: boolean }) {
  const toast = useToast();
  const [nick, setNick] = React.useState(nickname);
  const [avail, setAvail] = React.useState<Avail | null>(null);
  const [busy, setBusy] = React.useState(false);
  const dirty = nick.trim() !== nickname;

  React.useEffect(() => { setNick(nickname); }, [nickname]);
  // Nik bo'shligini yozish paytida tekshiramiz (kechiktirilgan so'rov)
  React.useEffect(() => {
    const v = nick.trim();
    if (!dirty || !v) { setAvail(null); return; }
    let live = true;
    const t = setTimeout(async () => { const r = await api<Avail>(`/api/profile/nickname?value=${encodeURIComponent(v)}`); if (live && r.ok) setAvail(r.data); }, 350);
    return () => { live = false; clearTimeout(t); };
  }, [nick, dirty]);

  const save = async () => {
    setBusy(true);
    const r = await api<{ nickname: string }>("/api/profile/nickname", "PUT", { nickname: nick });
    setBusy(false);
    if (!r.ok) { setAvail({ available: false, message: r.error, code: "error" }); toast("error", r.error); return; }
    toast("success", "Nik saqlandi."); setAvail(null); onSaved(r.data.nickname);
  };

  return (
    <form onSubmit={(e) => { e.preventDefault(); if (dirty && nick.trim() && avail?.available !== false) void save(); }}>
      <Field label="Nik (sizning ismingiz)" hint="3–20 belgi: lotin harflari, raqamlar, _ . -  Masalan: ZiyoUstoz, IlmSari, BilimPro. Profilda va reytingda shu nik katta shriftda ko'rinadi, ism familiyangiz esa kichikroq.">
        <div className="flex gap-2">
          <Input value={nick} onChange={(e) => setNick(e.target.value)} maxLength={20} autoComplete="off" autoCapitalize="none" spellCheck={false} autoFocus={autoFocus} aria-describedby="nick-msg" />
          <Button type="submit" loading={busy} disabled={!dirty || !nick.trim() || avail?.available === false}>Saqlash</Button>
        </div>
      </Field>
      <p id="nick-msg" role="status" aria-live="polite" className={cn("mt-1.5 flex items-center gap-1.5 text-sm", avail ? (avail.available ? "text-success" : "text-danger") : "text-muted-foreground")}>
        {avail ? <>{avail.available ? <Check className="h-4 w-4" aria-hidden /> : <X className="h-4 w-4" aria-hidden />}{avail.message}</> : nickname ? <>Joriy nik: <b className="text-foreground">{nickname}</b>. O&apos;zgartirsangiz, imtihon natijalaringiz yo&apos;qolmaydi.</> : "Nik tanlang: u sizning ismingiz bo'lib ko'rinadi."}
      </p>
    </form>
  );
}
