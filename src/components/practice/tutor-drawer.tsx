"use client";
import * as React from "react";
import * as D from "@radix-ui/react-dialog";
import { Send, Sparkles, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export type Msg = { role: "user" | "assistant"; content: string };

const CHIPS = ["Buni oddiyroq tushuntir", "Nega mening variantim noto'g'ri?", "Hayotiy misol keltir", "Eslab qolish usulini ayt"];

/** AI murabbiy: kompyuterda o'ng tomondan, telefonda pastdan chiqadi. Suhbat yopilganda saqlanib qoladi (holat sahifada turadi). */
export function AITutorDrawer({ open, onOpenChange, messages, busy, error, notice, onSend }: {
  open: boolean; onOpenChange: (v: boolean) => void; messages: Msg[]; busy: boolean; error?: string; notice?: string; onSend: (text: string) => void;
}) {
  const [text, setText] = React.useState("");
  const endRef = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => { endRef.current?.scrollIntoView({ block: "end" }); }, [messages, busy, open]);
  const send = (t: string) => { const v = t.trim(); if (!v || busy) return; setText(""); onSend(v); };
  return (
    <D.Root open={open} onOpenChange={onOpenChange}>
      <D.Portal>
        <D.Overlay className="fixed inset-0 z-50 bg-navy/40 backdrop-blur-[2px]" />
        <D.Content className="fixed inset-x-0 bottom-0 z-50 flex max-h-[88vh] flex-col rounded-t-2xl bg-card shadow-pop focus:outline-none sm:inset-y-0 sm:left-auto sm:right-0 sm:max-h-none sm:w-[420px] sm:rounded-none sm:rounded-l-2xl">
          <div className="flex items-center justify-between gap-3 border-b border-border p-4">
            <div>
              <D.Title className="flex items-center gap-2 text-base font-extrabold"><Sparkles className="h-4 w-4 text-primary" aria-hidden />AI murabbiy</D.Title>
              <D.Description className="text-xs text-muted-foreground">Faqat shu savol va tasdiqlangan javob kaliti doirasida javob beradi.</D.Description>
            </div>
            <D.Close className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted" aria-label="Yopish"><X className="h-5 w-5" /></D.Close>
          </div>
          <div className="min-h-[220px] flex-1 space-y-3 overflow-y-auto p-4" aria-live="polite">
            {messages.length === 0 && <p className="rounded-xl bg-muted p-3 text-sm text-muted-foreground">Savol bo'yicha tushunmagan joyingizni so'rang yoki quyidagi tayyor savollardan birini tanlang.</p>}
            {messages.map((m, i) => (
              <div key={i} className={cn("max-w-[88%] whitespace-pre-line rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed", m.role === "user" ? "ml-auto bg-primary text-white" : "bg-muted")}>{m.content}</div>
            ))}
            {busy && <div className="max-w-[60%] rounded-2xl bg-muted px-3.5 py-2.5 text-sm text-muted-foreground" aria-busy>Yozmoqda...</div>}
            {error && <p role="alert" className="rounded-xl bg-danger/10 p-3 text-sm text-danger">{error}</p>}
            {notice && <p className="text-xs text-muted-foreground">{notice}</p>}
            <div ref={endRef} />
          </div>
          <div className="border-t border-border p-3">
            <div className="mb-2 flex flex-wrap gap-1.5">
              {CHIPS.map((c) => <button key={c} type="button" disabled={busy} onClick={() => send(c)} className="rounded-full border border-border px-3 py-1.5 text-xs font-semibold hover:border-primary/50 hover:bg-primary/5 disabled:opacity-60">{c}</button>)}
            </div>
            <form className="flex items-end gap-2" onSubmit={(e) => { e.preventDefault(); send(text); }}>
              <textarea value={text} onChange={(e) => setText(e.target.value)} maxLength={600} rows={2} aria-label="Savolingiz"
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(text); } }}
                className="min-h-[44px] flex-1 resize-none rounded-xl border border-border bg-background p-2.5 text-sm" placeholder="Savolingizni yozing..." />
              <Button type="submit" size="icon" aria-label="Yuborish" disabled={!text.trim() || busy}><Send className="h-4 w-4" /></Button>
            </form>
          </div>
        </D.Content>
      </D.Portal>
    </D.Root>
  );
}
