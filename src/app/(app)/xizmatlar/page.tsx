import Link from "next/link";
import { allModules } from "@/lib/modules";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/layout/page";
import { cn } from "@/lib/utils";

export default function Services() {
  return (
    <>
      <PageHeader title="Barcha xizmatlar" description="Oltita modul bitta akkaunt ostida" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {allModules.map((m) => (
          <Link key={m.key} href={m.href}>
            <Card className="h-full p-5 hover:shadow-pop">
              <span className={cn("grid h-12 w-12 place-items-center rounded-2xl text-white", m.bg)}><m.icon className="h-6 w-6" aria-hidden /></span>
              <p className="mt-3 text-lg font-extrabold">{m.name}</p>
              <p className="text-sm text-muted-foreground">{m.short}</p>
              <ul className="mt-3 space-y-1 text-sm">{m.subs.map((s) => <li key={s.href} className="text-muted-foreground">• {s.label}</li>)}</ul>
            </Card>
          </Link>
        ))}
      </div>
    </>
  );
}
