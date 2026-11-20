"use client";
import * as React from "react";
import { CalendarClock, CheckCircle2, Copy, ExternalLink, Eye, Info, Link2, Play, Send, Mic, Share2, Trash2, Video } from "lucide-react";
import { PageHeader } from "@/components/layout/page";
import { QrCode } from "@/components/dars/qr-code";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input, Textarea } from "@/components/ui/form";
import { cn } from "@/lib/utils";
import {
  ROOMS_KEY, addSavedRoom, cleanTitle, fromLocalInput, inviteText, joinUrl, lessonCountdown, lessonTimeLabel, newRoomCode, parseSavedRooms, telegramShareUrl, type SavedRoom,
} from "@/lib/dars";
import { modeLabel, modeOf, type VoiceMode } from "@/lib/voice-mode";

const read = (k: string) => { try { return localStorage.getItem(k); } catch { return null; } };
const write = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* maxfiy rejim */ } };
const CHECK_KEY = "u360-dars-check";
const pad = (n: number) => String(n).padStart(2, "0");
const fmt = (t: number) => { const d = new Date(t); return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}, ${pad(d.getHours())}:${pad(d.getMinutes())}`; };

const CHECK = [
  "Internet yaxshi ishlayaptimi (Wi-Fi yoki kuchli mobil aloqa)?",
  "Naushnik taqdingizmi? Shunda aks-sado (g'ing eshitilishi) bo'lmaydi.",
  "Yorug'lik yuzingizga tushyaptimi? Orqangizda deraza bo'lmasin.",
  "Dars rejangiz tayyormi? (DARSYOR → Dars ishlanmasi)",
  "O'quvchilarga qoida aytdingizmi: mikrofon o'chiq, savol bo'lsa chatga yozish yoki «qo'l ko'tarish».",
  "Dars boshlanishidan 10 daqiqa oldin xonaga kirib, kamera va mikrofonni tekshirdingizmi?",
];

const DURING = [
  ["Mikrofon / Kamera", "pastdagi tugmalar: o'zingizni yoqish yoki o'chirish. Siz kirganda ular yoqiq bo'ladi (ovozli chatda kamera yo'q)"],
  ["Qo'l ko'targanlar", "ishtirokchilar ro'yxatida sariq belgi chiqadi: «Gapirishga ruxsat» ni bosasiz, o'quvchining mikrofoni (video darsda kamerasi ham) ochiladi"],
  ["Ruxsatni olish", "gapirib bo'lgach, o'quvchi yonidagi «Ruxsatni olish» yoki «Hammaning ruxsatini olish»"],
  ["Ekranni ulashish", "faqat video darsda, kompyuterda: slayd, hujjat yoki doskani hammaga ko'rsatadi. Telefonda bu tugma yo'q"],
  ["Yozishma (chat)", "o'quvchi savol yozadi, siz havola yoki vazifani yuborasiz"],
  ["Darsni yakunlash", "darsni hamma uchun tugatadi"],
];

export default function Page() {
  const [title, setTitle] = React.useState("");
  const [when, setWhen] = React.useState("");
  const [rooms, setRooms] = React.useState<SavedRoom[]>([]);
  const [origin, setOrigin] = React.useState("");
  const [current, setCurrent] = React.useState<SavedRoom | null>(null);
  const [copied, setCopied] = React.useState("");
  const [ticks, setTicks] = React.useState<boolean[]>(() => CHECK.map(() => false));
  const [canShare, setCanShare] = React.useState(false);
  const [now, setNow] = React.useState(() => Date.now());
  const [voiceOn, setVoiceOn] = React.useState(false);
  const [video, setVideo] = React.useState(true);
  const [free, setFree] = React.useState(false);
  const mode = modeOf(video, free);
  const [creating, setCreating] = React.useState(false);
  const [createErr, setCreateErr] = React.useState("");

  React.useEffect(() => {
    setOrigin(window.location.origin); setRooms(parseSavedRooms(read(ROOMS_KEY)));
    setCanShare(typeof navigator.share === "function");
    void fetch("/api/dars/status").then((r) => r.json()).then((d: { voice?: boolean }) => { setVoiceOn(!!d.voice); }).catch(() => {});
    try { const v: unknown = JSON.parse(read(CHECK_KEY) ?? "[]"); if (Array.isArray(v)) setTicks(CHECK.map((_, i) => v[i] === true)); } catch { /* buzilgan ma'lumot */ }
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  const startsAt = fromLocalInput(when);

  async function create() {
    setCreateErr("");
    setCreating(true);
    try {
      // Xona kodi va imzolari serverda hosil bo'ladi (faqat tizimga kirgan ustoz yarata oladi).
      const r = await fetch("/api/dars/room", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ mode }) });
      const d = (await r.json().catch(() => ({}))) as { code?: string; mode?: VoiceMode; k?: string; h?: string; error?: string };
      if (!r.ok || !d.code || !d.k || !d.h || !d.mode) throw new Error(d.error ?? "Xona yaratib bo'lmadi.");
      const room: SavedRoom = { code: d.code, title: cleanTitle(title), at: Date.now(), ...(startsAt && { startsAt }), voice: { mode: d.mode, k: d.k, h: d.h } };
      const next = addSavedRoom(rooms, room);
      setRooms(next); write(ROOMS_KEY, JSON.stringify(next)); setCurrent(room); setTitle(""); setWhen("");
    } catch (e) {
      setCreateErr(e instanceof Error ? e.message : "Xona yaratib bo'lmadi.");
    }
    setCreating(false);
  }
  function remove(code: string) {
    const next = rooms.filter((r) => r.code !== code);
    setRooms(next); write(ROOMS_KEY, JSON.stringify(next));
    if (current?.code === code) setCurrent(null);
  }
  function toggleTick(i: number) {
    setTicks((t) => { const n = t.map((v, j) => (j === i ? !v : v)); write(CHECK_KEY, JSON.stringify(n)); return n; });
  }
  async function copy(text: string, key: string, promptLabel: string) {
    try { await navigator.clipboard.writeText(text); } catch { window.prompt(promptLabel, text); }
    setCopied(key); setTimeout(() => setCopied((c) => (c === key ? "" : c)), 2500);
  }

  const linkOf = (r: SavedRoom) => (origin ? joinUrl(origin, r.code, r.title, false, r.startsAt, r.voice) : "");
  const startUrl = (r: SavedRoom) => (origin ? joinUrl(origin, r.code, r.title, true, r.startsAt, r.voice) : "#");
  const textOf = (r: SavedRoom) => inviteText({ title: r.title, startsAt: r.startsAt, link: linkOf(r), mode: r.voice.mode });
  const kindLabel = (r: SavedRoom) => modeLabel(r.voice.mode);

  return (
    <>
      <PageHeader title="Dars xonasi" description="Onlayn dars o'tkazing: o'quvchilar havola orqali kiradi, hisob ochish shart emas" />

      <div className="grid gap-5 lg:grid-cols-[1fr_22rem]">
        <div className="space-y-5">
          <Card className="p-5">
            <h2 className="text-lg font-extrabold">Yangi dars xonasi</h2>
            <ol className="mt-2 space-y-1 text-sm text-muted-foreground">
              <li><b className="text-foreground">1.</b> Dars nomini va vaqtini yozing (ikkalasi ixtiyoriy).</li>
              <li><b className="text-foreground">2.</b> «Xona yaratish» ni bosing: havola, taklif matni va QR kod tayyor bo&apos;ladi.</li>
              <li><b className="text-foreground">3.</b> Taklif matnini Telegramda o&apos;quvchilarga yuboring.</li>
              <li><b className="text-foreground">4.</b> Dars vaqtida «Darsni boshlash» ni bosing. Birinchi bo&apos;lib siz kiring: xonani siz ochasiz.</li>
            </ol>
            <form className="mt-4 space-y-3" onSubmit={(e) => { e.preventDefault(); void create(); }}>
              <fieldset>
                <legend className="mb-1.5 text-sm font-semibold">Xona turi</legend>
                <div className="grid gap-2 sm:grid-cols-2">
                  {([[true, "Video dars", "Kamera, ovoz, ekran ulashish va yozishma."], [false, "Ovozli chat", "Telegramdagi ovozli chatga o'xshash: faqat ovoz va yozishma, kamera yo'q."]] as const).map(([v, l, d]) => (
                    <label key={l} className={cn("flex cursor-pointer items-start gap-2.5 rounded-xl border p-3 text-sm", video === v ? "border-primary bg-primary/5" : "border-border")}>
                      <input type="radio" name="turi" className="mt-1 h-4 w-4 accent-[hsl(var(--primary))]" checked={video === v} onChange={() => setVideo(v)} />
                      <span><b>{l}</b><br /><span className="text-muted-foreground">{d}</span></span>
                    </label>
                  ))}
                </div>
              </fieldset>
              <fieldset>
                <legend className="mb-1.5 text-sm font-semibold">Kim gapira oladi</legend>
                <div className="grid gap-2 sm:grid-cols-2">
                  {([[false, "Ruxsat bilan", "O'quvchi qo'l ko'taradi, siz gapirishga ruxsat berasiz."], [true, "Hamma", "Hamma ruxsatsiz gapira oladi (kichik guruh uchun)."]] as const).map(([f, l, d]) => (
                    <label key={l} className={cn("flex cursor-pointer items-start gap-2.5 rounded-xl border p-3 text-sm", free === f ? "border-primary bg-primary/5" : "border-border")}>
                      <input type="radio" name="rejim" className="mt-1 h-4 w-4 accent-[hsl(var(--primary))]" checked={free === f} onChange={() => setFree(f)} />
                      <span><b>{l}</b><br /><span className="text-muted-foreground">{d}</span></span>
                    </label>
                  ))}
                </div>
              </fieldset>
              <div className="grid gap-3 sm:grid-cols-[1fr_13rem_auto] sm:items-end">
              <Field label="Dars nomi (ixtiyoriy)">
                <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} placeholder="Masalan: 5-sinf matematika, kasr sonlar" />
              </Field>
              <Field label="Dars vaqti (ixtiyoriy)">
                <Input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} />
              </Field>
              <Button type="submit" size="lg" loading={creating} disabled={!voiceOn}>{video ? <Video className="h-5 w-5" aria-hidden /> : <Mic className="h-5 w-5" aria-hidden />}Xona yaratish</Button>
              </div>
              {!voiceOn && <p role="status" className="rounded-xl bg-amber/10 p-3 text-sm text-amber">Dars xonasi hozircha o'chiq: LiveKit kalitlari qo'yilmagan yoki sayt hali yangilanmagan.</p>}
              {createErr && <p role="alert" className="rounded-xl bg-danger/10 p-3 text-sm text-danger">{createErr}</p>}
            </form>
          </Card>

          {current && (
            <Card className="border-success/40 p-5" aria-live="polite">
              <p className="flex items-center gap-2 font-extrabold text-success"><CheckCircle2 className="h-5 w-5" aria-hidden />Xona tayyor{current.title ? `: ${current.title}` : ""}</p>
              <p className="mt-1 text-xs font-bold uppercase tracking-wide text-muted-foreground">{kindLabel(current)}</p>
              {current.startsAt && (
                <p className="mt-1 flex items-center gap-2 text-sm font-semibold"><CalendarClock className="h-4 w-4" aria-hidden />{lessonTimeLabel(current.startsAt)}
                  <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs">{lessonCountdown(current.startsAt, now).text}</span></p>
              )}
              <div className="mt-4 grid gap-4 sm:grid-cols-[1fr_auto]">
                <div className="min-w-0 space-y-3">
                  <div>
                    <p className="text-sm font-semibold">O&apos;quvchilar uchun havola:</p>
                    <div className="mt-1.5 flex items-center gap-2 rounded-xl bg-muted px-3 py-2.5">
                      <Link2 className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                      <code className="min-w-0 flex-1 select-all break-all text-sm">{linkOf(current) || "..."}</code>
                    </div>
                  </div>
                  <div>
                    <p className="text-sm font-semibold">Tayyor taklif matni (Telegramga shunday yuboriladi):</p>
                    <Textarea readOnly value={origin ? textOf(current) : ""} className="mt-1.5 min-h-40 text-sm" aria-label="Taklif matni" onFocus={(e) => e.currentTarget.select()} />
                  </div>
                </div>
                <div className="flex flex-col items-center gap-1 sm:w-40">
                  <QrCode value={linkOf(current)} label="Darsga kirish uchun QR kod" className="w-36 rounded-xl border border-border bg-white p-2 [&_svg]:h-auto [&_svg]:w-full" />
                  <p className="text-center text-xs text-muted-foreground">Telefon kamerasi bilan skanerlansa, o&apos;quvchi darsga o&apos;tadi.</p>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button asChild><a href={startUrl(current)} target="_blank" rel="noopener noreferrer"><Play className="h-4 w-4" aria-hidden />Darsni boshlash</a></Button>
                <Button variant="outline" asChild><a href={origin ? telegramShareUrl(linkOf(current), textOf(current).split("\n").slice(0, current.startsAt ? 2 : 1).join("\n")) : "#"} target="_blank" rel="noopener noreferrer"><Send className="h-4 w-4" aria-hidden />Telegramda yuborish</a></Button>
                <Button variant="outline" onClick={() => void copy(textOf(current), `t-${current.code}`, "Taklif matnini nusxalang:")}>
                  {copied === `t-${current.code}` ? <><CheckCircle2 className="h-4 w-4 text-success" aria-hidden />Nusxalandi</> : <><Copy className="h-4 w-4" aria-hidden />Taklif matnini nusxalash</>}
                </Button>
                <Button variant="outline" onClick={() => void copy(linkOf(current), `l-${current.code}`, "Havolani nusxalang:")}>
                  {copied === `l-${current.code}` ? "Nusxalandi" : "Faqat havola"}
                </Button>
                {canShare && (
                  <Button variant="outline" onClick={() => void navigator.share({ title: current.title || "Onlayn dars", text: textOf(current) }).catch(() => {})}><Share2 className="h-4 w-4" aria-hidden />Ulashish</Button>
                )}
              </div>
            </Card>
          )}

          {rooms.length > 0 && (
            <Card className="p-5">
              <h2 className="text-lg font-extrabold">Oxirgi xonalarim</h2>
              <p className="text-sm text-muted-foreground">Faqat shu qurilmada saqlanadi. Xona o&apos;chmaydi: havolasi bor odam istalgan vaqt kira oladi. Bir xil sinf bilan shu xonani qayta ishlatishingiz mumkin.</p>
              <ul className="mt-3 divide-y divide-border">
                {rooms.map((r) => (
                  <li key={r.code} className="flex flex-wrap items-center justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <p className="truncate font-bold">{r.title || "Nomsiz dars"}</p>
                      <p className="text-xs text-muted-foreground">
                        {kindLabel(r)} · {r.startsAt ? <>dars: {lessonTimeLabel(r.startsAt)} · </> : null}yaratilgan: {fmt(r.at)}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" asChild><a href={startUrl(r)} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-4 w-4" aria-hidden />Kirish</a></Button>
                      <Button size="sm" variant="outline" onClick={() => setCurrent(r)}><Eye className="h-4 w-4" aria-hidden />Havola va QR</Button>
                      <Button size="sm" variant="ghost" onClick={() => remove(r.code)} aria-label={`${r.title || "Nomsiz dars"} xonasini ro'yxatdan olib tashlash`}><Trash2 className="h-4 w-4" aria-hidden /></Button>
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>

        <div className="space-y-5">
          <Card className="p-5">
            <h2 className="text-lg font-extrabold">Birinchi dars uchun tayyorgarlik</h2>
            <p className="text-sm text-muted-foreground">Belgilab chiqing: dars oldidan bir-ikki daqiqa yetadi. Belgilaringiz saqlanadi.</p>
            <ul className="mt-3 space-y-2">
              {CHECK.map((c, i) => (
                <li key={c}>
                  <label className="flex cursor-pointer items-start gap-2.5 text-sm">
                    <input type="checkbox" className="mt-0.5 h-4 w-4 accent-[hsl(var(--success))]" checked={ticks[i]} onChange={() => toggleTick(i)} />
                    <span className={ticks[i] ? "text-muted-foreground line-through" : ""}>{c}</span>
                  </label>
                </li>
              ))}
            </ul>
            {ticks.every(Boolean) && <p className="mt-3 flex items-center gap-2 text-sm font-bold text-success"><CheckCircle2 className="h-4 w-4" aria-hidden />Hammasi tayyor. Omad!</p>}
          </Card>

          <Card className="p-5">
            <h2 className="text-lg font-extrabold">Dars paytida nima qayerda?</h2>
            <dl className="mt-2 space-y-2 text-sm">
              {DURING.map(([k, v]) => (
                <div key={k}><dt className="font-bold">{k}</dt><dd className="text-muted-foreground">{v}</dd></div>
              ))}
            </dl>
          </Card>

          <Card className="p-5 text-sm">
            <p className="flex items-center gap-2 font-extrabold"><Info className="h-4 w-4 text-primary" aria-hidden />Bilib qo&apos;ying</p>
            <ul className="mt-2 space-y-1.5 text-muted-foreground">
              <li>• Dars shu saytning o&apos;zida o&apos;tadi: video yoki ovoz, yozishma va qo&apos;l ko&apos;tarish. O&apos;quvchi boshqa saytga o&apos;tmaydi.</li>
              <li>• <b className="text-foreground">Video dars</b>: o&apos;quvchi ustozni ko&apos;radi va eshitadi. <b className="text-foreground">Ovozli chat</b>: faqat ovoz, kamera yo&apos;q (Telegramdagi ovozli chatga o&apos;xshash).</li>
              <li>• <b className="text-foreground">Ruxsat bilan</b> rejimda o&apos;quvchi gapirish uchun qo&apos;l ko&apos;taradi, siz ruxsat berasiz. <b className="text-foreground">Hamma</b> rejimida hamma gapira oladi (kichik guruh uchun).</li>
              <li>• Havolani faqat o&apos;quvchilarga yuboring: havolasi bor har kim kira oladi.</li>
              <li>• Davomat, o&apos;z chatimiz va yozib olish keyingi bosqichda.</li>
            </ul>
          </Card>
        </div>
      </div>
    </>
  );
}
