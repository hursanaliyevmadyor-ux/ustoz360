"use client";
import * as React from "react";
import { CheckCircle2, Copy, ExternalLink, Info, Link2, Play, Send, Trash2, Video } from "lucide-react";
import { PageHeader } from "@/components/layout/page";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/form";
import {
  ROOMS_KEY, addSavedRoom, cleanTitle, joinUrl, newRoomCode, parseSavedRooms, telegramShareUrl, type SavedRoom,
} from "@/lib/dars";

const read = () => { try { return localStorage.getItem(ROOMS_KEY); } catch { return null; } };
const save = (l: SavedRoom[]) => { try { localStorage.setItem(ROOMS_KEY, JSON.stringify(l)); } catch { /* maxfiy rejim */ } };

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

export default function Page() {
  const [title, setTitle] = React.useState("");
  const [rooms, setRooms] = React.useState<SavedRoom[]>([]);
  const [origin, setOrigin] = React.useState("");
  const [current, setCurrent] = React.useState<SavedRoom | null>(null);
  const [copied, setCopied] = React.useState("");
  const [ticks, setTicks] = React.useState<boolean[]>(() => CHECK.map(() => false));

  React.useEffect(() => { setOrigin(window.location.origin); setRooms(parseSavedRooms(read())); }, []);

  function create() {
    const room: SavedRoom = { code: newRoomCode(), title: cleanTitle(title), at: Date.now() };
    const next = addSavedRoom(rooms, room);
    setRooms(next); save(next); setCurrent(room); setTitle("");
  }
  function remove(code: string) {
    const next = rooms.filter((r) => r.code !== code);
    setRooms(next); save(next);
    if (current?.code === code) setCurrent(null);
  }
  async function copy(room: SavedRoom) {
    const link = joinUrl(origin, room.code, room.title);
    try { await navigator.clipboard.writeText(link); }
    catch { window.prompt("Havolani nusxalang:", link); }
    setCopied(room.code); setTimeout(() => setCopied((c) => (c === room.code ? "" : c)), 2500);
  }

  const RoomActions = ({ room }: { room: SavedRoom }) => {
    const link = origin ? joinUrl(origin, room.code, room.title) : "";
    const text = room.title ? `Dars: ${room.title}. Kirish uchun havola:` : "Onlayn darsga kirish uchun havola:";
    return (
      <div className="flex flex-wrap gap-2">
        <Button asChild><a href={origin ? joinUrl(origin, room.code, room.title, true) : "#"} target="_blank" rel="noopener noreferrer"><Play className="h-4 w-4" aria-hidden />Darsni boshlash</a></Button>
        <Button variant="outline" onClick={() => copy(room)}>{copied === room.code ? <><CheckCircle2 className="h-4 w-4 text-success" aria-hidden />Nusxalandi</> : <><Copy className="h-4 w-4" aria-hidden />Havolani nusxalash</>}</Button>
        <Button variant="outline" asChild><a href={link ? telegramShareUrl(link, text) : "#"} target="_blank" rel="noopener noreferrer"><Send className="h-4 w-4" aria-hidden />Telegramda yuborish</a></Button>
      </div>
    );
  };

  return (
    <>
      <PageHeader title="Dars xonasi" description="Onlayn dars o'tkazing: o'quvchilar havola orqali kiradi, hisob ochish shart emas" />

      <div className="grid gap-5 lg:grid-cols-[1fr_22rem]">
        <div className="space-y-5">
          <Card className="p-5">
            <h2 className="text-lg font-extrabold">Yangi dars xonasi</h2>
            <ol className="mt-2 space-y-1 text-sm text-muted-foreground">
              <li><b className="text-foreground">1.</b> Dars nomini yozing (ixtiyoriy).</li>
              <li><b className="text-foreground">2.</b> «Xona yaratish» ni bosing: havola tayyor bo&apos;ladi.</li>
              <li><b className="text-foreground">3.</b> Havolani Telegramda o&apos;quvchilarga yuboring.</li>
              <li><b className="text-foreground">4.</b> O&apos;zingiz «Darsni boshlash» ni bosing. Birinchi bo&apos;lib siz kiring: xonani siz ochasiz.</li>
            </ol>
            <form className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end" onSubmit={(e) => { e.preventDefault(); create(); }}>
              <Field label="Dars nomi (ixtiyoriy)" className="flex-1">
                <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} placeholder="Masalan: 5-sinf matematika, kasr sonlar" />
              </Field>
              <Button type="submit" size="lg"><Video className="h-5 w-5" aria-hidden />Xona yaratish</Button>
            </form>
          </Card>

          {current && (
            <Card className="border-success/40 p-5" aria-live="polite">
              <p className="flex items-center gap-2 font-extrabold text-success"><CheckCircle2 className="h-5 w-5" aria-hidden />Xona tayyor{current.title ? `: ${current.title}` : ""}</p>
              <p className="mt-3 text-sm font-semibold">O&apos;quvchilar uchun havola:</p>
              <div className="mt-1.5 flex items-center gap-2 rounded-xl bg-muted px-3 py-2.5">
                <Link2 className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                <code className="min-w-0 flex-1 select-all break-all text-sm">{origin ? joinUrl(origin, current.code, current.title) : "..."}</code>
              </div>
              <div className="mt-4"><RoomActions room={current} /></div>
              <div className="mt-4 rounded-xl bg-primary/5 p-3 text-sm">
                <p className="font-bold">O&apos;quvchi nima qiladi?</p>
                <ol className="mt-1 list-decimal space-y-0.5 pl-5 text-muted-foreground">
                  <li>Havolani bosadi (Telegramdan ham bo&apos;ladi).</li>
                  <li>Kamera va mikrofonga ruxsat beradi.</li>
                  <li>Ismini yozib, «Darsga kirish» ni bosadi.</li>
                </ol>
              </div>
            </Card>
          )}

          {rooms.length > 0 && (
            <Card className="p-5">
              <h2 className="text-lg font-extrabold">Oxirgi xonalarim</h2>
              <p className="text-sm text-muted-foreground">Faqat shu qurilmada saqlanadi. Xona o&apos;chmaydi: havolasi bor odam istalgan vaqt kira oladi.</p>
              <ul className="mt-3 divide-y divide-border">
                {rooms.map((r) => (
                  <li key={r.code} className="flex flex-wrap items-center justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <p className="truncate font-bold">{r.title || "Nomsiz dars"}</p>
                      <p className="text-xs text-muted-foreground">{fmt(r.at)}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" asChild><a href={origin ? joinUrl(origin, r.code, r.title, true) : "#"} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-4 w-4" aria-hidden />Kirish</a></Button>
                      <Button size="sm" variant="outline" onClick={() => copy(r)}>{copied === r.code ? "Nusxalandi" : "Havola"}</Button>
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
            <p className="text-sm text-muted-foreground">Belgilab chiqing: dars oldidan bir-ikki daqiqa yetadi.</p>
            <ul className="mt-3 space-y-2">
              {CHECK.map((c, i) => (
                <li key={c}>
                  <label className="flex cursor-pointer items-start gap-2.5 text-sm">
                    <input type="checkbox" className="mt-0.5 h-4 w-4 accent-[hsl(var(--success))]" checked={ticks[i]} onChange={() => setTicks((t) => t.map((v, j) => (j === i ? !v : v)))} />
                    <span className={ticks[i] ? "text-muted-foreground line-through" : ""}>{c}</span>
                  </label>
                </li>
              ))}
            </ul>
            {ticks.every(Boolean) && <p className="mt-3 flex items-center gap-2 text-sm font-bold text-success"><CheckCircle2 className="h-4 w-4" aria-hidden />Hammasi tayyor. Omad!</p>}
          </Card>

          <Card className="p-5 text-sm">
            <p className="flex items-center gap-2 font-extrabold"><Info className="h-4 w-4 text-primary" aria-hidden />Bilib qo&apos;ying</p>
            <ul className="mt-2 space-y-1.5 text-muted-foreground">
              <li>• Video, ovoz va yozishma (chat) <b className="text-foreground">Jitsi</b> orqali ishlaydi. Chat, qo&apos;l ko&apos;tarish va ekran ulashish tayyor.</li>
              <li>• Jitsi umumiy serverida xonani ochgan kishidan (ustozdan) ba&apos;zan Google yoki boshqa hisob bilan kirish so&apos;raladi. O&apos;quvchilardan so&apos;ralmaydi.</li>
              <li>• Havolani faqat o&apos;quvchilarga yuboring: havolasi bor har kim kira oladi.</li>
              <li>• Bu birinchi, oddiy versiya. Davomat, o&apos;z chatimiz va yozib olish keyingi bosqichda.</li>
            </ul>
          </Card>
        </div>
      </div>
    </>
  );
}
