import { AlertTriangle, CheckCircle2, Inbox, RefreshCw } from "lucide-react";
import { Button } from "./button";
import { cn } from "@/lib/utils";

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("skeleton rounded-xl", className)} aria-hidden />;
}
export function EmptyState({ title, text, action, icon: Icon = Inbox }: { title: string; text: string; action?: React.ReactNode; icon?: React.ElementType }) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-dashed border-border bg-card/60 px-6 py-12 text-center">
      <span className="mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-muted text-muted-foreground"><Icon className="h-6 w-6" aria-hidden /></span>
      <p className="font-bold">{title}</p>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">{text}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
export function ErrorState({ title = "Xatolik yuz berdi", text, onRetry }: { title?: string; text: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex flex-col items-center rounded-2xl border border-danger/30 bg-danger/5 px-6 py-10 text-center">
      <AlertTriangle className="mb-3 h-8 w-8 text-danger" aria-hidden />
      <p className="font-bold">{title}</p>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">{text}</p>
      {onRetry && <Button variant="outline" size="sm" className="mt-4" onClick={onRetry}><RefreshCw className="h-4 w-4" />Qayta urinish</Button>}
    </div>
  );
}
export function SuccessState({ title, text, action }: { title: string; text: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-success/30 bg-success/5 px-6 py-10 text-center">
      <CheckCircle2 className="mb-3 h-8 w-8 text-success" aria-hidden />
      <p className="font-bold">{title}</p>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">{text}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
/** Backend ulanmagan funksiyalar uchun halol xabar. */
export function NoBackendNote({ children }: { children?: React.ReactNode }) {
  return (
    <p className="flex items-start gap-2 rounded-xl bg-amber/10 px-3.5 py-2.5 text-xs text-foreground">
      <span className="mt-0.5 font-bold uppercase text-amber">Prototip</span>
      <span>{children ?? "Backend ulanmagan: bu amal hozircha saqlanmaydi va haqiqiy natija bermaydi."}</span>
    </p>
  );
}
