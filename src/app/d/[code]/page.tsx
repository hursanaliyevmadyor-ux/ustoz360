import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BrandMark } from "@/components/brand-mark";
import { JoinRoom } from "@/components/dars/join-room";
import { cleanTitle, isRoomCode, parseStartsAt } from "@/lib/dars";
import { voiceConfig } from "@/server/voice";
import { isVoiceMode, verifyRoom } from "@/server/voicelogic";

type Props = { params: Promise<{ code: string }>; searchParams: Promise<{ t?: string | string[]; u?: string | string[]; s?: string | string[]; r?: string | string[]; k?: string | string[]; h?: string | string[] }> };
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/** Xona havolasi qidiruv tizimlariga chiqmasin (faqat havola bilan kiriladi). */
export const metadata: Metadata = { title: "Dars xonasi — USTOZ 360", robots: { index: false, follow: false } };

/** Ochiq sahifa: hisob ochmasdan, havola orqali (masalan Telegramdan) kiriladi. */
export default async function Page({ params, searchParams }: Props) {
  const { code } = await params;
  if (!isRoomCode(code)) notFound();
  const sp = await searchParams;
  const title = cleanTitle(one(sp.t));
  const asTeacher = one(sp.u) === "1";
  const startsAt = parseStartsAt(one(sp.s));

  // Ovozli xona (saytimiz ichida): havola imzosi serverda tekshiriladi; ustoz imzosi faqat to'g'ri bo'lsa o'tadi.
  const r = one(sp.r), k = one(sp.k), h = one(sp.h);
  let voice: { mode: "s" | "e"; k: string; h?: string } | null = null;
  let voiceProblem = "";
  if (r !== undefined) {
    const cfg = voiceConfig();
    if (!cfg) voiceProblem = "Ovozli xona hozircha ishlamayapti. Ustoz bilan bog'laning.";
    else {
      const role = isVoiceMode(r) ? verifyRoom(cfg.authSecret, { code, mode: r, k, h }) : null;
      if (!role || !isVoiceMode(r) || !k) voiceProblem = "Havola noto'g'ri yoki eskirgan. Ustozdan yangi havola so'rang.";
      else voice = { mode: r, k, ...(role === "host" && h && { h }) };
    }
  }
  return (
    <main className="min-h-dvh bg-background px-4 py-6">
      <header className="mx-auto mb-5 flex max-w-xl items-center gap-2.5">
        <BrandMark className="h-9 w-9" />
        <span className="text-lg font-black tracking-tight">USTOZ <span className="text-primary">360</span></span>
      </header>
      {voiceProblem
        ? <p role="alert" className="mx-auto max-w-xl rounded-2xl bg-danger/10 p-5 text-center font-semibold text-danger">{voiceProblem}</p>
        : <JoinRoom code={code} title={title} asTeacher={asTeacher && (!voice || !!voice.h)} startsAt={startsAt} voice={voice} />}
    </main>
  );
}
