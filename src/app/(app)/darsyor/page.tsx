import Link from "next/link";
import { ArrowRight, FileText, ListChecks, Shapes, ClipboardList } from "lucide-react";
import { modules } from "@/lib/modules";
import { PageHeader } from "@/components/layout/page";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const m = modules[1];
const feats = [
  { href: "/darsyor/dars-ishlanmasi", i: FileText, t: "Dars ishlanmasi", d: "Maqsad, bosqichlar, baholash va uy vazifasi bilan." },
  { href: "/darsyor/test-generator", i: ListChecks, t: "Test generatori", d: "8 turdagi savol, javob va izoh bilan." },
  { href: "/darsyor/korgazma", i: Shapes, t: "Ko'rgazmali materiallar", d: "Venn, klaster, Frayer, baliq skeleti shablonlari." },
  { href: "/darsyor/baholash", i: ClipboardList, t: "Baholash materiallari", d: "Rubrika, mezonlar, kuzatuv varaqasi." },
];
export default function Page() {
  return (
    <>
      <PageHeader module={m} title="DARSYOR" description="Kundalik darsga tayyorlanish vaqtini kamaytiring"
        actions={<Button asChild><Link href="/darsyor/dars-ishlanmasi">Ishlanma yaratish<ArrowRight className="h-4 w-4" /></Link></Button>} />
      <div className="grid gap-4 sm:grid-cols-2">
        {feats.map((f) => <Link key={f.href} href={f.href}><Card className="h-full p-5 hover:shadow-pop">
          <span className={`grid h-11 w-11 place-items-center rounded-xl ${m.soft} ${m.text}`}><f.i className="h-5 w-5" aria-hidden /></span>
          <p className="mt-3 font-extrabold">{f.t}</p><p className="text-sm text-muted-foreground">{f.d}</p></Card></Link>)}
      </div>
    </>
  );
}
