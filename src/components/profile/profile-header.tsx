"use client";
import * as React from "react";
import Link from "next/link";
import { Camera, Pencil, Trophy } from "lucide-react";
import { api } from "@/lib/admin-client";
import { useQuery } from "@/lib/use-query";
import type { AvatarState } from "@/lib/avatars";
import type { MyRank } from "@/lib/ranking-client";
import { Avatar } from "@/components/avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { AvatarCropper } from "./avatar-cropper";
import { AvatarPicker } from "./avatar-picker";
import { NicknameEditor } from "./nickname-editor";

/**
 * Profil yuqorisi: dumaloq avatar (kamera belgisi bilan: tayyor rasm tanlash yoki yuklash), o'zi tanlagan nik (katta, maxsus shrift),
 * ism familiya (pastda, kichik), tayyorlanayotgan yo'nalish va reytingdagi o'rin.
 */
export function ProfileHeader({ name, nickname, avatar, directionLabel, onAvatar, onNickname }: {
  name: string; nickname: string; avatar: AvatarState; directionLabel: string | null; onAvatar: (a: AvatarState) => void; onNickname: (n: string) => void;
}) {
  const toast = useToast();
  const input = React.useRef<HTMLInputElement>(null);
  const [file, setFile] = React.useState<File | null>(null);
  const [picker, setPicker] = React.useState(false);
  const [nickOpen, setNickOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const rank = useQuery<MyRank>("/api/leaderboard/me");

  const pick = async (id: string) => {
    setBusy(true);
    const r = await api<AvatarState>("/api/profile/avatar", "PUT", { preset: id });
    setBusy(false);
    if (!r.ok) { toast("error", r.error); return; }
    onAvatar(r.data); setPicker(false); toast("success", "Profil rasmi yangilandi.");
  };
  const reset = async () => {
    if (avatar.avatarCustom && !window.confirm("Yuklangan rasmingiz o'chiriladi va standart rasm qo'yiladi. Davom etasizmi?")) return;
    setBusy(true);
    const r = await api<AvatarState>("/api/profile/avatar", "DELETE");
    setBusy(false);
    if (!r.ok) { toast("error", r.error); return; }
    onAvatar(r.data); setPicker(false); toast("success", "Standart rasm qo'yildi.");
  };
  const r = rank.data;
  const place = r?.ranked && r.overall ? `Reytingda: ${r.overall.rank}-o'rin / ${r.overall.total}` : "Reytingda hali yo'q";

  return (
    <Card className="mb-6 max-w-3xl p-5 sm:p-6">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
        <div className="relative mx-auto shrink-0 sm:mx-0">
          <Avatar src={avatar.avatar} name={nickname || name || "?"} size={104} className="ring-4 ring-card shadow-soft" />
          <button type="button" onClick={() => setPicker(true)} aria-label="Profil rasmini o'zgartirish"
            className="absolute bottom-0 right-0 grid h-10 w-10 place-items-center rounded-full bg-primary text-white shadow-pop ring-4 ring-card hover:bg-primary/90">
            <Camera className="h-5 w-5" aria-hidden />
          </button>
          <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" aria-label="Profil rasmini tanlash"
            onChange={(e) => { const f = e.target.files?.[0] ?? null; if (input.current) input.current.value = ""; if (f) setFile(f); }} />
        </div>
        <div className="min-w-0 flex-1 text-center sm:text-left">
          {nickname ? (
            <>
              <div className="flex items-center justify-center gap-2 sm:justify-start">
                <h1 className="truncate font-display text-3xl font-extrabold tracking-tight text-primary sm:text-4xl">{nickname}</h1>
                <button type="button" onClick={() => setNickOpen(true)} aria-label="Nikni o'zgartirish" className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"><Pencil className="h-4 w-4" aria-hidden /></button>
              </div>
              <p className="truncate text-sm text-muted-foreground">{name || "Ism familiya kiritilmagan"}</p>
            </>
          ) : (
            <>
              <h1 className="truncate text-2xl font-extrabold tracking-tight sm:text-3xl">{name || "Ism familiya kiritilmagan"}</h1>
              <Button type="button" variant="outline" size="sm" className="mt-2" onClick={() => setNickOpen(true)}><Pencil className="h-4 w-4" aria-hidden />Nik yaratish</Button>
            </>
          )}
          <p className="mt-2 text-sm"><b>{directionLabel ?? "Yo'nalish tanlanmagan"}</b> · {place}</p>
        </div>
      </div>
      <div className="mt-5 flex flex-wrap justify-center gap-2 sm:justify-start">
        <Button variant="outline" onClick={() => document.getElementById("profil-forma")?.scrollIntoView({ behavior: "smooth", block: "start" })}>Profilni tahrirlash</Button>
        <Button asChild><Link href="/reyting"><Trophy className="h-4 w-4" aria-hidden />Mening reytingim</Link></Button>
      </div>
      <AvatarPicker open={picker} onOpenChange={setPicker} selected={avatar.avatarPreset} custom={avatar.avatarCustom} isDefault={avatar.avatarIsDefault} busy={busy}
        onPick={(id) => void pick(id)} onReset={() => void reset()} onUpload={() => { setPicker(false); input.current?.click(); }} />
      <AvatarCropper file={file} onClose={() => setFile(null)} onSaved={(a) => { onAvatar(a); toast("success", "Profil rasmi yangilandi."); }} />
      <Dialog open={nickOpen} onOpenChange={setNickOpen}>
        <DialogContent title={nickname ? "Nikni o'zgartirish" : "Nik yaratish"} description="Nik profilingizda va ustozlar reytingida asosiy nom bo'lib ko'rinadi.">
          <NicknameEditor nickname={nickname} autoFocus onSaved={(n) => { onNickname(n); setNickOpen(false); }} />
        </DialogContent>
      </Dialog>
    </Card>
  );
}
