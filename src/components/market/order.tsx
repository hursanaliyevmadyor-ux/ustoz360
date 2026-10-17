"use client";
import * as React from "react";
import { Copy, ExternalLink } from "lucide-react";
import { api } from "@/lib/admin-client";
import { fmtUzs } from "@/lib/plans";
import { Button, type ButtonProps } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";

export type OrderInput = { kind: "COURSE"; courseId: string } | { kind: "PLAN"; planKey: string };
type OrderResult =
  | { free: true; courseId: string }
  | { free: false; payment: { id: string; amount: number; reference: string; status: string }; title: string; instructions: string | null; checkoutUrl: string | null };

/**
 * Sotib olish tugmasi. Narx serverda bazadan olinadi, kirish faqat to'lov serverda tasdiqlangandan keyin ochiladi.
 * To'lov tizimi yopiq bo'lsa halol xabar ko'rsatiladi (tugma "ishlayotgandek" ko'rinmaydi).
 */
export function OrderButton({ input, label = "Sotib olish", onDone, ...btn }: { input: OrderInput; label?: string; onDone?: () => void } & Omit<ButtonProps, "onClick">) {
  const toast = useToast();
  const [busy, setBusy] = React.useState(false);
  const [res, setRes] = React.useState<Extract<OrderResult, { free: false }> | null>(null);
  const go = async () => {
    setBusy(true);
    const r = await api<OrderResult>("/api/market/order", "POST", input);
    setBusy(false);
    if (!r.ok) {
      toast("error", r.status === 401 ? "Sotib olish uchun avval tizimga kiring." : r.error);
      return;
    }
    if (r.data.free) { toast("success", "Kurs ochildi. «Kurslarim» bo'limida ko'rasiz."); onDone?.(); return; }
    setRes(r.data);
  };
  return (
    <>
      <Button {...btn} loading={busy} onClick={go}>{label}</Button>
      {res && (
        <Dialog open onOpenChange={(v) => { if (!v) { setRes(null); onDone?.(); } }}>
          <DialogContent title="Buyurtma qabul qilindi" description={res.title}>
            <div className="space-y-4 text-sm">
              <div className="rounded-xl bg-muted p-4">
                <p className="text-muted-foreground">To'lov summasi</p><p className="text-xl font-extrabold">{fmtUzs(res.payment.amount)}</p>
                <p className="mt-3 text-muted-foreground">Buyurtma kodi</p>
                <p className="flex items-center gap-2"><code className="text-lg font-bold tracking-wider">{res.payment.reference}</code>
                  <button className="grid h-9 w-9 place-items-center rounded-lg hover:bg-border" aria-label="Kodni nusxalash" onClick={() => { void navigator.clipboard?.writeText(res.payment.reference); toast("success", "Kod nusxalandi."); }}><Copy className="h-4 w-4" /></button></p>
              </div>
              {res.instructions && <div><p className="font-bold">To'lov ko'rsatmasi</p><p className="mt-1 whitespace-pre-wrap">{res.instructions}</p></div>}
              {res.checkoutUrl && <Button asChild className="w-full"><a href={res.checkoutUrl} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-4 w-4" />To'lovga o'tish</a></Button>}
              <p className="text-muted-foreground">To'lov administrator tomonidan tasdiqlangach kirish avtomatik ochiladi. Holatni «Kurslarim va xaridlar» bo'limida ko'rasiz.</p>
            </div>
          </DialogContent>
        </Dialog>)}
    </>
  );
}
