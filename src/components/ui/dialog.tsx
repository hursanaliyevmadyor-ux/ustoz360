"use client";
import * as D from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export const Dialog = D.Root;
export const DialogTrigger = D.Trigger;
export const DialogClose = D.Close;
export function DialogContent({ className, children, title, description, side = "center" }: { className?: string; children: React.ReactNode; title: string; description?: string; side?: "center" | "right" }) {
  return (
    <D.Portal>
      <D.Overlay className="fixed inset-0 z-50 bg-navy/40 backdrop-blur-[2px]" />
      <D.Content
        className={cn(
          "fixed z-50 bg-card shadow-pop focus:outline-none",
          side === "center" ? "left-1/2 top-1/2 w-[calc(100%-32px)] max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-2xl p-6" : "bottom-0 right-0 top-0 w-full max-w-md overflow-y-auto p-5 sm:rounded-l-2xl",
          className
        )}
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <D.Title className="text-lg font-bold">{title}</D.Title>
            {description ? <D.Description className="text-sm text-muted-foreground">{description}</D.Description> : <D.Description className="sr-only">{title}</D.Description>}
          </div>
          <D.Close className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted" aria-label="Yopish"><X className="h-5 w-5" /></D.Close>
        </div>
        {children}
      </D.Content>
    </D.Portal>
  );
}
