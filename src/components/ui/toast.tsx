"use client";
import * as React from "react";
import { CheckCircle2, AlertTriangle, Info, X } from "lucide-react";
import { cn } from "@/lib/utils";

type Kind = "success" | "error" | "info";
type Item = { id: number; kind: Kind; text: string };
const Ctx = React.createContext<(kind: Kind, text: string) => void>(() => {});
export const useToast = () => React.useContext(Ctx);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = React.useState<Item[]>([]);
  const push = React.useCallback((kind: Kind, text: string) => {
    const id = Date.now() + Math.random();
    setItems((s) => [...s, { id, kind, text }]);
    setTimeout(() => setItems((s) => s.filter((i) => i.id !== id)), 4500);
  }, []);
  const icon = { success: CheckCircle2, error: AlertTriangle, info: Info };
  return (
    <Ctx.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed inset-x-4 bottom-24 z-[60] flex flex-col items-center gap-2 lg:bottom-6 lg:items-end" aria-live="polite">
        {items.map((i) => {
          const I = icon[i.kind];
          return (
            <div key={i.id} role="status" className={cn("pointer-events-auto flex max-w-sm items-start gap-2.5 rounded-xl border bg-card p-3.5 text-sm shadow-pop",
              i.kind === "success" && "border-success/40", i.kind === "error" && "border-danger/40", i.kind === "info" && "border-primary/30")}>
              <I className={cn("mt-0.5 h-4 w-4 shrink-0", i.kind === "success" && "text-success", i.kind === "error" && "text-danger", i.kind === "info" && "text-primary")} aria-hidden />
              <p className="flex-1">{i.text}</p>
              <button onClick={() => setItems((s) => s.filter((x) => x.id !== i.id))} aria-label="Yopish"><X className="h-4 w-4 text-muted-foreground" /></button>
            </div>
          );
        })}
      </div>
    </Ctx.Provider>
  );
}
