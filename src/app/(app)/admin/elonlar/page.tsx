"use client";
import * as React from "react";
import { Plus, Trash2 } from "lucide-react";
import { adminModule } from "@/lib/modules";
import { api } from "@/lib/admin-client";
import { useQuery } from "@/lib/use-query";
import { QueryView } from "@/components/layout/query-view";
import { PageHeader } from "@/components/layout/page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Field, Input, Textarea } from "@/components/ui/form";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/ui/toast";

type Item = { id: string; title: string; text: string; href: string; active: boolean; until: string };
const today = () => new Date(Date.now() + 5 * 3_600_000).toISOString().slice(0, 10);

function Editor({ initial }: { initial: Item[] }) {
  const toast = useToast();
  const [items, setItems] = React.useState<Item[]>(initial);
  const [busy, setBusy] = React.useState(false);
  const upd = (i: number, p: Partial<Item>) => setItems((s) => s.map((x, k) => (k === i ? { ...x, ...p } : x)));
  const save = async () => {
    setBusy(true);
    const r = await api<{ value: { items: Item[] } }>("/api/admin/settings", "PUT", { key: "announcements", value: { items } });
    setBusy(false);
    if (!r.ok) { toast("error", r.error); return; }
    setItems(r.data.value.items); toast("success", "Saqlandi. Bosh sahifada ko'rinadi.");
  };
  return (
    <div className="max-w-3xl space-y-4">
      <p className="text-sm text-muted-foreground">Ustozlarning bosh sahifasida ko'rinadi. Faqat «faol» va muddati o'tmagan e'lonlar ko'rsatiladi. Havola: sayt ichidagi yo'l (<code>/seminarlar</code>) yoki <code>https://</code>.</p>
      {items.length === 0 && <p className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">Hali e'lon yo'q.</p>}
      {items.map((a, i) => {
        const expired = !!a.until && a.until < today();
        return (
          <Card key={a.id}><CardContent className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">{a.active && !expired ? <Badge variant="success">Ko'rinadi</Badge> : <Badge variant="neutral">{expired ? "Muddati o'tgan" : "Yashirin"}</Badge>}</div>
            <Field label="Sarlavha"><Input value={a.title} maxLength={120} onChange={(e) => upd(i, { title: e.target.value })} /></Field>
            <Field label="Matn (ixtiyoriy)"><Textarea className="min-h-16" value={a.text} maxLength={500} onChange={(e) => upd(i, { text: e.target.value })} /></Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Havola (ixtiyoriy)"><Input value={a.href} maxLength={300} placeholder="/seminarlar" onChange={(e) => upd(i, { href: e.target.value })} /></Field>
              <Field label="Tugash sanasi (ixtiyoriy)"><Input type="date" value={a.until} onChange={(e) => upd(i, { until: e.target.value })} /></Field>
            </div>
            <div className="flex items-center justify-between gap-3">
              <label className="flex items-center gap-3"><Switch checked={a.active} onCheckedChange={(v) => upd(i, { active: v })} aria-label="Faol" /><span className="text-sm font-semibold">Faol</span></label>
              <Button size="sm" variant="ghost" onClick={() => setItems((s) => s.filter((_, k) => k !== i))}><Trash2 className="h-4 w-4 text-danger" />O'chirish</Button>
            </div>
          </CardContent></Card>);
      })}
      <div className="flex flex-wrap gap-2">
        {items.length < 10 && <Button variant="outline" onClick={() => setItems((s) => [{ id: Math.random().toString(36).slice(2, 10), title: "", text: "", href: "", active: true, until: "" }, ...s])}><Plus className="h-4 w-4" />Yangi e'lon</Button>}
        <Button loading={busy} onClick={save}>Saqlash</Button>
      </div>
    </div>
  );
}

export default function Page() {
  const q = useQuery<{ settings: { announcements: { items: Item[] } } }>("/api/admin/settings");
  return (
    <>
      <PageHeader module={adminModule} title="Yangilik va e'lonlar" description="Ustozlarning bosh sahifasida ko'rinadigan yangiliklar" />
      <QueryView q={q}>{(d) => <Editor initial={d.settings.announcements.items} />}</QueryView>
    </>
  );
}
