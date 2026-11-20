"use client";
import * as React from "react";
import { AlertTriangle, Hand, LogOut, Mic, MicOff, MessageCircle, PhoneOff, Send, Users, Volume2, VolumeX, Wifi } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/form";
import { cn } from "@/lib/utils";
import { describeMediaError } from "@/lib/dars";
import { MAX_CHAT, sortPeople } from "@/lib/voice-msg";
import type { VEngine, VPerson, VSession, VState } from "./voice-engine";

type Ctl = { code: string; mode: "s" | "e"; k: string; h?: string };
type ChatItem = { id: number; name: string; host: boolean; text: string; ts: number; mine: boolean };

const hhmm = (t: number) => { const d = new Date(t); return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`; };

/** Ovozli dars xonasi: ishtirokchilar, mikrofon, qo'l ko'tarish, yozishma; ustozga boshqaruv tugmalari. */
export function VoiceRoom({ engine, ctl, title, onExit }: { engine: VEngine; ctl: Ctl; title: string; onExit: () => void }) {
  const [state, setState] = React.useState<VState>("connecting");
  const [err, setErr] = React.useState("");
  const [session, setSession] = React.useState<VSession | null>(null);
  const [people, setPeople] = React.useState<VPerson[]>([]);
  const [hands, setHands] = React.useState<ReadonlySet<string>>(new Set());
  const [chat, setChat] = React.useState<ChatItem[]>([]);
  const [draft, setDraft] = React.useState("");
  const [tab, setTab] = React.useState<"people" | "chat">("people");
  const [unread, setUnread] = React.useState(0);
  const [audioBlocked, setAudioBlocked] = React.useState(false);
  const [micErr, setMicErr] = React.useState("");
  const [busy, setBusy] = React.useState("");
  const [notice, setNotice] = React.useState("");
  const idRef = React.useRef(0);
  const tabRef = React.useRef(tab);
  const meRef = React.useRef<VSession | null>(null);
  const prevCanSpeak = React.useRef<boolean | null>(null);
  const listEnd = React.useRef<HTMLDivElement>(null);
  tabRef.current = tab;

  const me = people.find((p) => p.me);
  const isHost = session?.host ?? false;
  const canSpeak = me?.canSpeak ?? session?.canSpeak ?? false;
  const micOn = me?.micOn ?? false;
  const raised = hands.has(session?.identity ?? "");

  const post = React.useCallback(async (body: Record<string, unknown>) => {
    const r = await fetch("/api/dars/control", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...ctl, ...body }) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error((d as { error?: string }).error ?? "Amal bajarilmadi.");
    return d;
  }, [ctl]);

  // Ulanish
  React.useEffect(() => {
    let live = true;
    const off = engine.on((e) => {
      if (!live) return;
      if (e.type === "roster") {
        setPeople(e.people);
        const ids = new Set(e.people.map((p) => p.identity));
        setHands((h) => { const n = new Set([...h].filter((id) => ids.has(id))); return n.size === h.size ? h : n; });
      } else if (e.type === "state") setState(e.state);
      else if (e.type === "audio") setAudioBlocked(e.blocked);
      else if (e.type === "data") {
        if (e.msg.t === "hand") {
          const m = e.msg;
          setHands((h) => { const n = new Set(h); if (m.up) n.add(e.from.identity); else n.delete(e.from.identity); return n; });
        } else {
          const m = e.msg;
          setChat((c) => [...c, { id: ++idRef.current, name: e.from.name, host: e.from.host, text: m.text, ts: Date.now(), mine: false }].slice(-200));
          if (tabRef.current !== "chat") setUnread((u) => u + 1);
        }
      }
    });
    engine.connect().then((s) => { if (live) { meRef.current = s; setSession(s); } }).catch((e: unknown) => { if (live) { setErr(e instanceof Error ? e.message : "Xonaga ulanib bo'lmadi."); setState("ended"); } });
    return () => { live = false; off(); engine.disconnect(); };
  }, [engine]);

  // Ekran o'chib qolmasin (telefonda dars paytida)
  React.useEffect(() => {
    if (state !== "live") return;
    let lock: { release: () => Promise<void> } | null = null;
    const wl = (navigator as unknown as { wakeLock?: { request: (t: "screen") => Promise<{ release: () => Promise<void> }> } }).wakeLock;
    void wl?.request("screen").then((l) => { lock = l; }).catch(() => {});
    return () => { void lock?.release().catch(() => {}); };
  }, [state]);

  // Gapirishga ruxsat berilsa: qo'l tushadi va ogohlantirish chiqadi
  React.useEffect(() => {
    if (!me || isHost) return;
    if (prevCanSpeak.current === false && me.canSpeak) {
      setNotice("Sizga gapirishga ruxsat berildi. Mikrofonni yoqing.");
      void engine.send("hand", { t: "hand", up: false }).catch(() => {});
      setHands((h) => { const n = new Set(h); n.delete(me.identity); return n; });
    }
    if (prevCanSpeak.current === true && !me.canSpeak) setNotice("Ustoz ovozingizni yopdi.");
    prevCanSpeak.current = me.canSpeak;
  }, [me, isHost, engine]);

  React.useEffect(() => { if (tab === "chat") { setUnread(0); listEnd.current?.scrollIntoView({ block: "end" }); } }, [tab, chat]);

  async function toggleMic() {
    setMicErr(""); setBusy("mic");
    try { await engine.setMic(!micOn); } catch (e) { setMicErr(describeMediaError(e, "mikrofon")); }
    setBusy("");
  }
  async function toggleHand() {
    if (!session) return;
    const up = !raised;
    setHands((h) => { const n = new Set(h); if (up) n.add(session.identity); else n.delete(session.identity); return n; });
    await engine.send("hand", { t: "hand", up }).catch(() => {});
  }
  async function sendChat() {
    const text = draft.trim().slice(0, MAX_CHAT);
    if (!text || !session) return;
    setDraft("");
    setChat((c) => [...c, { id: ++idRef.current, name: me?.name ?? "Men", host: isHost, text, ts: Date.now(), mine: true }].slice(-200));
    await engine.send("chat", { t: "chat", text }).catch(() => setErr("Xabar yuborilmadi. Aloqani tekshiring."));
  }
  async function allow(p: VPerson, allowIt: boolean) {
    setBusy(p.identity); setErr("");
    try {
      await post({ action: "speak", identity: p.identity, allow: allowIt });
      if (allowIt) setHands((h) => { const n = new Set(h); n.delete(p.identity); return n; });
    } catch (e) { setErr(e instanceof Error ? e.message : "Amal bajarilmadi."); }
    setBusy("");
  }
  async function muteAll() {
    setBusy("all"); setErr("");
    try { await post({ action: "mute-all" }); } catch (e) { setErr(e instanceof Error ? e.message : "Amal bajarilmadi."); }
    setBusy("");
  }
  async function endForAll() {
    if (!window.confirm("Dars hamma uchun yakunlanadi. Davom etasizmi?")) return;
    setBusy("close");
    try { await post({ action: "close" }); } catch (e) { setErr(e instanceof Error ? e.message : "Amal bajarilmadi."); }
    setBusy("");
  }

  if (state === "ended") {
    return (
      <Card className="mx-auto max-w-xl p-6 text-center" aria-live="polite">
        <PhoneOff className="mx-auto mb-3 h-10 w-10 text-muted-foreground" aria-hidden />
        <h2 className="text-xl font-extrabold">{err ? "Ulanib bo'lmadi" : "Dars yakunlandi"}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{err || "Siz xonadan chiqdingiz yoki ustoz darsni yakunladi. Havolani qayta bossangiz, xonaga qaytasiz."}</p>
        <Button className="mt-4" onClick={onExit}>Orqaga qaytish</Button>
      </Card>
    );
  }

  const sorted = sortPeople(people, hands);
  const live = state === "live";

  return (
    <div className="mx-auto w-full max-w-4xl space-y-3 pb-28 lg:pb-4">
      <Card className="flex flex-wrap items-center justify-between gap-3 p-4">
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Ovozli dars</p>
          <h1 className="truncate text-xl font-extrabold">{title || "Onlayn dars"}</h1>
        </div>
        <div className="flex items-center gap-2">
          <span className={cn("inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold", live ? "bg-success/15 text-success" : "bg-amber/15 text-amber")} aria-live="polite">
            <Wifi className="h-3.5 w-3.5" aria-hidden />{state === "connecting" ? "Ulanmoqda..." : state === "reconnecting" ? "Aloqa tiklanmoqda..." : "Jonli"}
          </span>
          <span className="inline-flex items-center gap-1 text-sm text-muted-foreground"><Users className="h-4 w-4" aria-hidden />{people.length}</span>
          <Button variant="outline" size="sm" onClick={onExit}><LogOut className="h-4 w-4" aria-hidden />Chiqish</Button>
        </div>
      </Card>

      {audioBlocked && live && (
        <button type="button" onClick={() => void engine.startAudio()} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary p-3 text-sm font-bold text-white">
          <Volume2 className="h-5 w-5" aria-hidden />Ovoz eshitilishi uchun shu yerni bosing
        </button>
      )}
      {notice && <p role="status" className="flex items-center justify-between gap-2 rounded-2xl bg-success/10 p-3 text-sm font-semibold text-success">{notice}<button type="button" className="text-xs underline" onClick={() => setNotice("")}>Yopish</button></p>}
      {(err || micErr) && <p role="alert" className="flex gap-2 rounded-2xl bg-danger/10 p-3 text-sm text-danger"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />{err || micErr}</p>}

      <div className="flex gap-2 lg:hidden" role="tablist" aria-label="Bo'limlar">
        {([["people", "Ishtirokchilar", Users], ["chat", "Yozishma", MessageCircle]] as const).map(([k, label, Icon]) => (
          <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)}
            className={cn("relative flex h-11 flex-1 items-center justify-center gap-2 rounded-xl border text-sm font-bold", tab === k ? "border-primary bg-primary text-white" : "border-border bg-card")}>
            <Icon className="h-4 w-4" aria-hidden />{label}
            {k === "chat" && unread > 0 && tab !== "chat" && <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-danger px-1 text-[11px] text-white">{unread}</span>}
          </button>
        ))}
      </div>

      <div className="grid gap-3 lg:grid-cols-[1fr_20rem]">
        <Card className={cn("p-3", tab !== "people" && "hidden lg:block")}>
          <div className="flex items-center justify-between gap-2 px-1 pb-2">
            <h2 className="text-sm font-extrabold">Ishtirokchilar ({people.length})</h2>
            {isHost && people.some((p) => !p.host && p.canSpeak) && (
              <Button size="sm" variant="outline" loading={busy === "all"} onClick={() => void muteAll()}><MicOff className="h-4 w-4" aria-hidden />Hammaning ovozini yopish</Button>
            )}
          </div>
          <ul className="divide-y divide-border">
            {sorted.map((p) => (
              <li key={p.identity} className="flex items-center gap-3 py-2.5">
                <span className={cn("grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary/10 text-sm font-extrabold text-primary transition-shadow", p.speaking && "ring-4 ring-success/60")} aria-hidden>
                  {(p.name.trim()[0] ?? "?").toUpperCase()}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold">{p.name}{p.me && <span className="font-normal text-muted-foreground"> (siz)</span>}</p>
                  <p className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                    {p.host && <span className="rounded bg-primary/10 px-1.5 py-0.5 font-bold text-primary">Ustoz</span>}
                    {p.speaking && <span className="font-semibold text-success">gapiryapti</span>}
                    {hands.has(p.identity) && <span className="inline-flex items-center gap-1 font-semibold text-amber"><Hand className="h-3.5 w-3.5" aria-hidden />qo&apos;l ko&apos;tardi</span>}
                  </p>
                </div>
                <span className={cn("shrink-0", p.micOn ? "text-success" : "text-muted-foreground")} aria-label={p.micOn ? "Mikrofon yoqiq" : "Mikrofon o'chiq"}>
                  {p.micOn ? <Mic className="h-5 w-5" aria-hidden /> : <MicOff className="h-5 w-5" aria-hidden />}
                </span>
                {isHost && !p.host && !p.me && (
                  p.canSpeak
                    ? <Button size="sm" variant="outline" loading={busy === p.identity} onClick={() => void allow(p, false)}>Ovozini yopish</Button>
                    : <Button size="sm" variant={hands.has(p.identity) ? "success" : "outline"} loading={busy === p.identity} onClick={() => void allow(p, true)}>Gapirishga ruxsat</Button>
                )}
              </li>
            ))}
            {sorted.length === 0 && <li className="py-6 text-center text-sm text-muted-foreground">Ulanmoqda...</li>}
          </ul>
        </Card>

        <Card className={cn("flex h-[26rem] flex-col p-3 lg:h-auto lg:min-h-[22rem]", tab !== "chat" && "hidden lg:flex")}>
          <h2 className="px-1 pb-2 text-sm font-extrabold">Yozishma</h2>
          <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-1" aria-live="polite" aria-label="Yozishmalar">
            {chat.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">Hali xabar yo&apos;q. Savolingizni shu yerga yozing.</p>}
            {chat.map((m) => (
              <div key={m.id} className={cn("max-w-[90%] rounded-2xl px-3 py-2 text-sm", m.mine ? "ml-auto bg-primary text-white" : m.host ? "bg-primary/10" : "bg-muted")}>
                <p className={cn("text-[11px] font-bold", m.mine ? "text-white/80" : "text-muted-foreground")}>{m.mine ? "Siz" : m.name}{m.host && !m.mine ? " · Ustoz" : ""} · {hhmm(m.ts)}</p>
                <p className="whitespace-pre-wrap break-words">{m.text}</p>
              </div>
            ))}
            <div ref={listEnd} />
          </div>
          <form className="mt-2 flex gap-2" onSubmit={(e) => { e.preventDefault(); void sendChat(); }}>
            <Input value={draft} onChange={(e) => setDraft(e.target.value)} maxLength={MAX_CHAT} placeholder="Xabar yozing..." aria-label="Xabar" disabled={!live} />
            <Button type="submit" size="icon" disabled={!live || !draft.trim()} aria-label="Yuborish"><Send className="h-4 w-4" aria-hidden /></Button>
          </form>
        </Card>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-card/95 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur lg:static lg:rounded-2xl lg:border lg:shadow-soft">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-center gap-2">
          {canSpeak ? (
            <Button size="lg" variant={micOn ? "success" : "primary"} loading={busy === "mic"} disabled={!live} onClick={() => void toggleMic()} className={cn("min-w-52", !micOn && notice && "animate-pulse")}>
              {micOn ? <><Mic className="h-5 w-5" aria-hidden />Mikrofon yoqiq: o&apos;chirish</> : <><MicOff className="h-5 w-5" aria-hidden />Mikrofonni yoqish</>}
            </Button>
          ) : (
            <Button size="lg" variant={raised ? "outline" : "primary"} disabled={!live} onClick={() => void toggleHand()} className="min-w-52">
              {raised ? <><VolumeX className="h-5 w-5" aria-hidden />Qo&apos;lni tushirish</> : <><Hand className="h-5 w-5" aria-hidden />Qo&apos;l ko&apos;tarish (gapirish uchun)</>}
            </Button>
          )}
          {isHost && <Button size="lg" variant="danger" loading={busy === "close"} onClick={() => void endForAll()}><PhoneOff className="h-5 w-5" aria-hidden />Darsni yakunlash</Button>}
        </div>
      </div>
    </div>
  );
}
