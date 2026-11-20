import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BrandMark } from "@/components/brand-mark";
import { JoinRoom } from "@/components/dars/join-room";
import { cleanTitle, isRoomCode } from "@/lib/dars";

type Props = { params: Promise<{ code: string }>; searchParams: Promise<{ t?: string | string[]; u?: string | string[] }> };
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
  return (
    <main className="min-h-dvh bg-background px-4 py-6">
      <header className="mx-auto mb-5 flex max-w-xl items-center gap-2.5">
        <BrandMark className="h-9 w-9" />
        <span className="text-lg font-black tracking-tight">USTOZ <span className="text-primary">360</span></span>
      </header>
      <JoinRoom code={code} title={title} asTeacher={asTeacher} />
    </main>
  );
}
