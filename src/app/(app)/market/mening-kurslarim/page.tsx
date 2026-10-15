import Link from "next/link";
import { modules } from "@/lib/modules";
import { PageHeader } from "@/components/layout/page";
import { EmptyState } from "@/components/ui/states";
import { Button } from "@/components/ui/button";
import { BookOpen } from "lucide-react";
export default function Page() {
  return (<><PageHeader module={modules[3]} title="Mening kurslarim" description="Sotib olingan kurslar va o'qish progressi" />
    <EmptyState icon={BookOpen} title="Hali kurs yo'q" text="Sotib olingan kurslar shu yerda ko'rinadi. Katalogdan o'zingizga mosini tanlang." action={<Button asChild><Link href="/market">Katalogga o'tish</Link></Button>} /></>);
}
