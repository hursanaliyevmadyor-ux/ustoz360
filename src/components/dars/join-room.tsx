"use client";
import * as React from "react";
import { AlertTriangle, CalendarClock, Camera, CheckCircle2, Mic, MicOff, Signal, Smartphone, Video, VideoOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/form";
import { cn } from "@/lib/utils";
import { NAME_KEY, cleanName, connectionQuality, describeMediaError, isTelegramBrowser, lessonCountdown, lessonTimeLabel } from "@/lib/dars";
import type { VEngine } from "./voice-engine";

// Dars xonasi (LiveKit) faqat kerak bo'lganda yuklanadi: kirish sahifasi yengil qoladi.
const VoiceRoom = React.lazy(() => import("./voice-room").then((m) => ({ default: m.VoiceRoom })));

type Probe = { stream: MediaStream | null; error: unknown };
const probe = async (c: MediaStreamConstraints): Promise<Probe> => {
  try { return { stream: await navigator.mediaDevices.getUserMedia(c), error: null }; } catch (error) { return { stream: null, error }; }
};
const stop = (s: MediaStream | null) => s?.getTracks().forEach((t) => t.stop());
const errName = (e: unknown) => (typeof e === "object" && e && "name" in e ? String((e as { name: unknown }).name) : "");
const read = (k: string) => { try { return localStorage.getItem(k) ?? ""; } catch { return ""; } };
const write = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* maxfiy rejim */ } };

type Dev = { id: string; label: string };

/** Taxminiy kechikish (ms): o'z saytimizga 3 ta kichik so'rov, o'rtachasi. Bo'lmasa null. */
async function measureRtt(): Promise<number | null> {
  try {
    const times: number[] = [];
    for (let i = 0; i < 3; i++) {
      const t0 = performance.now();
      const r = await fetch(`/icon.svg?rtt=${Date.now()}${i}`, { cache: "no-store" });
      if (!r.ok) return null;
      await r.arrayBuffer();
      times.push(performance.now() - t0);
    }
    times.sort((a, b) => a - b);
    return Math.round(times[1]);
  } catch { return null; }
}

/** Xona haqida: rejim (s = sinf, e = erkin suhbat) va imzolar. `h` faqat ustoz havolasida bo'ladi. */
export type RoomInfo = { mode: "s" | "e"; k: string; h?: string };

