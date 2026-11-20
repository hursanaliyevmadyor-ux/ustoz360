"use client";
import * as React from "react";
import { AlertTriangle, Hand, LogOut, Maximize2, MessageCircle, Mic, MicOff, MonitorUp, PhoneOff, Send, Users, Video, VideoOff, Volume2, VolumeX, Wifi } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/form";
import { cn } from "@/lib/utils";
import { describeMediaError } from "@/lib/dars";
import { MAX_CHAT, sortPeople } from "@/lib/voice-msg";
import { ClipAssembler, SEND_GAP_MS, parseChunk, splitClip, type Clip } from "@/lib/voice-clip";
import { VoiceNotePlayer, VoiceNoteRecorder } from "./voice-note";
import type { VEngine, VPerson, VSession, VSource, VState } from "./voice-engine";

type Ctl = { code: string; mode: "s" | "e"; k: string; h?: string };
type ChatItem = { id: number; name: string; host: boolean; text: string; ts: number; mine: boolean; clip?: { url: string; ms: number } };

const hhmm = (t: number) => { const d = new Date(t); return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`; };
const initial = (n: string) => (n.trim()[0] ?? "?").toUpperCase();

/** Bitta ishtirokchining videosi (kamera yoki ekran). Faqat video bor paytda chiziladi. */
function VideoView({ engine, identity, source, mirror, className }: { engine: VEngine; identity: string; source: VSource; mirror?: boolean; className?: string }) {
  const ref = React.useRef<HTMLVideoElement>(null);
  React.useEffect(() => {
    const el = ref.current;
    return el ? engine.attachVideo(identity, el, source) : undefined;
  }, [engine, identity, source]);
  return <video ref={ref} autoPlay playsInline muted className={cn("h-full w-full bg-black", source === "camera" ? "object-cover" : "object-contain", mirror && "-scale-x-100", className)} aria-label={source === "screen" ? "Ulashilgan ekran" : "Kamera"} />;
}

/** Dars xonasi: video, ishtirokchilar, mikrofon, kamera, ekran ulashish, qo'l ko'tarish, yozishma; ustozga boshqaruv. */
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
  const [mediaErr, setMediaErr] = React.useState("");
  const [busy, setBusy] = React.useState("");
  const [notice, setNotice] = React.useState("");
  const [canShare, setCanShare] = React.useState(false);
  const [recording, setRecording] = React.useState(false);
  const idRef = React.useRef(0);
  const asm = React.useMemo(() => new ClipAssembler(), []);
  const lastClip = React.useRef(0);
  const chatRef = React.useRef<ChatItem[]>([]);
  const tabRef = React.useRef(tab);
  const prevCanSpeak = React.useRef<boolean | null>(null);
  const listEnd = React.useRef<HTMLDivElement>(null);
  const stageRef = React.useRef<HTMLDivElement>(null);
  tabRef.current = tab;
  chatRef.current = chat;

  /** Xabar qo'shadi; 200 tadan oshsa eskilari tashlanadi (ovozli xabarning vaqtinchalik havolasi ham bo'shatiladi). */
  const addChat = React.useCallback((item: ChatItem) => {
    setChat((c) => {
      const n = [...c, item];
      n.slice(0, Math.max(0, n.length - 200)).forEach((d) => { if (d.clip) URL.revokeObjectURL(d.clip.url); });
      return n.slice(-200);
    });
  }, []);

  const me = people.find((p) => p.me);
  const isHost = session?.host ?? false;
  const canSpeak = me?.canSpeak ?? session?.canSpeak ?? false;
  const micOn = me?.micOn ?? false;
  const camOn = me?.camOn ?? false;
  const sharing = me?.screenOn ?? false;
  const raised = hands.has(session?.identity ?? "");

  // Sahna: ulashilgan ekran bo'lsa o'sha, bo'lmasa ustoz kamerasi.
  const screenOwner = people.find((p) => p.screenOn);
  const host = people.find((p) => p.host);
  const stage: { person: VPerson | undefined; source: VSource } | null = screenOwner ? { person: screenOwner, source: "screen" } : host?.camOn ? { person: host, source: "camera" } : null;
  const tiles = people.filter((p) => p.camOn && !(stage?.source === "camera" && stage.person?.identity === p.identity));

  const post = React.useCallback(async (body: Record<string, unknown>) => {
    const r = await fetch("/api/dars/control", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...ctl, ...body }) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error((d as { error?: string }).error ?? "Amal bajarilmadi.");
    return d;
  }, [ctl]);

  React.useEffect(() => { setCanShare(typeof navigator.mediaDevices?.getDisplayMedia === "function" && !/Android|iPhone|iPad/i.test(navigator.userAgent)); }, []);

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
      else if (e.type === "clip") {
        const c = parseChunk(e.chunk);
        const clip = c && asm.add(e.from.identity, c);
        if (!clip) return;
        const url = URL.createObjectURL(new Blob([clip.bytes as BlobPart], { type: clip.mime }));
        addChat({ id: ++idRef.current, name: e.from.name, host: e.from.host, text: "", ts: Date.now(), mine: false, clip: { url, ms: clip.ms } });
        if (tabRef.current !== "chat") setUnread((u) => u + 1);
      } else if (e.type === "data") {
        if (e.msg.t === "hand") {
          const m = e.msg;
          setHands((h) => { const n = new Set(h); if (m.up) n.add(e.from.identity); else n.delete(e.from.identity); return n; });
        } else {
          const m = e.msg;
          addChat({ id: ++idRef.current, name: e.from.name, host: e.from.host, text: m.text, ts: Date.now(), mine: false });
          if (tabRef.current !== "chat") setUnread((u) => u + 1);
        }
      }
    });
    engine.connect().then((s) => { if (live) setSession(s); }).catch((e: unknown) => { if (live) { setErr(e instanceof Error ? e.message : "Xonaga ulanib bo'lmadi."); setState("ended"); } });
    return () => { live = false; off(); engine.disconnect(); chatRef.current.forEach((m) => { if (m.clip) URL.revokeObjectURL(m.clip.url); }); };
  }, [engine, asm, addChat]);

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
      setNotice("Sizga gapirish va kamerani yoqishga ruxsat berildi.");
      void engine.send("hand", { t: "hand", up: false }).catch(() => {});
      setHands((h) => { const n = new Set(h); n.delete(me.identity); return n; });
    }
    if (prevCanSpeak.current === true && !me.canSpeak) setNotice("Ustoz ruxsatingizni oldi: mikrofon va kamera o'chdi.");
    prevCanSpeak.current = me.canSpeak;
  }, [me, isHost, engine]);

  React.useEffect(() => { if (tab === "chat") { setUnread(0); listEnd.current?.scrollIntoView({ block: "end" }); } }, [tab, chat]);

  async function media(kind: "mic" | "cam" | "screen") {
    setMediaErr(""); setBusy(kind);
    try {
      if (kind === "mic") await engine.setMic(!micOn);
      else if (kind === "cam") await engine.setCam(!camOn);
      else await engine.setScreen(!sharing);
    } catch (e) { setMediaErr(kind === "screen" ? "Ekranni ulashib bo'lmadi." : describeMediaError(e, kind === "mic" ? "mikrofon" : "kamera")); }
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
    addChat({ id: ++idRef.current, name: me?.name ?? "Men", host: isHost, text, ts: Date.now(), mine: true });
    await engine.send("chat", { t: "chat", text }).catch(() => setErr("Xabar yuborilmadi. Aloqani tekshiring."));
  }
  /** Qisqa ogohlantirish: bir necha soniyadan keyin o'zi yo'qoladi. */
  function flash(msg: string) {
    setErr(msg);
    setTimeout(() => setErr((cur) => (cur === msg ? "" : cur)), 5000);
  }
  async function sendClip(clip: Clip) {
    if (!session) return;
    setErr("");
    const wait = lastClip.current + SEND_GAP_MS - Date.now();
    if (wait > 0) await new Promise((r) => setTimeout(r, wait)); // ketma-ket xabarlar orasida qisqa tanaffus
    const id = crypto.getRandomValues(new Uint32Array(1))[0] ?? 0;
    const parts = splitClip(id, clip);
    if (!parts) { setErr("Ovozli xabar juda uzun. Qisqaroq yozing."); return; }
    lastClip.current = Date.now();
    const url = URL.createObjectURL(new Blob([clip.bytes as BlobPart], { type: clip.mime }));
    addChat({ id: ++idRef.current, name: me?.name ?? "Men", host: isHost, text: "", ts: Date.now(), mine: true, clip: { url, ms: clip.ms } });
    try { for (const part of parts) await engine.sendClip(part); } catch { setErr("Ovozli xabar yuborilmadi. Aloqani tekshiring."); }
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
    <div className="mx-auto w-full max-w-6xl space-y-3 pb-28 lg:pb-4">
      <Card className="flex flex-wrap items-center justify-between gap-3 p-4">
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Onlayn dars</p>
          <h1 className="truncate text-xl font-extrabold">{title || "Dars"}</h1>
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
      {(err || mediaErr) && <p role="alert" className="flex gap-2 rounded-2xl bg-danger/10 p-3 text-sm text-danger"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />{err || mediaErr}</p>}

      <div className="grid gap-3 lg:grid-cols-[1fr_20rem]">
        <div className="min-w-0 space-y-3">
          {/* Sahna: ustoz kamerasi yoki ulashilgan ekran */}
          <div ref={stageRef} className="relative aspect-video w-full overflow-hidden rounded-2xl bg-slate-900" data-testid="stage">
            {stage?.person ? (
              <VideoView key={`${stage.person.identity}-${stage.source}`} engine={engine} identity={stage.person.identity} source={stage.source} mirror={stage.source === "camera" && stage.person.me} />
            ) : (
              <div className="grid h-full w-full place-items-center text-center text-white/80">
                <div>
                  <span className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-white/10 text-3xl font-extrabold">{host ? initial(host.name) : "?"}</span>
                  <p className="mt-3 text-sm font-semibold">{host ? `${host.name}: kamera o'chiq` : "Ustoz hali kirmadi"}</p>
                </div>
              </div>
            )}
            {stage?.person && (
              <span className="absolute bottom-2 left-2 rounded-lg bg-black/60 px-2.5 py-1 text-xs font-bold text-white">
                {stage.source === "screen" ? "Ekran: " : ""}{stage.person.name}{stage.person.host ? " · Ustoz" : ""}
              </span>
            )}
            {stage && typeof document !== "undefined" && document.fullscreenEnabled && (
              <button type="button" onClick={() => void stageRef.current?.requestFullscreen?.()} className="absolute right-2 top-2 grid h-9 w-9 place-items-center rounded-lg bg-black/60 text-white" aria-label="To'liq ekran"><Maximize2 className="h-4 w-4" aria-hidden /></button>
            )}
          </div>

          {tiles.length > 0 && (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4" aria-label="Kamerasi yoqilgan ishtirokchilar">
              {tiles.map((p) => (
                <div key={p.identity} className={cn("relative aspect-video overflow-hidden rounded-xl bg-slate-900", p.speaking && "ring-4 ring-success/70")}>
                  <VideoView engine={engine} identity={p.identity} source="camera" mirror={p.me} />
                  <span className="absolute bottom-1 left-1 max-w-[90%] truncate rounded bg-black/60 px-1.5 py-0.5 text-[11px] font-bold text-white">{p.me ? "Siz" : p.name}</span>
                </div>
              ))}
            </div>
          )}

          <div className="flex gap-2 lg:hidden" role="tablist" aria-label="Bo'limlar">
            {([["people", "Ishtirokchilar", Users], ["chat", "Yozishma", MessageCircle]] as const).map(([k, label, Icon]) => (
              <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)}
                className={cn("relative flex h-11 flex-1 items-center justify-center gap-2 rounded-xl border text-sm font-bold", tab === k ? "border-primary bg-primary text-white" : "border-border bg-card")}>
                <Icon className="h-4 w-4" aria-hidden />{label}
                {k === "chat" && unread > 0 && tab !== "chat" && <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-danger px-1 text-[11px] text-white">{unread}</span>}
              </button>
            ))}
          </div>

          <Card className={cn("p-3", tab !== "people" && "hidden lg:block")}>
            <div className="flex items-center justify-between gap-2 px-1 pb-2">
              <h2 className="text-sm font-extrabold">Ishtirokchilar ({people.length})</h2>
              {isHost && people.some((p) => !p.host && p.canSpeak) && (
                <Button size="sm" variant="outline" loading={busy === "all"} onClick={() => void muteAll()}><MicOff className="h-4 w-4" aria-hidden />Hammaning ruxsatini olish</Button>
              )}
            </div>
            <ul className="divide-y divide-border">
              {sorted.map((p) => (
                <li key={p.identity} className="flex items-center gap-3 py-2.5">
                  <span className={cn("grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary/10 text-sm font-extrabold text-primary transition-shadow", p.speaking && "ring-4 ring-success/60")} aria-hidden>{initial(p.name)}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-bold">{p.name}{p.me && <span className="font-normal text-muted-foreground"> (siz)</span>}</p>
                    <p className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                      {p.host && <span className="rounded bg-primary/10 px-1.5 py-0.5 font-bold text-primary">Ustoz</span>}
                      {p.speaking && <span className="font-semibold text-success">gapiryapti</span>}
                      {p.screenOn && <span className="inline-flex items-center gap-1 font-semibold text-primary"><MonitorUp className="h-3.5 w-3.5" aria-hidden />ekranni ulashdi</span>}
                      {hands.has(p.identity) && <span className="inline-flex items-center gap-1 font-semibold text-amber"><Hand className="h-3.5 w-3.5" aria-hidden />qo&apos;l ko&apos;tardi</span>}
                    </p>
                  </div>
                  <span className={cn("shrink-0", p.camOn ? "text-success" : "text-muted-foreground")} aria-label={p.camOn ? "Kamera yoqiq" : "Kamera o'chiq"}>
                    {p.camOn ? <Video className="h-5 w-5" aria-hidden /> : <VideoOff className="h-5 w-5" aria-hidden />}
                  </span>
                  <span className={cn("shrink-0", p.micOn ? "text-success" : "text-muted-foreground")} aria-label={p.micOn ? "Mikrofon yoqiq" : "Mikrofon o'chiq"}>
                    {p.micOn ? <Mic className="h-5 w-5" aria-hidden /> : <MicOff className="h-5 w-5" aria-hidden />}
                  </span>
                  {isHost && !p.host && !p.me && (
                    p.canSpeak
                      ? <Button size="sm" variant="outline" loading={busy === p.identity} onClick={() => void allow(p, false)}>Ruxsatni olish</Button>
                      : <Button size="sm" variant={hands.has(p.identity) ? "success" : "outline"} loading={busy === p.identity} onClick={() => void allow(p, true)}>Gapirishga ruxsat</Button>
                  )}
                </li>
              ))}
              {sorted.length === 0 && <li className="py-6 text-center text-sm text-muted-foreground">Ulanmoqda...</li>}
            </ul>
          </Card>
        </div>

        <Card className={cn("flex h-[26rem] flex-col p-3 lg:h-auto lg:min-h-[22rem]", tab !== "chat" && "hidden lg:flex")}>
          <h2 className="px-1 pb-2 text-sm font-extrabold">Yozishma</h2>
          <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-1" aria-live="polite" aria-label="Yozishmalar">
            {chat.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">Hali xabar yo&apos;q. Savolingizni yozing yoki ovozli xabar yuboring.</p>}
            {chat.map((m) => (
              <div key={m.id} className={cn("max-w-[90%] rounded-2xl px-3 py-2 text-sm", m.mine ? "ml-auto bg-primary text-white" : m.host ? "bg-primary/10" : "bg-muted")}>
                <p className={cn("text-[11px] font-bold", m.mine ? "text-white/80" : "text-muted-foreground")}>{m.mine ? "Siz" : m.name}{m.host && !m.mine ? " · Ustoz" : ""} · {hhmm(m.ts)}</p>
                {m.clip ? <div className="pt-1"><VoiceNotePlayer url={m.clip.url} ms={m.clip.ms} mine={m.mine} /></div> : <p className="whitespace-pre-wrap break-words">{m.text}</p>}
              </div>
            ))}
            <div ref={listEnd} />
          </div>
          <form className="mt-2 flex gap-2" onSubmit={(e) => { e.preventDefault(); void sendChat(); }}>
            {!recording && <Input value={draft} onChange={(e) => setDraft(e.target.value)} maxLength={MAX_CHAT} placeholder="Xabar yozing..." aria-label="Xabar" disabled={!live} />}
            <VoiceNoteRecorder disabled={!live} onClip={sendClip} onError={flash} onRecordingChange={setRecording} />
            {!recording && <Button type="submit" size="icon" disabled={!live || !draft.trim()} aria-label="Yuborish"><Send className="h-4 w-4" aria-hidden /></Button>}
          </form>
        </Card>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-card/95 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur lg:static lg:rounded-2xl lg:border lg:shadow-soft">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-center gap-2">
          {canSpeak ? (
            <>
              <Button size="lg" variant={micOn ? "success" : "primary"} loading={busy === "mic"} disabled={!live} aria-pressed={micOn} onClick={() => void media("mic")} className={cn(!micOn && notice && "animate-pulse")}>
                {micOn ? <><Mic className="h-5 w-5" aria-hidden />Mikrofon yoqiq</> : <><MicOff className="h-5 w-5" aria-hidden />Mikrofonni yoqish</>}
              </Button>
              <Button size="lg" variant={camOn ? "success" : "outline"} loading={busy === "cam"} disabled={!live} aria-pressed={camOn} onClick={() => void media("cam")}>
                {camOn ? <><Video className="h-5 w-5" aria-hidden />Kamera yoqiq</> : <><VideoOff className="h-5 w-5" aria-hidden />Kamerani yoqish</>}
              </Button>
            </>
          ) : (
            <Button size="lg" variant={raised ? "outline" : "primary"} disabled={!live} onClick={() => void toggleHand()} className="min-w-52">
              {raised ? <><VolumeX className="h-5 w-5" aria-hidden />Qo&apos;lni tushirish</> : <><Hand className="h-5 w-5" aria-hidden />Qo&apos;l ko&apos;tarish (gapirish uchun)</>}
            </Button>
          )}
          {isHost && canShare && (
            <Button size="lg" variant={sharing ? "success" : "outline"} loading={busy === "screen"} disabled={!live} aria-pressed={sharing} onClick={() => void media("screen")}>
              <MonitorUp className="h-5 w-5" aria-hidden />{sharing ? "Ulashishni to'xtatish" : "Ekranni ulashish"}
            </Button>
          )}
          {isHost && <Button size="lg" variant="danger" loading={busy === "close"} onClick={() => void endForAll()}><PhoneOff className="h-5 w-5" aria-hidden />Darsni yakunlash</Button>}
        </div>
      </div>
    </div>
  );
}
