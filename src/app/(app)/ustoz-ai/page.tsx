import Link from "next/link";
import { ArrowRight, ClipboardCheck, Map, NotebookPen, CalendarCheck, ListChecks } from "lucide-react";
import { modules } from "@/lib/modules";
import { PageHeader } from "@/components/layout/page";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const m = modules[0];
const feats = [
  { href: "/ustoz-ai/diagnostika", icon: ClipboardCheck, t: "Diagnostika", d: "Savollar bo'yicha bilim darajangizni aniqlang." },
  { href: "/ustoz-ai/testlar", icon: ListChecks, t: "Test rejimlari", d: "Mashq, vaqtli, mavzuli va xatolar testi." },
  { href: "/ustoz-ai/bilim-xaritasi", icon: Map, t: "Bilim xaritasi", d: "Kuchli va zaif mavzular bir ko'rinishda." },
  { href: "/ustoz-ai/xatolar", icon: NotebookPen, t: "Xatolar daftari", d: "Xatolar oraliqli takrorlash bilan qaytadi." },
  { href: "/ustoz-ai/reja", icon: CalendarCheck, t: "Shaxsiy reja", d: "Imtihon sanasi va vaqtingizga mos kunlik reja." },
];
export default function Page() {
  return (
    <>
      <PageHeader module={m} title="USTOZ AI" description="Attestatsiya va milliy sertifikatga individual tayyorgarlik"
        actions={<Button asChild><Link href="/ustoz-ai/diagnostika">Diagnostikani boshlash<ArrowRight className="h-4 w-4" /></Link></Button>} />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {feats.map((f) => (
          <Link key={f.href} href={f.href}><Card className="h-full p-5 hover:shadow-pop">
            <span className={`grid h-11 w-11 place-items-center rounded-xl ${m.soft} ${m.text}`}><f.icon className="h-5 w-5" aria-hidden /></span>
            <p className="mt-3 font-extrabold">{f.t}</p><p className="text-sm text-muted-foreground">{f.d}</p>
          </Card></Link>
        ))}
      </div>
    </>
  );
}
