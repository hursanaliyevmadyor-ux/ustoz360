import Link from "next/link";
import { ArrowLeft } from "lucide-react";

/** USTOZ AI ichidagi barcha bo'lim ekranlari uchun yagona sarlavha: orqaga havola, sarlavha va qisqa izoh. */
export function SectionHeader({ title, lead, back }: { title: string; lead: string; back?: { href: string; label: string } }) {
  return (
    <header className="mb-6">
      {back && <Link href={back.href} className="mb-3 flex w-fit items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" aria-hidden />{back.label}</Link>}
      <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">{title}</h1>
      <p className="mt-1.5 text-muted-foreground">{lead}</p>
    </header>
  );
}