/** Ochiq (kirishsiz) kirish sahifasi: 1) kamera va mikrofon ruxsati, 2) ism, 3) darsga kirish. */
export function JoinRoom({ code, title, asTeacher, startsAt, room }: { code: string; title: string; asTeacher: boolean; startsAt: number | null; room: RoomInfo }) {
  const isHost = !!room.h;
  // O'quvchi sinf rejimida faqat tomosha qiladi: kamera va mikrofon tekshiruvi ixtiyoriy. Ustoz va erkin suhbatda esa kerak.
  const needsDevices = isHost || room.mode === "e";
  const [state, setState] = React.useState<"idle" | "busy" | "done">("idle");
  const [cam, setCam] = React.useState<boolean | null>(null);
  const [mic, setMic] = React.useState<boolean | null>(null);
  const [camErr, setCamErr] = React.useState("");
  const [micErr, setMicErr] = React.useState("");
  const [level, setLevel] = React.useState(0);
  const [name, setName] = React.useState("");
  const [tg, setTg] = React.useState(false);
  const [skip, setSkip] = React.useState(false);
  const [going, setGoing] = React.useState(false);
  const [engine, setEngine] = React.useState<VEngine | null>(null);
  const [cams, setCams] = React.useState<Dev[]>([]);
  const [mics, setMics] = React.useState<Dev[]>([]);
  const [camId, setCamId] = React.useState("");
  const [micId, setMicId] = React.useState("");
  const [audioOff, setAudioOff] = React.useState(!isHost); // o'quvchilar mikrofonsiz kiradi (shovqin bo'lmasligi uchun), ustoz yoqiq
  const [videoOff, setVideoOff] = React.useState(false);
  const [net, setNet] = React.useState<{ level: "good" | "ok" | "weak" | "offline"; text: string } | null>(null);
  const [now, setNow] = React.useState(() => Date.now());
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const streamRef = React.useRef<MediaStream | null>(null);
  const rafRef = React.useRef(0);
  const ctxRef = React.useRef<AudioContext | null>(null);

  React.useEffect(() => {
    setName(read(NAME_KEY));
    setTg(isTelegramBrowser(navigator.userAgent));
    void measureRtt().then((rtt) => setNet(connectionQuality(rtt, navigator.onLine)));
    const onOff = () => setNet(connectionQuality(null, navigator.onLine));
    window.addEventListener("offline", onOff);
    return () => { window.removeEventListener("offline", onOff); release(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Dars vaqtigacha qolgan vaqt har yarim daqiqada yangilanadi.
  React.useEffect(() => {
    if (!startsAt) return;
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, [startsAt]);

  function release() {
    cancelAnimationFrame(rafRef.current);
    ctxRef.current?.close().catch(() => {});
    ctxRef.current = null;
    stop(streamRef.current);
    streamRef.current = null;
  }

  function startMeter(stream: MediaStream) {
    try {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AC();
      ctxRef.current = ctx;
      const an = ctx.createAnalyser();
      an.fftSize = 512;
      ctx.createMediaStreamSource(stream).connect(an);
      const buf = new Uint8Array(an.fftSize);
      const tick = () => {
        an.getByteTimeDomainData(buf);
        let sum = 0;
        for (const v of buf) { const d = (v - 128) / 128; sum += d * d; }
        setLevel(Math.min(1, Math.sqrt(sum / buf.length) * 4));
        rafRef.current = requestAnimationFrame(tick);
      };
      tick();
    } catch { /* ovoz o'lchagichi bo'lmasa ham davom etamiz */ }
  }

  /** Ruxsat berilgach qurilmalar ro'yxati (nomlari faqat ruxsatdan keyin ko'rinadi). */
  async function listDevices(stream: MediaStream | null) {
    try {
      const all = await navigator.mediaDevices.enumerateDevices();
      const mk = (k: MediaDeviceKind, fallback: string) => all.filter((d) => d.kind === k && d.deviceId).map((d, i) => ({ id: d.deviceId, label: d.label || `${fallback} ${i + 1}` }));
      setCams(mk("videoinput", "Kamera")); setMics(mk("audioinput", "Mikrofon"));
      setCamId(stream?.getVideoTracks()[0]?.getSettings().deviceId ?? ""); setMicId(stream?.getAudioTracks()[0]?.getSettings().deviceId ?? "");
    } catch { /* ro'yxat bo'lmasa, standart qurilma ishlatiladi */ }
  }

  /** Ruxsat so'rash va tekshirish. `pick` berilsa, tanlangan qurilma bilan qayta ochiladi. */
  async function check(pick?: { cam?: string; mic?: string }) {
    release();
    if (!pick) setState("busy"); // qurilma almashtirilganda ko'rinish o'zgarmaydi
    setCamErr(""); setMicErr(""); setLevel(0);
    if (!navigator.mediaDevices?.getUserMedia) {
      const m = describeMediaError({ name: "NoMediaDevices" });
      setCam(false); setMic(false); setCamErr(m); setMicErr(m); setState("done");
      return;
    }
    const vc: MediaTrackConstraints | boolean = pick?.cam ? { deviceId: { exact: pick.cam } } : true;
    const ac: MediaTrackConstraints | boolean = pick?.mic ? { deviceId: { exact: pick.mic } } : true;
    // Avval ikkalasini birga so'raymiz (brauzer bitta oyna ko'rsatadi); bo'lmasa har birini alohida tekshiramiz.
    const both = await probe({ video: vc, audio: ac });
    let stream = both.stream;
    if (stream) { setCam(true); setMic(true); }
    else {
      const a = await probe({ audio: ac });
      const v = await probe({ video: vc });
      setMic(!!a.stream); setCam(!!v.stream);
      const same = !a.stream && !v.stream && errName(a.error) === errName(v.error);
      // Ikkalasi bir xil sababdan ishlamasa, bitta tushunarli xabar ko'rsatamiz.
      setMicErr(a.stream ? "" : describeMediaError(a.error, same ? "kamera va mikrofon" : "mikrofon"));
      setCamErr(v.stream || same ? "" : describeMediaError(v.error, "kamera"));
      const tracks = [...(a.stream?.getTracks() ?? []), ...(v.stream?.getTracks() ?? [])];
      stream = tracks.length ? new MediaStream(tracks) : null;
    }
    streamRef.current = stream;
    if (stream?.getAudioTracks().length) startMeter(stream);
    if (!stream?.getVideoTracks().length) setVideoOff(true); // kamera yo'q: kamerasiz kiramiz
    if (stream) void listDevices(stream);
    setState("done");
  }

  // Video elementi ekranda paydo bo'lgach unga oqimni ulaymiz.
  React.useEffect(() => {
    if (state === "done" && cam && videoRef.current && streamRef.current) videoRef.current.srcObject = streamRef.current;
  }, [state, cam]);

  const ok = cam === true || mic === true;
  const nameOk = cleanName(name).length >= 2;
  const canEnter = nameOk && (needsDevices ? ok || skip : true);
  const cd = startsAt ? lessonCountdown(startsAt, now) : null;

  async function enter() {
    const n = cleanName(name);
    write(NAME_KEY, n);
    setGoing(true);
    release(); // qurilmalarni bo'shatamiz, aks holda xona ularni ocholmaydi
    const { createLiveKitEngine } = await import("./voice-engine");
    setEngine(createLiveKitEngine({
      code, mode: room.mode, k: room.k, h: room.h, name: n,
      prefs: { audio: !(audioOff || mic === false), video: !(videoOff || cam === false), camId: camId || undefined, micId: micId || undefined },
    }));
  }

  if (engine) {
    return (
      <React.Suspense fallback={<p className="text-center text-sm text-muted-foreground">Xona yuklanmoqda...</p>}>
        <VoiceRoom engine={engine} ctl={{ code, mode: room.mode, k: room.k, h: room.h }} title={title} onExit={() => { setEngine(null); setGoing(false); }} />
      </React.Suspense>
    );
  }

  return (
    <div className="mx-auto w-full max-w-xl space-y-4">
      <div className="rounded-2xl bg-primary p-5 text-white">
        <p className="text-xs font-bold uppercase tracking-wider text-white/70">Dars xonasi</p>
        <h1 className="mt-1 text-2xl font-extrabold leading-tight">{title || "Onlayn dars"}</h1>
        {startsAt && cd && (
          <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-semibold" aria-live="polite">
            <CalendarClock className="h-4 w-4" aria-hidden />{lessonTimeLabel(startsAt)}
            <span className={cn("rounded-full px-2.5 py-0.5 text-xs", cd.state === "future" ? "bg-white/20" : cd.state === "live" ? "bg-success text-white" : "bg-black/20")}>{cd.text}</span>
          </p>
        )}
        <p className="mt-2 text-sm text-white/80">
          {isHost || asTeacher ? "Siz o'qituvchi sifatida kiryapsiz." : "Siz o'quvchi sifatida kiryapsiz. Hisob ochish yoki parol kerak emas."}
          {!isHost && (room.mode === "s" ? " Ustozni ko'rasiz va eshitasiz; gapirish uchun «Qo'l ko'tarish» tugmasini bosasiz." : " Hamma gapira oladi.")}
        </p>
      </div>

      {tg && (
        <div role="note" className="flex gap-3 rounded-2xl border border-amber/40 bg-amber/10 p-4 text-sm">
          <Smartphone className="mt-0.5 h-5 w-5 shrink-0 text-amber" aria-hidden />
          <p><b>Telegram ichidagi oynadasiz.</b> Bu oynada kamera va mikrofon ishlamasligi mumkin. Yuqori burchakdagi <b>⋮</b> (yoki pastdagi kompas/Safari belgisi) ni bosib, <b>«Brauzerda ochish»</b> ni tanlang.</p>
        </div>
      )}

      <Step n={1} title={needsDevices ? "Kamera va mikrofonni tekshiring" : "Kamera va mikrofonni tekshiring (ixtiyoriy)"} done={state === "done" && ok}>
        <p className="text-sm text-muted-foreground">
          {needsDevices
            ? <>Tugmani bosganingizda brauzer ruxsat so&apos;raydi. Oynada <b>«Ruxsat berish»</b> (yoki <b>Allow</b>) tugmasini bosing. Hech narsa yozib olinmaydi, bu faqat tekshiruv.</>
            : <>Faqat tomosha qilsangiz, bu qadamni o&apos;tkazib yuborishingiz mumkin. Ustoz gapirishga ruxsat bersa, mikrofon va kamera kerak bo&apos;ladi: tugmani bosing va brauzer so&apos;raganda <b>«Ruxsat berish»</b> (<b>Allow</b>) ni tanlang. Quloqchin taqsangiz yaxshi.</>}
        </p>
        {net && (
          <p className={cn("mt-2 flex items-center gap-2 text-sm font-semibold", net.level === "good" ? "text-success" : net.level === "ok" ? "text-amber" : "text-danger")} aria-live="polite">
            <Signal className="h-4 w-4" aria-hidden />{net.text}
          </p>
        )}
        {state !== "done" && (
          <Button size="lg" className="mt-3 w-full" onClick={() => void check()} disabled={state === "busy"} loading={state === "busy"}>
            <Camera className="h-5 w-5" aria-hidden />Kamera va mikrofonga ruxsat berish
          </Button>
        )}
        {state === "done" && (
          <div className="mt-3 space-y-3" aria-live="polite">
            <div className="grid grid-cols-2 gap-2">
              <Status ok={cam} on={<Video className="h-4 w-4" aria-hidden />} off={<VideoOff className="h-4 w-4" aria-hidden />} label="Kamera" okText="ishlayapti" noText="ishlamayapti" />
              <Status ok={mic} on={<Mic className="h-4 w-4" aria-hidden />} off={<MicOff className="h-4 w-4" aria-hidden />} label="Mikrofon" okText="ishlayapti" noText="ishlamayapti" />
            </div>
            {cam && (
              <div className="overflow-hidden rounded-2xl bg-black">
                <video ref={videoRef} autoPlay muted playsInline className="aspect-video w-full -scale-x-100 object-cover" aria-label="Kamera ko'rinishi" />
              </div>
            )}
            {mic && (
              <div>
                <div className="h-3 overflow-hidden rounded-full bg-muted" role="progressbar" aria-label="Ovoz balandligi" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(level * 100)}>
                  <div className="h-full rounded-full bg-success transition-[width] duration-75" style={{ width: `${Math.round(level * 100)}%` }} />
                </div>
                <p className="mt-1 text-xs text-muted-foreground">Biror narsa deng: yashil chiziq harakatlansa, ovozingiz eshitiladi.</p>
              </div>
            )}
            {(cams.length > 1 || mics.length > 1) && (
              <div className="grid gap-2 sm:grid-cols-2">
                {cams.length > 1 && cam && (
                  <label className="block text-sm font-semibold">Kamera
                    <Select className="mt-1" value={camId} onChange={(e) => { setCamId(e.target.value); void check({ cam: e.target.value, mic: micId || undefined }); }}>
                      {cams.map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}
                    </Select>
                  </label>
                )}
                {mics.length > 1 && mic && (
                  <label className="block text-sm font-semibold">Mikrofon
                    <Select className="mt-1" value={micId} onChange={(e) => { setMicId(e.target.value); void check({ mic: e.target.value, cam: camId || undefined }); }}>
                      {mics.map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}
                    </Select>
                  </label>
                )}
              </div>
            )}
            {camErr && <Problem text={camErr} />}
            {micErr && <Problem text={micErr} />}
            {!(cam && mic) && (
              <Button variant="outline" className="w-full" onClick={() => void check()}>Qayta tekshirish</Button>
            )}
          </div>
        )}
      </Step>

      <Step n={2} title="Ismingizni yozing" done={nameOk}>
        <label htmlFor="dars-ism" className="text-sm text-muted-foreground">Darsda boshqalarga shu ism ko&apos;rinadi.</label>
        <Input id="dars-ism" className="mt-1.5" value={name} onChange={(e) => setName(e.target.value)} maxLength={40} autoComplete="name" placeholder={isHost || asTeacher ? "Masalan: Dilnoza opa" : "Masalan: Ali Valiyev, 5-sinf"} />
      </Step>

      <Step n={3} title="Darsga kiring" done={false}>
        {needsDevices && (
          <div className="mb-3 space-y-2 rounded-xl bg-muted/60 p-3 text-sm">
            <label className="flex cursor-pointer items-start gap-2.5">
              <input type="checkbox" className="mt-0.5 h-5 w-5 accent-[hsl(var(--primary))]" checked={audioOff || mic === false} disabled={mic === false} onChange={(e) => setAudioOff(e.target.checked)} />
              <span><b>Mikrofon o&apos;chiq holda kirish</b>{!isHost && <span className="text-muted-foreground"> (tavsiya etiladi: ovoz aralashmasligi uchun; kerak bo&apos;lsa, darsda o&apos;zingiz yoqasiz)</span>}</span>
            </label>
            <label className="flex cursor-pointer items-start gap-2.5">
              <input type="checkbox" className="mt-0.5 h-5 w-5 accent-[hsl(var(--primary))]" checked={videoOff || cam === false} disabled={cam === false} onChange={(e) => setVideoOff(e.target.checked)} />
              <span><b>Kamera o&apos;chiq holda kirish</b><span className="text-muted-foreground"> (internet zaif bo&apos;lsa foydali)</span></span>
            </label>
          </div>
        )}
        <Button size="lg" className="w-full" disabled={!canEnter || going} loading={going} onClick={() => void enter()}>
          <Video className="h-5 w-5" aria-hidden />Darsga kirish
        </Button>
        {!canEnter && (
          <p className="mt-2 text-sm text-muted-foreground" aria-live="polite">
            {needsDevices && !ok && !skip ? "Avval 1-qadamni bajaring. " : ""}{!nameOk ? "2-qadamda ismingizni yozing." : ""}
          </p>
        )}
        {needsDevices && !ok && !skip && (
          <button type="button" onClick={() => setSkip(true)} className="mt-2 text-sm font-semibold text-primary underline-offset-2 hover:underline">
            Tekshirmasdan kirmoqchiman (faqat eshitaman)
          </button>
        )}
        <ul className="mt-4 space-y-1.5 text-sm text-muted-foreground">
          <li>• Dars shu sahifaning o&apos;zida o&apos;tadi: ustoz videosi, ishtirokchilar, yozishma va tugmalar. Boshqa saytga o&apos;tmaysiz.</li>
          <li>• Darsda ko&apos;rinishingiz uchun «Ismingiz» yozilgan bo&apos;ladi. Aloqa uzilsa, shu havolani qayta oching.</li>
        </ul>
      </Step>
    </div>
  );
}

function Step({ n, title, done, children }: { n: number; title: string; done: boolean; children: React.ReactNode }) {
  return (
    <Card className="p-5">
      <div className="mb-3 flex items-center gap-3">
        <span className={cn("grid h-8 w-8 shrink-0 place-items-center rounded-full text-sm font-extrabold", done ? "bg-success text-white" : "bg-primary/10 text-primary")} aria-hidden>
          {done ? <CheckCircle2 className="h-5 w-5" /> : n}
        </span>
        <h2 className="text-lg font-extrabold">{n}-qadam. {title}</h2>
      </div>
      {children}
    </Card>
  );
}

function Status({ ok, on, off, label, okText, noText }: { ok: boolean | null; on: React.ReactNode; off: React.ReactNode; label: string; okText: string; noText: string }) {
  return (
    <div className={cn("flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold", ok ? "bg-success/10 text-success" : "bg-danger/10 text-danger")}>
      {ok ? on : off}<span>{label}: {ok ? okText : noText}</span>
    </div>
  );
}

function Problem({ text }: { text: string }) {
  return (
    <p role="alert" className="flex gap-2 rounded-xl bg-danger/10 p-3 text-sm text-danger">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />{text}
    </p>
  );
}
