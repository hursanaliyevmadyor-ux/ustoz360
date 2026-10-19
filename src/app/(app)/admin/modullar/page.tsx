"use client";
import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BarChart3, Eye, Settings2 } from "lucide-react";
import { adminModule, modules } from "@/lib/modules";
import { api } from "@/lib/admin-client";
import { cn } from "@/lib/utils";
import { useQuery } from "@/lib/use-query";
import { QueryView } from "@/components/layout/query-view";
import { PageHeader } from "@/components/layout/page";
import { useShell } from "@/components/layout/shell-context";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/ui/toast";

type Mods = Record<string, boolean>;
const INFO: Record<string, { stat: string; manage: { href: string; label: string }[]; note?: string }> = {
  ai: { stat: "ustoz-ai", manage: [{ href: "/admin/savollar", label: "Savollar banki" }, { href: "/admin/mavzular", label: "Fanlar va mavzular" }, { href: "/admin/imtihonlar", label: "Imtihonlar" }] },
  darsyor: { stat: "darsyor", manage: [{ href: "/admin/sozlamalar", label: "AI limitlari" }], note: "Ustozlarning dars ishlanmalari va materiallari shaxsiy: admin faqat statistikani ko'radi." },
  toifa: { stat: "toifa", manage: [{ href: "/admin/rasmiy", label: "Rasmiy ma'lumotlar" }] },
  market: { stat: "market", manage: [{ href: "/admin/kurslar", label: "Kurslar" }, { href: "/admin/tolovlar", label: "To'lovlar" }, { href: "/admin/sozlamalar", label: "To'lov rejimi" }] },
  sinf: { stat: "sinf", manage: [], note: "Sinflar, o'quvchi taxalluslari va ballari ustozga tegishli: admin faqat yig'ma statistikani ko'radi." },
  bilimxona: { stat: "bilimxona", manage: [{ href: "/admin/kutubxona", label: "Kutubxona" }] },
  bepul: { stat: "ai", manage: [{ href: "/admin/sozlamalar", label: "AI sozlamalari" }, { href: "/admin/ai-bilim", label: "AI Bilim markazi" }] },
};

function List({ initial }: { initial: Mods }) {
  const toast = useToast(); const router = useRouter(); const { setView } = useShell();
  const [mods, setMods] = React.useState<Mods>(initial);
  const [busy, setBusy] = React.useState("");
  const toggle = async (key: string, v: boolean) => {
    const next = { ...mods, [key]: v };
    setBusy(key);
    const r = await api<{ value: Mods }>("/api/admin/settings", "PUT", { key: "modules", value: next });
    setBusy("");
    if (!r.ok) { toast("error", r.error); return; }
    setMods(r.data.value); toast("success", v ? "Modul yoqildi." : "Modul ustozlar menyusidan yashirildi.");
  };
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {modules.map((m) => {
        const info = INFO[m.key]; const on = mods[m.key] !== false;
        return (
          <Card key={m.key} className="flex flex-col p-5">
            <div className="flex items-start gap-3">
              <span className={cn("grid h-11 w-11 shrink-0 place-items-center rounded-xl text-white", m.bg)}><m.icon className="h-5 w-5" aria-hidden /></span>
              <div className="min-w-0 flex-1"><p className="font-extrabold">{m.name}</p><p className="text-sm text-muted-foreground">{m.short}</p></div>
              <Switch checked={on} disabled={busy === m.key} onCheckedChange={(v) => toggle(m.key, v)} aria-label={`${m.name}: ustozlarga ko'rinsin`} />
            </div>
            <div className="mt-3"><Badge variant={on ? "success" : "neutral"}>{on ? "Ustozlarga ko'rinadi" : "Yashirin"}</Badge></div>
            {info.note && <p className="mt-3 rounded-xl bg-muted px-3 py-2 text-xs">{info.note}</p>}
            <div className="mt-4 flex flex-wrap gap-2">
              <Button asChild size="sm" variant="outline"><Link href={`/admin/statistika?tab=${info.stat}`}><BarChart3 className="h-4 w-4" />Statistika</Link></Button>
              {info.manage.map((x) => <Button key={x.href + x.label} asChild size="sm" variant="outline"><Link href={x.href}><Settings2 className="h-4 w-4" />{x.label}</Link></Button>)}
              <Button size="sm" variant="ghost" onClick={() => { setView("teacher"); router.push(m.href); }}><Eye className="h-4 w-4" />Ustoz ko'rinishida ochish</Button>
            </div>
          </Card>);
      })}
    </div>
  );
}

export default function Page() {
  const q = useQuery<{ settings: { modules: Mods } }>("/api/admin/settings");
  return (
    <>
      <PageHeader module={adminModule} title="Modullar" description="Har bir yo'nalishni yoqish yoki yashirish, statistikasini ko'rish va kontentini boshqarish" />
      <QueryView q={q}>{(d) => <List initial={d.settings.modules} />}</QueryView>
    </>
  );
}
