"use client";
import * as React from "react";
import { AlertTriangle, Camera, CheckCircle2, Mic, MicOff, Smartphone, Video, VideoOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/form";
import { cn } from "@/lib/utils";
import { NAME_KEY, cleanName, describeMediaError, isTelegramBrowser, jitsiUrl } from "@/lib/dars";

type Probe = { stream: MediaStream | null; error: unknown };
const probe = async (c: MediaStreamConstraints): Promise<Probe> => {
  try { return { stream: await navigator.mediaDevices.getUserMedia(c), error: null }; } catch (error) { return { stream: null, error }; }
};
const errName = (e: unknown) => (typeof e === "object" && e && "name" in e ? String((e as { name: unknown }).name) : "");
const stop = (s: MediaStream | null) => s?.getTracks().forEach((t) => t.stop());
const read = (k: string) => { try { return localStorage.getItem(k) ?? ""; } catch { return ""; } };
const write = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* maxfiy rejim */ } };

/** Ochiq (kirishsiz) kirish sahifasi: 1) kamera va mikrofon ruxsati, 2) ism, 3) darsga kirish. */
export function JoinRoom({ code, title, asTeacher }: { code: string; title: string; asTeacher: boolean }) {
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
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const streamRef = React.useRef<MediaStream | null>(null);
  const rafRef = React.useRef(0);
  const ctxRef = React.useRef<AudioContext | null>(null);

  React.useEffect(() => {
    setName(read(NAME_KEY));
    setTg(isTelegramBrowser(navigator.userAgent));
    return () => release();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  async function check() {
    release();
    setState("busy"); setCamErr(""); setMicErr(""); setLevel(0);
    if (!navigator.mediaDevices?.getUserMedia) {
      const m = describeMediaError({ name: "NoMediaDevices" });
      setCam(false); setMic(false); setCamErr(m); setMicErr(m); setState("done");
      return;
    }
    // Avval ikkalasini birga so'raymiz (brauzer bitta oyna ko'rsatadi); bo'lmasa har birini alohida tekshiramiz.
    const both = await probe({ video: true, audio: true });
    let stream = both.stream;
    if (stream) { setCam(true); setMic(true); }
    else {
      const a = await probe({ audio: true });
      const v = await probe({ video: true });
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
    setState("done");
  }

  // Video elementi ekranda paydo bo'lgach unga oqimni ulaymiz.
  React.useEffect(() => {
    if (state === "done" && cam && videoRef.current && streamRef.current) videoRef.current.srcObject = streamRef.current;
  }, [state, cam]);

  const ok = cam === true || mic === true;
  const nameOk = cleanName(name).length >= 2;
  const canEnter = nameOk && (ok || skip);

  function enter() {
    const n = cleanName(name);
    write(NAME_KEY, n);
    setGoing(true);
    release(); // qurilmalarni bo'shatamiz, aks holda Jitsi ularni ocholmaydi
    window.location.assign(jitsiUrl({ code, name: n, title }));
  }

  return (
    <div className="mx-auto w-full max-w-xl space-y-4">
      <div className="rounded-2xl bg-primary p-5 text-white">
        <p className="text-xs font-bold uppercase tracking-wider text-white/70">Dars xonasi</p>
        <h1 className="mt-1 text-2xl font-extrabold leading-tight">{title || "Onlayn dars"}</h1>
        <p className="mt-1 text-sm text-white/80">{asTeacher ? "Siz o'qituvchi sifatida kiryapsiz." : "Siz o'quvchi sifatida kiryapsiz. Hisob ochish yoki parol kerak emas."}</p>
      </div>

      {tg && (
        <div role="note" className="flex gap-3 rounded-2xl border border-amber/40 bg-amber/10 p-4 text-sm">
          <Smartphone className="mt-0.5 h-5 w-5 shrink-0 text-amber" aria-hidden />
          <p><b>Telegram ichidagi oynadasiz.</b> Bu oynada kamera va mikrofon ishlamasligi mumkin. Yuqori burchakdagi <b>⋮</b> (yoki pastdagi kompas/Safari belgisi) ni bosib, <b>«Brauzerda ochish»</b> ni tanlang.</p>
        </div>
      )}

      <Step n={1} title="Kamera va mikrofonni tekshiring" done={state === "done" && ok}>
        <p className="text-sm text-muted-foreground">
          Tugmani bosganingizda brauzer ruxsat so&apos;raydi. Oynada <b>«Ruxsat berish»</b> (yoki <b>Allow</b>) tugmasini bosing. Hech narsa yozib olinmaydi, bu faqat tekshiruv.
        </p>
        {state !== "done" && (
          <Button size="lg" className="mt-3 w-full" onClick={check} disabled={state === "busy"} loading={state === "busy"}>
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
            {camErr && <Problem text={camErr} />}
            {micErr && <Problem text={micErr} />}
            {!(cam && mic) && (
              <Button variant="outline" className="w-full" onClick={check}>Qayta tekshirish</Button>
            )}
          </div>
        )}
      </Step>

      <Step n={2} title="Ismingizni yozing" done={nameOk}>
        <label htmlFor="dars-ism" className="text-sm text-muted-foreground">Darsda boshqalarga shu ism ko&apos;rinadi.</label>
        <Input id="dars-ism" className="mt-1.5" value={name} onChange={(e) => setName(e.target.value)} maxLength={40} autoComplete="name" placeholder={asTeacher ? "Masalan: Dilnoza opa" : "Masalan: Ali Valiyev, 5-sinf"} />
      </Step>

      <Step n={3} title="Darsga kiring" done={false}>
        <Button size="lg" className="w-full" disabled={!canEnter || going} loading={going} onClick={enter}>
          <Video className="h-5 w-5" aria-hidden />Darsga kirish
        </Button>
        {!canEnter && (
          <p className="mt-2 text-sm text-muted-foreground" aria-live="polite">
            {!ok && !skip ? "Avval 1-qadamni bajaring. " : ""}{!nameOk ? "2-qadamda ismingizni yozing." : ""}
          </p>
        )}
        {!ok && !skip && (
          <button type="button" onClick={() => setSkip(true)} className="mt-2 text-sm font-semibold text-primary underline-offset-2 hover:underline">
            Tekshirmasdan kirmoqchiman (faqat eshitaman)
          </button>
        )}
        <ul className="mt-4 space-y-1.5 text-sm text-muted-foreground">
          <li>• Dars Jitsi oynasida ochiladi. Pastdagi panelda: <b>chat</b> (yozishma), <b>qo&apos;l ko&apos;tarish</b>, <b>mikrofon</b> va <b>kamera</b> tugmalari bor.</li>
          <li>• Telefonda «Ilovani o&apos;rnating» deb so&apos;rashi mumkin: <b>«Brauzerda davom etish»</b> ni tanlasangiz ham bo&apos;ladi.</li>
          <li>• Aloqa uzilsa, shu havolani qayta oching.</li>
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
