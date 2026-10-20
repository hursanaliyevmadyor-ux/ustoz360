"use client";
import * as React from "react";
import { Check, ImageUp, RotateCcw } from "lucide-react";
import { AVATAR_PRESETS, presetUrl } from "@/lib/avatars";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

/** Profil rasmini tanlash oynasi: 10 ta tayyor multfilm qahramoni, yoki o'z rasmini yuklash, yoki standart (avtomatik) rasmga qaytish. */
export function AvatarPicker({ open, onOpenChange, selected, custom, isDefault, busy, onPick, onUpload, onReset }: {
  open: boolean; onOpenChange: (v: boolean) => void; selected: string | null; custom: boolean; isDefault: boolean; busy: boolean;
  onPick: (id: string) => void; onUpload: () => void; onReset: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Profil rasmi" description="O'zingizga yoqqan qahramonni tanlang yoki o'z rasmingizni yuklang. Istalgan vaqtda o'zgartirishingiz mumkin." className="max-w-xl">
        <ul className="grid grid-cols-5 gap-2.5 sm:gap-3">
          {AVATAR_PRESETS.map((p) => {
            const on = !custom && selected === p.id;
            return (
              <li key={p.id}>
                <button type="button" disabled={busy} onClick={() => onPick(p.id)} aria-pressed={on} aria-label={p.name} title={p.name}
                  className={cn("relative block w-full overflow-hidden rounded-full ring-offset-2 ring-offset-card transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary", on ? "ring-4 ring-primary" : "ring-1 ring-border hover:ring-2 hover:ring-primary/50")}>
                  {/* Statik tayyor rasm: next/image kerak emas */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={presetUrl(p.id)} alt="" width={96} height={96} loading="lazy" className="aspect-square w-full" />
                  {on && <span className="absolute inset-0 grid place-items-center bg-primary/25"><span className="grid h-7 w-7 place-items-center rounded-full bg-primary text-white"><Check className="h-4 w-4" aria-hidden /></span></span>}
                </button>
              </li>
            );
          })}
        </ul>
        {isDefault && <p className="mt-3 text-sm text-muted-foreground">Hozir sizga avtomatik rasm berilgan. Istasangiz, boshqasini tanlang.</p>}
        <div className="mt-5 flex flex-wrap items-center justify-between gap-2">
          <Button type="button" variant="outline" onClick={onUpload} disabled={busy}><ImageUp className="h-4 w-4" aria-hidden />O&apos;z rasmimni yuklash</Button>
          {!isDefault && <Button type="button" variant="ghost" onClick={onReset} disabled={busy}><RotateCcw className="h-4 w-4" aria-hidden />Standart rasmga qaytish</Button>}
        </div>
        <p className="mt-3 text-xs text-muted-foreground">Yuklangan rasm: JPG, PNG yoki WebP, 2 MB gacha. Rasmdagi joylashuv va boshqa yashirin ma&apos;lumotlar avtomatik o&apos;chiriladi.</p>
      </DialogContent>
    </Dialog>
  );
}
