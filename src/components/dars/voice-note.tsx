"use client";
import * as React from "react";
import { Mic, Pause, Play, Send, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { describeMediaError } from "@/lib/dars";
import { MAX_CLIP_BYTES, MAX_CLIP_MS, MIN_CLIP_MS, clipMime, clipTime, type Clip } from "@/lib/voice-clip";

/** Brauzer yoza oladigan format: avval mp4 (hamma qurilmada eshitiladi), keyin webm, ogg. */
function pickType(): string {
  const want = ["audio/mp4", "audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus"];
  return want.find((t) => { try { return MediaRecorder.isTypeSupported(t); } catch { return false; } }) ?? "";
}

type Rec = { mr: MediaRecorder; stream: MediaStream; chunks: Blob[]; size: number; t0: number; cancelled: boolean; timer: number; ms: number };

/**
 * Chatdagi ovozli xabar tugmasi. Bosilsa yozish boshlanadi (mikrofonga ruxsat so'raladi), "Yuborish" bosilsa tugaydi.
 * Yozish paytida o'zi butun qatorni egallaydi (onRecordingChange orqali ota-ona boshqa elementlarni yashiradi).
 */
export function VoiceNoteRecorder({ disabled, onClip, onError, onRecordingChange }: { disabled?: boolean; onClip: (c: Clip) => Promise<void>; onError: (m: string) => void; onRecordingChange?: (on: boolean) => void }) {
  const [phase, setPhase] = React.useState<"idle" | "starting" | "rec" | "sending">("idle");
  const [elapsed, setElapsed] = React.useState(0);
  const [ok, setOk] = React.useState(false);
  const cur = React.useRef<Rec | null>(null);
  const live = React.useRef(true);

  React.useEffect(() => {
    live.current = true;
    setOk(typeof MediaRecorder !== "undefined" && typeof navigator.mediaDevices?.getUserMedia === "function");
    return () => {
      live.current = false;
      const r = cur.current;
      if (r) { r.cancelled = true; window.clearInterval(r.timer); if (r.mr.state !== "inactive") r.mr.stop(); r.stream.getTracks().forEach((t) => t.stop()); }
    };
  }, []);
  React.useEffect(() => { onRecordingChange?.(phase === "rec"); }, [phase, onRecordingChange]);

  async function done(r: Rec) {
    window.clearInterval(r.timer);
    r.stream.getTracks().forEach((t) => t.stop());
    cur.current = null;
    if (r.cancelled || !live.current) { if (live.current) setPhase("idle"); return; }
    const blob = new Blob(r.chunks, { type: r.mr.mimeType });
    const mime = clipMime(r.mr.mimeType) ?? clipMime(blob.type);
    if (r.ms < MIN_CLIP_MS || blob.size === 0) { setPhase("idle"); onError("Xabar juda qisqa. Tugmani bosib, biroz gapiring."); return; }
    if (!mime) { setPhase("idle"); onError("Bu brauzer ovozli xabarni qo'llamaydi."); return; }
    setPhase("sending");
    try { await onClip({ mime, ms: Math.min(r.ms, MAX_CLIP_MS), bytes: new Uint8Array(await blob.arrayBuffer()) }); } finally { if (live.current) setPhase("idle"); }
  }
  function finish(cancel: boolean) {
    const r = cur.current;
    if (!r) return;
    r.cancelled = cancel;
    r.ms = performance.now() - r.t0;
    window.clearInterval(r.timer);
    if (r.mr.state !== "inactive") r.mr.stop(); else void done(r);
  }
  async function start() {
    setPhase("starting");
    let stream: MediaStream;
    try { stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } }); } catch (e) { setPhase("idle"); onError(describeMediaError(e, "mikrofon")); return; }
    if (!live.current) { stream.getTracks().forEach((t) => t.stop()); return; }
    let mr: MediaRecorder;
    try { const type = pickType(); mr = new MediaRecorder(stream, { ...(type && { mimeType: type }), audioBitsPerSecond: 24000 }); } catch { stream.getTracks().forEach((t) => t.stop()); setPhase("idle"); onError("Bu brauzer ovozli xabar yozishni qo'llamaydi."); return; }
    const r: Rec = { mr, stream, chunks: [], size: 0, t0: performance.now(), cancelled: false, timer: 0, ms: 0 };
    cur.current = r;
    mr.ondataavailable = (e) => {
      if (!e.data.size) return;
      r.chunks.push(e.data); r.size += e.data.size;
      if (r.size > MAX_CLIP_BYTES * 0.9) finish(false); // yuborish chegarasidan oshib ketmasin
    };
    mr.onstop = () => void done(r);
    mr.start(1000);
    r.timer = window.setInterval(() => { const ms = performance.now() - r.t0; setElapsed(ms); if (ms >= MAX_CLIP_MS) finish(false); }, 200);
    setElapsed(0);
    setPhase("rec");
  }

  if (!ok) return null;
  if (phase === "rec") {
    return (
      <div className="flex min-w-0 flex-1 items-center gap-2" role="status">
        <span className="h-3 w-3 shrink-0 animate-pulse rounded-full bg-danger" aria-hidden />
        <span className="min-w-0 flex-1 truncate text-sm font-semibold tabular-nums">Yozilmoqda {clipTime(elapsed)} / {clipTime(MAX_CLIP_MS)}</span>
        <Button type="button" size="icon" variant="outline" onClick={() => finish(true)} aria-label="Yozishni bekor qilish"><X className="h-4 w-4" aria-hidden /></Button>
        <Button type="button" size="icon" onClick={() => finish(false)} aria-label="Ovozli xabarni yuborish"><Send className="h-4 w-4" aria-hidden /></Button>
      </div>
    );
  }
  return (
    <Button type="button" size="icon" variant="outline" disabled={disabled || phase !== "idle"} loading={phase === "sending"} onClick={() => void start()} aria-label="Ovozli xabar yozish" title="Ovozli xabar">
      <Mic className="h-4 w-4" aria-hidden />
    </Button>
  );
}

