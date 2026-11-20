"use client";
import * as React from "react";
import { AlertTriangle, Clock, Hand, LayoutGrid, LogOut, Maximize2, MessageCircle, Mic, MicOff, MonitorUp, PenLine, PhoneOff, Send, Users, Video, VideoOff, Volume2, VolumeX, Wifi } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/form";
import { cn } from "@/lib/utils";
import { describeMediaError } from "@/lib/dars";
import { MAX_CHAT, sortPeople } from "@/lib/voice-msg";
import { hasVideo, isFree, type VoiceMode } from "@/lib/voice-mode";
import { ClipAssembler, SEND_GAP_MS, parseChunk, splitClip, type Clip } from "@/lib/voice-clip";
import { VoiceNotePlayer, VoiceNoteRecorder } from "./voice-note";
import { ClassBar, HostTools, NoteBanner, ReactionBar } from "./class-tools";
import { ReactionLimiter, parseReaction } from "@/lib/reactions";
import { useClassTools } from "./use-class";
import { Whiteboard } from "./whiteboard";
import { Avatar, DockButton, ElapsedChip } from "./room-ui";
import type { VEngine, VPerson, VSession, VSource, VState } from "./voice-engine";

type Ctl = { code: string; mode: VoiceMode; k: string; h?: string };
type ChatItem = { id: number; name: string; host: boolean; text: string; ts: number; mine: boolean; clip?: { url: string; ms: number } };

