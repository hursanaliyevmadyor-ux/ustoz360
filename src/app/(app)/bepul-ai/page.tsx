"use client";
import * as React from "react";
import { Send } from "lucide-react";
import { modules } from "@/lib/modules";
import { PageHeader } from "@/components/layout/page";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { NoBackendNote } from "@/components/ui/states";
import { cn } from "@/lib/utils";

type Msg = { who: "me" | "ai" | "sys"; text: string };
type Free = { configured: boolean; remaining: number; limit: number };

export default function Page() {
  const m = modules[6];
  const [msgs, setMsgs] = React.useState<Msg[]>([]);
  const [text, setText] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [st, setSt] = React.useState<Free | "anon" | null>(null);
  React.useEffect(() => {
    fetch("/api/ai/status").then(async (r) => setSt(r.status === 401 ? "anon" : r.ok ? (await r.json()).free : null)).catch(() => setSt(null));
  }, []);
  const send = async (t: string) => {
    if (!t.trim() || busy) return;
    const history = msgs.filter((x) => x.who !== "sys").map((x) => ({ role: x.who === "me" ? "user" : "assistant", content: x.text }));
    setMsgs((x) => [...x, { who: "me", text: t }]); setText(""); setBusy(true);
    try {
      const r = await fetch("/api/ai/free-chat", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ messages: [...history, { role: "user", content: t }].slice(-20) }) });
      const d = await r.json();
      if (r.ok) { setMsgs((x) => [...x, { who: "ai", text: d.reply }]); setSt((s) => (s && s !== "anon" ? { ...s, remaining: d.remaining } : s)); }
      else setMsgs((x) => [...x, { who: "sys", text: d.error ?? "Xatolik yuz berdi." }]);
    } catch { setMsgs((x) => [...x, { who: "sys", text: "Server bilan aloqa yo'q." }]); }
    setBusy(false);
  };
  const off = st === "anon" || st === null || !st.configured;
  return (
    <>
      <PageHeader module={m} title="Bepul AI" description="Bepul modellar bilan suhbat. Sifat va tezlik kafolatlanmaydi" />
      <Card className="max-w-3xl"><CardContent className="space-y-3">
        {st === "anon" && <NoBackendNote>Bepul AI dan foydalanish uchun tizimga kiring.</NoBackendNote>}
        {st && st !== "anon" && !st.configured && <NoBackendNote>Bepul AI hali serverga ulanmagan (FREE_LLM_BASE_URL, FREE_LLM_API_KEY).</NoBackendNote>}
        {st && st !== "anon" && st.configured && <p className="text-xs text-muted-foreground">Bugun qolgan so'rovlar: {st.remaining} / {st.limit}</p>}
        <div className="space-y-3" aria-live="polite">
          {msgs.length === 0 && <p className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">Savolingizni yozing. Bepul modellar xato qilishi mumkin: muhim joylarni tekshiring.</p>}
          {msgs.map((x, i) => <div key={i} className={cn("whitespace-pre-wrap rounded-2xl p-3.5 text-sm", x.who === "me" ? "ml-8 bg-primary text-white" : x.who === "ai" ? "bg-muted" : "bg-amber/10")}>{x.text}</div>)}
          {busy && <div className="rounded-2xl bg-muted p-3.5 text-sm text-muted-foreground">AI o'ylamoqda...</div>}
        </div>
        <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); send(text); }}>
          <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="Savol yozing..." aria-label="Bepul AI uchun savol" maxLength={4000} />
          <Button size="icon" aria-label="Yuborish" disabled={off || busy}><Send className="h-4 w-4" /></Button>
        </form>
      </CardContent></Card>
    </>
  );
}
