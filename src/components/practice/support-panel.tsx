"use client";
import { Bookmark, Lightbulb } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

/** Savol ekranidagi yordamchi panel: ishora, keyin davom ettirish va joriy natija. */
export function SupportPanel({ correct, wrong, left, canHint, hintUsed, hintLoading, hintError, onHint, onSave }: {
  correct: number; wrong: number; left: number; canHint: boolean; hintUsed: boolean; hintLoading: boolean; hintError?: string; onHint: () => void; onSave: () => void;
}) {
  return (
    <aside aria-label="Yordamchi panel" className="space-y-3">
      <Card className="p-4">
        <p className="flex items-center gap-2 text-sm font-bold"><Lightbulb className="h-4 w-4 text-amber" aria-hidden />Ishora kerakmi?</p>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">Javobni darhol ko'rsatmaydi: bitta ehtimol noto'g'ri variantni chiqarib tashlaydi.</p>
        <Button variant="outline" size="sm" className="mt-3 w-full" disabled={!canHint || hintUsed} loading={hintLoading} onClick={onHint}>{hintUsed ? "Ishora ishlatildi" : "Ishora ko'rsatish"}</Button>
        {hintError && <p role="alert" className="mt-2 text-xs text-danger">{hintError}</p>}
      </Card>
      <Card className="p-4">
        <p className="flex items-center gap-2 text-sm font-bold"><Bookmark className="h-4 w-4 text-amber" aria-hidden />Mashqni keyin davom ettiring</p>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">Javoblaringiz avtomatik saqlanadi. Keyinroq shu joydan davom etishingiz mumkin.</p>
        <Button variant="outline" size="sm" className="mt-3 w-full" onClick={onSave}>Saqlash va chiqish</Button>
      </Card>
      <Card className="p-4">
        <p className="text-sm font-bold">Joriy natija</p>
        <dl className="mt-2 space-y-1.5 text-sm">
          <div className="flex items-center justify-between"><dt className="flex items-center gap-2 text-muted-foreground"><span className="h-2.5 w-2.5 rounded-full bg-success" aria-hidden />To'g'ri javoblar</dt><dd className="font-bold">{correct}</dd></div>
          <div className="flex items-center justify-between"><dt className="flex items-center gap-2 text-muted-foreground"><span className="h-2.5 w-2.5 rounded-full bg-danger" aria-hidden />Noto'g'ri javoblar</dt><dd className="font-bold">{wrong}</dd></div>
          <div className="flex items-center justify-between"><dt className="flex items-center gap-2 text-muted-foreground"><span className="h-2.5 w-2.5 rounded-full bg-muted-foreground/40" aria-hidden />Qolgan savollar</dt><dd className="font-bold">{left}</dd></div>
        </dl>
      </Card>
    </aside>
  );
}