const hhmm = (t: number) => { const d = new Date(t); return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`; };

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
  const [tab, setTab] = React.useState<"people" | "chat" | "tools">("people");
  const [free, setFree] = React.useState(false);
  const [unread, setUnread] = React.useState(0);
  const [audioBlocked, setAudioBlocked] = React.useState(false);
  const [mediaErr, setMediaErr] = React.useState("");
  const [busy, setBusy] = React.useState("");
  const [notice, setNotice] = React.useState("");
  const [canShare, setCanShare] = React.useState(false);
  const [recording, setRecording] = React.useState(false);
  const [joinedAt] = React.useState(() => Date.now());
  const [bubbles, setBubbles] = React.useState<{ id: number; e: string; x: number }[]>([]);
  const limiter = React.useMemo(() => new ReactionLimiter(), []);
  const myLimiter = React.useMemo(() => new ReactionLimiter(), []);
  const cx = useClassTools(engine, session, people, (p) => void allow(p, true));
  const lockRef = React.useRef(false);
  lockRef.current = cx.cls.lock;
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

  /** Reaksiya emojisini ekranda ko'taradi (3 soniyadan keyin o'chadi, bir vaqtda 14 tagacha). */
  const showBubble = React.useCallback((e: string) => {
    const id = Date.now() + Math.random();
    setBubbles((b) => [...b.slice(-13), { id, e, x: Math.round(Math.random() * 70) }]);
    setTimeout(() => setBubbles((b) => b.filter((x) => x.id !== id)), 3100);
  }, []);
  const video = hasVideo(ctl.mode);
  const modeFree = isFree(ctl.mode); // havola "hamma gapira oladi" rejimida yaratilgan (eski xonalar)
  const freeNow = modeFree || free;
  const boardOn = cx.cls.stage === "board";
  const me = people.find((p) => p.me);
  const isHost = session?.host ?? false;
  const locked = cx.cls.lock && !isHost; // chat ustoz tomonidan to'xtatilgan
  const canSpeak = me?.canSpeak ?? session?.canSpeak ?? false;
  const micOn = me?.micOn ?? false;
  const camOn = me?.camOn ?? false;
  const sharing = me?.screenOn ?? false;
  const raised = hands.has(session?.identity ?? "");

  // Sahna: ulashilgan ekran bo'lsa o'sha, bo'lmasa ustoz kamerasi.
  const screenOwner = people.find((p) => p.screenOn);
  const host = people.find((p) => p.host);
  const stage: { person: VPerson | undefined; source: VSource } | null = screenOwner ? { person: screenOwner, source: "screen" } : host?.camOn ? { person: host, source: "camera" } : null;
  const speakers = people.filter((p) => p.canSpeak).sort((x, y) => Number(y.host) - Number(x.host) || Number(y.me) - Number(x.me) || x.name.localeCompare(y.name, "uz"));
  const listeners = people.filter((p) => !p.canSpeak);
  const tiles = people.filter((p) => p.camOn && !(!boardOn && stage?.source === "camera" && stage.person?.identity === p.identity));

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
      else if (e.type === "free") setFree(e.on);
      else if (e.type === "json" && e.topic === "react") {
        const em = parseReaction(e.data);
        if (em && limiter.allow(e.from.identity)) showBubble(em);
      }
      else if (e.type === "clip") {
        if (lockRef.current && !e.from.host) return; // chat to'xtatilganda o'quvchidan ovozli xabar ham olinmaydi
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
          if (lockRef.current && !e.from.host) return;
          addChat({ id: ++idRef.current, name: e.from.name, host: e.from.host, text: m.text, ts: Date.now(), mine: false });
          if (tabRef.current !== "chat") setUnread((u) => u + 1);
        }
      }
    });
    engine.connect().then((s) => { if (live) setSession(s); }).catch((e: unknown) => { if (live) { setErr(e instanceof Error ? e.message : "Xonaga ulanib bo'lmadi."); setState("ended"); } });
    return () => { live = false; off(); engine.disconnect(); chatRef.current.forEach((m) => { if (m.clip) URL.revokeObjectURL(m.clip.url); }); };
  }, [engine, asm, addChat, limiter, showBubble]);

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
      setNotice(video ? "Sizga gapirish va kamerani yoqishga ruxsat berildi." : "Sizga gapirishga ruxsat berildi: mikrofonni yoqing.");
      void engine.send("hand", { t: "hand", up: false }).catch(() => {});
      setHands((h) => { const n = new Set(h); n.delete(me.identity); return n; });
    }
    if (prevCanSpeak.current === true && !me.canSpeak) setNotice(video ? "Ustoz ruxsatingizni oldi: mikrofon va kamera o'chdi." : "Ustoz ruxsatingizni oldi: mikrofon o'chdi.");
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
    if (!text || !session || locked) return;
    setDraft("");
    addChat({ id: ++idRef.current, name: me?.name ?? "Men", host: isHost, text, ts: Date.now(), mine: true });
    await engine.send("chat", { t: "chat", text }).catch(() => setErr("Xabar yuborilmadi. Aloqani tekshiring."));
  }
  /** Qisqa ogohlantirish: bir necha soniyadan keyin o'zi yo'qoladi. */
  function flash(msg: string) {
    setErr(msg);
    setTimeout(() => setErr((cur) => (cur === msg ? "" : cur)), 5000);
  }
  /** O'z reaksiyam: o'zimda darrov ko'rinadi, boshqalarga yuboriladi (tez-tez bosilsa, tashlanadi). */
  function react(e: string) {
    if (!myLimiter.allow("me")) return;
    showBubble(e);
    void engine.sendJson("react", { e }).catch(() => {});
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
  async function allow(p: { identity: string }, allowIt: boolean) {
    setBusy(p.identity); setErr("");
    try {
      await post({ action: "speak", identity: p.identity, allow: allowIt });
      if (allowIt) setHands((h) => { const n = new Set(h); n.delete(p.identity); return n; });
    } catch (e) { setErr(e instanceof Error ? e.message : "Amal bajarilmadi."); }
    setBusy("");
  }
  async function muteAll() {
    setBusy("all"); setErr("");
    try { await post({ action: "mute-all" }); setFree(false); } catch (e) { setErr(e instanceof Error ? e.message : "Amal bajarilmadi."); }
    setBusy("");
  }
  /** Ustoz: "hamma gapira oladi" ni jonli yoqadi yoki o'chiradi (xonada turib). */
  async function toggleFree(on: boolean) {
    setBusy("free"); setErr("");
    try { await post({ action: "free", on }); setFree(on); } catch (e) { setErr(e instanceof Error ? e.message : "Amal bajarilmadi."); }
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
  const handCount = people.filter((p) => !p.host && hands.has(p.identity)).length;
  const tabs = (isHost ? [["people", "Ishtirokchilar", Users], ["chat", "Yozishma", MessageCircle], ["tools", "Asboblar", LayoutGrid]] : [["people", "Ishtirokchilar", Users], ["chat", "Yozishma", MessageCircle]]) as readonly (readonly ["people" | "chat" | "tools", string, typeof Users])[];
  const board = (
    <Whiteboard store={cx.board} version={cx.boardVer} bg={cx.cls.bg} canDraw={cx.canDraw} isHost={isHost} net={cx.boardNet} onChange={cx.boardChanged}
      onBg={isHost ? (b) => cx.patch({ bg: b }) : undefined} imageUrl={cx.imageUrl}
      onPickImage={isHost ? (f) => void cx.placeImage(f).then((m) => { if (m) flash(m); }) : undefined} onClearImage={isHost ? cx.clearImage : undefined} />
  );

  return (
    <div className="relative isolate mx-auto w-full max-w-[1500px] pb-32">
      <div aria-hidden className="pointer-events-none absolute inset-x-0 -top-10 -z-10 h-[30rem] overflow-hidden">
        <div className="absolute -left-24 top-0 h-80 w-80 rounded-full bg-primary/20 blur-3xl" />
        <div className="absolute right-0 top-16 h-80 w-80 rounded-full bg-cyan-400/20 blur-3xl" />
        <div className="absolute left-1/3 top-48 h-60 w-60 rounded-full bg-amber/15 blur-3xl" />
      </div>
      <header className="relative flex flex-wrap items-center gap-x-3 gap-y-2 overflow-hidden rounded-3xl bg-gradient-to-r from-[#0B2D6B] via-primary to-[#00B8D4] px-4 py-3.5 text-white shadow-lg">
        <span aria-hidden className="pointer-events-none absolute -right-8 -top-10 h-36 w-36 rounded-full bg-white/10" />
        <span aria-hidden className="pointer-events-none absolute right-24 -bottom-12 h-28 w-28 rounded-full bg-white/10" />
        <span className="relative grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-white/20 ring-1 ring-white/30 backdrop-blur" aria-hidden>{video ? <Video className="h-6 w-6" /> : <Mic className="h-6 w-6" />}</span>
        <div className="relative min-w-[9rem] flex-1">
          <h1 className="truncate text-xl font-black leading-tight tracking-tight">{title || "Dars"}</h1>
          <p className="truncate text-xs font-semibold text-white/80">{video ? "Onlayn dars" : "Ovozli chat"} · {freeNow ? "hamma gapira oladi" : "gapirish ustoz ruxsati bilan"}</p>
        </div>
        <div className="relative flex flex-wrap items-center gap-2">
          <span className={cn("inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-extrabold backdrop-blur", !live && "text-amber-200")} aria-live="polite">
            <span aria-hidden className={cn("h-2 w-2 rounded-full", live ? "anim-live bg-red-500" : "bg-amber")} />{state === "connecting" ? "Ulanmoqda..." : state === "reconnecting" ? "Aloqa tiklanmoqda..." : "Jonli"}
          </span>
          {live && <span className="hidden items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-bold backdrop-blur sm:inline-flex"><Clock className="h-3.5 w-3.5" aria-hidden /><ElapsedChip since={joinedAt} /></span>}
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-bold backdrop-blur"><Users className="h-3.5 w-3.5" aria-hidden />{people.length}</span>
          {isHost && handCount > 0 && <span className="inline-flex animate-bounce items-center gap-1 rounded-full bg-amber px-3 py-1 text-xs font-extrabold text-white shadow" aria-label={`${handCount} ta qo'l ko'tarilgan`}><Hand className="h-3.5 w-3.5" aria-hidden />{handCount}</span>}
          <Button variant="outline" size="sm" className="border-white/30 bg-white/10 text-white hover:bg-white/20" onClick={onExit}><LogOut className="h-4 w-4" aria-hidden />Chiqish</Button>
        </div>
      </header>

      {cx.cls.note && <div className="mt-3"><NoteBanner note={cx.cls.note} onClear={isHost ? () => cx.host.setNote("") : undefined} /></div>}

      <div className="mt-3 space-y-2 empty:hidden">
        {audioBlocked && live && (
          <button type="button" onClick={() => void engine.startAudio()} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary p-3 text-sm font-bold text-white">
            <Volume2 className="h-5 w-5" aria-hidden />Ovoz eshitilishi uchun shu yerni bosing
          </button>
        )}
        {notice && <p role="status" className="flex items-center justify-between gap-2 rounded-2xl bg-success/10 p-3 text-sm font-semibold text-success">{notice}<button type="button" className="text-xs underline" onClick={() => setNotice("")}>Yopish</button></p>}
        {(err || mediaErr) && <p role="alert" className="flex gap-2 rounded-2xl bg-danger/10 p-3 text-sm text-danger"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />{err || mediaErr}</p>}
      </div>

      <div className="mt-3 grid grid-cols-[minmax(0,1fr)] gap-3 lg:grid-cols-[minmax(0,1fr)_24rem] lg:items-start">
        {/* Sahna: telefonda sahifa aylantirilganda ham tepada turadi (doskada chizayotganda emas) */}
        {(video || boardOn) && (
          <div className={cn("z-20 -mx-4 px-4 py-2 lg:static lg:z-auto lg:col-start-1 lg:row-start-1 lg:mx-0 lg:bg-transparent lg:p-0 lg:backdrop-blur-none", !(boardOn && cx.canDraw) && "sticky top-0 bg-background/90 backdrop-blur")}>
            {boardOn ? board : (
              <div ref={stageRef} className="relative aspect-video w-full overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-[#0f2347] to-slate-900 shadow-xl ring-1 ring-black/10" data-testid="stage">
                {stage?.person ? (
                  <VideoView key={`${stage.person.identity}-${stage.source}`} engine={engine} identity={stage.person.identity} source={stage.source} mirror={stage.source === "camera" && stage.person.me} />
                ) : (
                  <div className="grid h-full w-full place-items-center text-center text-white/80">
                    <div>
                      <Avatar name={host?.name ?? "?"} size={92} speaking={!!host?.speaking} className="mx-auto" />
                      <p className="mt-3 text-sm font-semibold">{host ? `${host.name}: kamera o'chiq` : "Ustoz hali kirmadi"}</p>
                    </div>
                  </div>
                )}
                {live && <span className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-red-600 px-2.5 py-1 text-[11px] font-black uppercase tracking-wider text-white shadow"><span aria-hidden className="anim-live h-1.5 w-1.5 rounded-full bg-white" />Jonli</span>}
                {stage?.person && (
                  <span className="absolute bottom-3 left-3 rounded-lg bg-black/60 px-2.5 py-1 text-xs font-bold text-white backdrop-blur">
                    {stage.source === "screen" ? "Ekran: " : ""}{stage.person.name}{stage.person.host ? " · Ustoz" : ""}
                  </span>
                )}
                {stage && typeof document !== "undefined" && document.fullscreenEnabled && (
                  <button type="button" onClick={() => void stageRef.current?.requestFullscreen?.()} className="absolute right-3 top-3 z-10 grid h-9 w-9 place-items-center rounded-lg bg-black/60 text-white backdrop-blur" aria-label="To'liq ekran"><Maximize2 className="h-4 w-4" aria-hidden /></button>
                )}
              </div>
            )}
          </div>
        )}

        <div className="min-w-0 space-y-3 lg:col-start-1 lg:row-start-2">
          {video && tiles.length > 0 && (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 xl:grid-cols-6" aria-label="Kamerasi yoqilgan ishtirokchilar">
              {tiles.map((p) => (
                <div key={p.identity} className={cn("relative aspect-video overflow-hidden rounded-xl bg-slate-900", p.speaking && "ring-4 ring-success/70")}>
                  <VideoView engine={engine} identity={p.identity} source="camera" mirror={p.me} />
                  <span className="absolute bottom-1 left-1 max-w-[90%] truncate rounded bg-black/60 px-1.5 py-0.5 text-[11px] font-bold text-white">{p.me ? "Siz" : p.name}</span>
                </div>
              ))}
            </div>
          )}

          {!video && (
            /* Ovozli chat (kamerasiz): gapira oladiganlar katta doirada, tinglovchilar pastda */
            <Card className="p-4" data-testid="voice-stage">
              <h2 className="text-sm font-extrabold">Gapira oladiganlar ({speakers.length})</h2>
              <ul className="mt-3 grid grid-cols-3 gap-3 sm:grid-cols-4 xl:grid-cols-6">
                {speakers.map((p) => (
                  <li key={p.identity} className="flex min-w-0 flex-col items-center text-center">
                    <span className="relative">
                      <Avatar name={p.name} size={68} speaking={p.speaking} />
                      <span className={cn("absolute -bottom-1 -right-1 grid h-6 w-6 place-items-center rounded-full bg-card shadow", p.micOn ? "text-success" : "text-muted-foreground")} aria-label={p.micOn ? "Mikrofon yoqiq" : "Mikrofon o'chiq"}>
                        {p.micOn ? <Mic className="h-3.5 w-3.5" aria-hidden /> : <MicOff className="h-3.5 w-3.5" aria-hidden />}
                      </span>
                    </span>
                    <span className="mt-1.5 w-full truncate text-xs font-bold">{p.me ? "Siz" : p.name}</span>
                    {p.host && <span className="text-[10px] font-bold text-primary">Ustoz</span>}
                  </li>
                ))}
                {speakers.length === 0 && <li className="col-span-full py-4 text-center text-sm text-muted-foreground">Hozircha hech kim gapira olmaydi. Ustoz kirishini kuting.</li>}
              </ul>
              {listeners.length > 0 && (
                <>
                  <p className="mt-4 text-xs font-bold uppercase tracking-wider text-muted-foreground">Tinglovchilar ({listeners.length})</p>
                  <ul className="mt-2 flex flex-wrap gap-2">
                    {listeners.map((p) => (
                      <li key={p.identity} className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-xs font-semibold">
                        {hands.has(p.identity) && <Hand className="h-3.5 w-3.5 text-amber" aria-label="qo'l ko'tardi" />}
                        {p.me ? "Siz" : p.name}
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </Card>
          )}

          <ClassBar api={cx} meId={session?.identity ?? ""} />
        </div>

        {/* Yon panel: ishtirokchilar, yozishma, ustoz asboblari */}
        <aside className="min-w-0 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:sticky lg:top-3">
          <Card className="flex flex-col overflow-hidden p-0 lg:h-[calc(100dvh-1.5rem)]">
            <div className={cn("grid shrink-0 gap-1 border-b border-border bg-muted/40 p-1.5", isHost ? "grid-cols-3" : "grid-cols-2")} role="tablist" aria-label="Bo'limlar">
              {tabs.map(([k, label, Icon]) => (
                <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)}
                  className={cn("relative flex h-10 items-center justify-center gap-1.5 rounded-xl text-sm font-bold transition-colors", tab === k ? "bg-gradient-to-r from-primary to-sky-500 text-white shadow-md" : "text-muted-foreground hover:bg-card")}>
                  <Icon className="h-4 w-4" aria-hidden /><span className="truncate">{label}</span>
                  {k === "chat" && unread > 0 && tab !== "chat" && <span className="absolute -right-0.5 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-danger px-1 text-[11px] text-white">{unread}</span>}
                  {k === "people" && isHost && handCount > 0 && tab !== "people" && <span className="absolute -right-0.5 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-amber px-1 text-[11px] text-white" aria-label={`${handCount} ta qo'l ko'tarilgan`}>{handCount}</span>}
                </button>
              ))}
            </div>

            <div className={cn("min-h-0 flex-1", tab === "chat" ? "flex h-[28rem] flex-col lg:h-auto" : "overflow-y-auto p-3")}>
              {tab === "people" && (
                <>
                  <div className="flex items-center justify-between gap-2 px-1 pb-2">
                    <h2 className="text-sm font-extrabold">Ishtirokchilar ({people.length})</h2>
                    {isHost && people.some((p) => !p.host && p.canSpeak) && (
                      <Button size="sm" variant="outline" loading={busy === "all"} onClick={() => void muteAll()}><MicOff className="h-4 w-4" aria-hidden />Hammaning ruxsatini olish</Button>
                    )}
                  </div>
                  {isHost && (
                    <div className="mb-2 rounded-xl bg-muted/60 p-2.5" role="group" aria-label="Kim gapira oladi">
                      <p className="px-0.5 pb-1.5 text-xs font-bold uppercase tracking-wider text-muted-foreground">Kim gapira oladi</p>
                      <div className="grid grid-cols-2 gap-1.5">
                        {([[false, "Ruxsat bilan"], [true, "Hamma"]] as const).map(([on, label]) => (
                          <button key={label} type="button" disabled={busy === "free" || modeFree || !live} aria-pressed={freeNow === on} onClick={() => { if (freeNow !== on) void toggleFree(on); }}
                            className={cn("h-10 rounded-lg border-2 text-sm font-bold disabled:opacity-60", freeNow === on ? "border-primary bg-primary text-white" : "border-border bg-card")}>
                            {label}
                          </button>
                        ))}
                      </div>
                      <p className="px-0.5 pt-1.5 text-xs text-muted-foreground">
                        {modeFree ? "Bu xona havolasi «hamma gapira oladi» rejimida yaratilgan; o'zgartirish uchun yangi xona yarating." : freeNow ? "Hamma ruxsatsiz gapira oladi (keyin kirganlar ham). «Ruxsat bilan» ni bossangiz, hamma yana qo'l ko'tarishi kerak." : "O'quvchi qo'l ko'taradi, siz ruxsat berasiz."}
                      </p>
                    </div>
                  )}
                  <ul className="space-y-0.5">
                    {sorted.map((p) => (
                      <li key={p.identity} className="rounded-xl px-1.5 py-2 hover:bg-muted/50">
                        <div className="flex items-center gap-2.5">
                          <Avatar name={p.name} speaking={p.speaking} />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-bold">{p.name}{p.me && <span className="font-normal text-muted-foreground"> (siz)</span>}</p>
                            <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground">
                              {p.host && <span className="rounded bg-primary/10 px-1.5 py-0.5 font-bold text-primary">Ustoz</span>}
                              {p.speaking && <span className="font-semibold text-success">gapiryapti</span>}
                              {p.screenOn && <span className="inline-flex items-center gap-1 font-semibold text-primary"><MonitorUp className="h-3 w-3" aria-hidden />ekranni ulashdi</span>}
                              {hands.has(p.identity) && <span className="inline-flex items-center gap-1 font-semibold text-amber"><Hand className="h-3 w-3" aria-hidden />qo&apos;l ko&apos;tardi</span>}
                              {cx.cls.draw.includes(p.identity) && <span className="inline-flex items-center gap-1 font-semibold text-primary"><PenLine className="h-3 w-3" aria-hidden />doskada</span>}
                            </p>
                          </div>
                          {video && <span className={cn("shrink-0", p.camOn ? "text-success" : "text-muted-foreground")} aria-label={p.camOn ? "Kamera yoqiq" : "Kamera o'chiq"}>
                            {p.camOn ? <Video className="h-4 w-4" aria-hidden /> : <VideoOff className="h-4 w-4" aria-hidden />}
                          </span>}
                          <span className={cn("shrink-0", p.micOn ? "text-success" : "text-muted-foreground")} aria-label={p.micOn ? "Mikrofon yoqiq" : "Mikrofon o'chiq"}>
                            {p.micOn ? <Mic className="h-4 w-4" aria-hidden /> : <MicOff className="h-4 w-4" aria-hidden />}
                          </span>
                        </div>
                        {isHost && !p.host && !p.me && (
                          <div className="mt-1.5 flex flex-wrap gap-1.5 pl-[3.1rem]">
                            {p.canSpeak
                              ? <Button size="sm" variant="outline" className="h-8 px-2.5 text-xs" loading={busy === p.identity} onClick={() => void allow(p, false)}>Ruxsatni olish</Button>
                              : <Button size="sm" variant={hands.has(p.identity) ? "success" : "outline"} className="h-8 px-2.5 text-xs" loading={busy === p.identity} onClick={() => void allow(p, true)}>Gapirishga ruxsat</Button>}
                            {boardOn && <Button size="sm" variant={cx.cls.draw.includes(p.identity) ? "primary" : "outline"} className="h-8 px-2.5 text-xs" onClick={() => cx.host.setDrawer(p.identity, !cx.cls.draw.includes(p.identity))}><PenLine className="h-3.5 w-3.5" aria-hidden />{cx.cls.draw.includes(p.identity) ? "Doskadan qaytarish" : "Doskaga chiqarish"}</Button>}
                          </div>
                        )}
                      </li>
                    ))}
                    {sorted.length === 0 && <li className="py-6 text-center text-sm text-muted-foreground">Ulanmoqda...</li>}
                  </ul>
                </>
              )}

              {tab === "tools" && isHost && <HostTools api={cx} title={title} />}

              {tab === "chat" && (
                <>
                  <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3" aria-live="polite" aria-label="Yozishmalar">
                    {chat.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">Hali xabar yo&apos;q. Savolingizni yozing yoki ovozli xabar yuboring.</p>}
                    {chat.map((m) => (
                      <div key={m.id} className={cn("max-w-[90%] rounded-2xl px-3 py-2 text-sm", m.mine ? "ml-auto bg-primary text-white" : m.host ? "bg-primary/10" : "bg-muted")}>
                        <p className={cn("text-[11px] font-bold", m.mine ? "text-white/80" : "text-muted-foreground")}>{m.mine ? "Siz" : m.name}{m.host && !m.mine ? " · Ustoz" : ""} · {hhmm(m.ts)}</p>
                        {m.clip ? <div className="pt-1"><VoiceNotePlayer url={m.clip.url} ms={m.clip.ms} mine={m.mine} /></div> : <p className="whitespace-pre-wrap break-words">{m.text}</p>}
                      </div>
                    ))}
                    <div ref={listEnd} />
                  </div>
                  {locked && <p role="status" className="mx-3 mb-2 rounded-xl bg-amber/10 p-2.5 text-center text-xs font-semibold text-amber">Ustoz chatni vaqtincha to&apos;xtatdi. Yozish uchun kuting.</p>}
                  <form className="flex gap-2 border-t border-border p-3" onSubmit={(e) => { e.preventDefault(); void sendChat(); }}>
                    {!recording && <Input value={draft} onChange={(e) => setDraft(e.target.value)} maxLength={MAX_CHAT} placeholder={locked ? "Chat to'xtatilgan" : "Xabar yozing..."} aria-label="Xabar" disabled={!live || locked} />}
                    <VoiceNoteRecorder disabled={!live || locked} onClip={sendClip} onError={flash} onRecordingChange={setRecording} />
                    {!recording && <Button type="submit" size="icon" disabled={!live || locked || !draft.trim()} aria-label="Yuborish"><Send className="h-4 w-4" aria-hidden /></Button>}
                  </form>
                </>
              )}
            </div>
          </Card>
        </aside>
      </div>

      {/* Reaksiyalar: hamma ekranida ko'tariladigan emoji */}
      <div aria-hidden className="pointer-events-none fixed bottom-28 right-3 z-30 h-72 w-24 sm:right-8">
        {bubbles.map((b) => <span key={b.id} className="anim-float-up absolute bottom-0 text-4xl drop-shadow" style={{ left: `${b.x}%` }}>{b.e}</span>)}
      </div>
      {live && <div className="fixed bottom-[5.9rem] right-3 z-30 sm:right-6"><ReactionBar onReact={react} /></div>}

      {/* Pastki panel */}
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-30 flex justify-center p-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
        <div className="pointer-events-auto flex max-w-full items-start justify-center gap-0.5 overflow-x-auto rounded-[1.75rem] border border-white/60 bg-card/90 px-2.5 py-1.5 shadow-[0_10px_40px_rgba(11,45,107,0.25)] ring-1 ring-black/5 backdrop-blur-xl" role="toolbar" aria-label="Dars boshqaruvi">
          {canSpeak ? (
            <>
              <DockButton hero label="Mikrofon" aria={micOn ? "Mikrofon yoqiq" : "Mikrofonni yoqish"} icon={micOn ? <Mic className="h-5 w-5" aria-hidden /> : <MicOff className="h-5 w-5" aria-hidden />} tone={micOn ? "on" : "primary"} pressed={micOn} loading={busy === "mic"} disabled={!live} pulse={!micOn && !!notice} onClick={() => void media("mic")} />
              {video && <DockButton label="Kamera" aria={camOn ? "Kamera yoqiq" : "Kamerani yoqish"} icon={camOn ? <Video className="h-5 w-5" aria-hidden /> : <VideoOff className="h-5 w-5" aria-hidden />} tone={camOn ? "on" : "default"} pressed={camOn} loading={busy === "cam"} disabled={!live} onClick={() => void media("cam")} />}
            </>
          ) : (
            <DockButton label={raised ? "Tushirish" : "Qo'l"} aria={raised ? "Qo'lni tushirish" : "Qo'l ko'tarish (gapirish uchun)"} icon={raised ? <VolumeX className="h-5 w-5" aria-hidden /> : <Hand className="h-5 w-5" aria-hidden />} tone={raised ? "amber" : "primary"} disabled={!live} onClick={() => void toggleHand()} />
          )}
          {video && isHost && canShare && (
            <DockButton label="Ekran" aria={sharing ? "Ulashishni to'xtatish" : "Ekranni ulashish"} icon={<MonitorUp className="h-5 w-5" aria-hidden />} tone={sharing ? "on" : "default"} pressed={sharing} loading={busy === "screen"} disabled={!live} onClick={() => void media("screen")} />
          )}
          {isHost && <DockButton label="Doska" aria={boardOn ? "Doskani yopish" : "Doskani ko'rsatish"} icon={<PenLine className="h-5 w-5" aria-hidden />} tone={boardOn ? "on" : "default"} pressed={boardOn} disabled={!live} onClick={() => cx.patch({ stage: boardOn ? "auto" : "board" })} />}
          {isHost && <DockButton label="Yakunlash" aria="Darsni yakunlash" icon={<PhoneOff className="h-5 w-5" aria-hidden />} tone="danger" loading={busy === "close"} onClick={() => void endForAll()} />}
        </div>
      </div>
    </div>
  );
}