let playing: HTMLAudioElement | null = null;

/** Ovozli xabarni eshitish: bosib o'ynatiladi, bir vaqtda faqat bittasi eshitiladi. */
export function VoiceNotePlayer({ url, ms, mine }: { url: string; ms: number; mine: boolean }) {
  const ref = React.useRef<HTMLAudioElement>(null);
  const [on, setOn] = React.useState(false);
  const [pos, setPos] = React.useState(0);
  const [bad, setBad] = React.useState(false);

  React.useEffect(() => () => { const a = ref.current; if (a && playing === a) playing = null; }, []);

  async function toggle() {
    const a = ref.current;
    if (!a) return;
    if (!a.paused) { a.pause(); return; }
    if (playing && playing !== a) playing.pause();
    playing = a;
    try { await a.play(); } catch { setBad(true); }
  }
  const pct = ms > 0 ? Math.min(100, (pos / ms) * 100) : 0;
  return (
    <div className="flex min-w-44 items-center gap-2">
      <audio ref={ref} src={url} preload="metadata" onPlay={() => setOn(true)} onPause={() => setOn(false)} onEnded={() => { setOn(false); setPos(0); }} onTimeUpdate={(e) => setPos(e.currentTarget.currentTime * 1000)} onError={() => setBad(true)} />
      <button type="button" onClick={() => void toggle()} aria-label={on ? "To'xtatish" : "Eshitish"} className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-full", mine ? "bg-white/20 text-white" : "bg-primary text-white")}>
        {on ? <Pause className="h-4 w-4" aria-hidden /> : <Play className="h-4 w-4" aria-hidden />}
      </button>
      <div className="min-w-0 flex-1">
        <div className={cn("h-1.5 overflow-hidden rounded-full", mine ? "bg-white/30" : "bg-border")} role="progressbar" aria-label="Ovozli xabar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct)}>
          <div className={cn("h-full rounded-full", mine ? "bg-white" : "bg-primary")} style={{ width: `${pct}%` }} />
        </div>
        <p className={cn("mt-1 text-[11px] font-semibold tabular-nums", mine ? "text-white/80" : "text-muted-foreground")}>{bad ? "Eshitib bo'lmadi" : clipTime(on || pos > 0 ? pos : ms)}</p>
      </div>
    </div>
  );
}
