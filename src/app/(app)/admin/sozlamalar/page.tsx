"use client";
import * as React from "react";
import { CheckCircle2, CircleSlash, Plug } from "lucide-react";
import { adminModule } from "@/lib/modules";
import { api } from "@/lib/admin-client";
import { useQuery } from "@/lib/use-query";
import { QueryView } from "@/components/layout/query-view";
import { PageHeader } from "@/components/layout/page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/toast";
import type { SettingsMap, SettingKey } from "@/server/settingsdef";
import type { Integration } from "@/server/sysstatus";

type Data = { settings: SettingsMap; integrations: Integration[] };
type Health = { claude: { configured: boolean; model: string | null; ok?: boolean; ms?: number; error?: string }; free: { host: string; model: string; ok: boolean; ms: number; error?: string }[]; checkedAt: string };
const MODULE_NAMES: Record<keyof SettingsMap["modules"], string> = { ai: "USTOZ AI", darsyor: "DARSYOR", toifa: "TOIFA NAVIGATOR", market: "USTOZ MARKET", sinf: "SINF ANALITIKA", bilimxona: "BILIMXONA", bepul: "BEPUL AI" };

function useSave() {
  const toast = useToast(); const [busy, setBusy] = React.useState(false);
  const save = async <K extends SettingKey>(key: K, value: SettingsMap[K], onOk: (v: SettingsMap[K]) => void) => {
    setBusy(true);
    const r = await api<{ value: SettingsMap[K] }>("/api/admin/settings", "PUT", { key, value });
    setBusy(false);
    if (!r.ok) { toast("error", r.error); return; }
    onOk(r.data.value); toast("success", "Sozlama saqlandi.");
  };
  return { save, busy };
}
const numOrNull = (v: string) => (v.trim() === "" ? null : Number(v));

export default function Page() {
  const q = useQuery<Data>("/api/admin/settings");
  return (
    <>
      <PageHeader module={adminModule} title="Sozlamalar" description="Tizim sozlamalari. Maxfiy kalitlar bu yerda saqlanmaydi: ular faqat server muhitida turadi" />
      <QueryView q={q}>{(d) => <Settings d={d} />}</QueryView>
    </>
  );
}

function Settings({ d }: { d: Data }) {
  const [s, setS] = React.useState(d.settings);
  const { save, busy } = useSave();
  const set = <K extends SettingKey>(k: K, v: SettingsMap[K]) => setS((x) => ({ ...x, [k]: v }));
  const put = <K extends SettingKey>(k: K) => save(k, s[k], (v) => set(k, v));
  return (
    <Tabs defaultValue="umumiy">
      <TabsList className="flex-wrap"><TabsTrigger value="umumiy">Umumiy</TabsTrigger><TabsTrigger value="modullar">Modullar</TabsTrigger><TabsTrigger value="ai">AI</TabsTrigger><TabsTrigger value="tolov">To'lov</TabsTrigger><TabsTrigger value="elon">E'lonlar</TabsTrigger><TabsTrigger value="kontent">Kontent</TabsTrigger><TabsTrigger value="xabar">Bildirishnoma</TabsTrigger><TabsTrigger value="ulanish">Ulanishlar</TabsTrigger></TabsList>

      <TabsContent value="umumiy"><Card className="max-w-2xl"><CardContent className="space-y-4">
        <Field label="Tizim nomi"><Input value={s.general.siteName} maxLength={60} onChange={(e) => set("general", { ...s.general, siteName: e.target.value })} /></Field>
        <Field label="Qo'llab-quvvatlash aloqasi" hint="Email yoki Telegram manzil: foydalanuvchilarga ko'rsatiladi (ixtiyoriy)"><Input value={s.general.supportContact} maxLength={200} onChange={(e) => set("general", { ...s.general, supportContact: e.target.value })} /></Field>
        <Button loading={busy} onClick={() => put("general")}>Saqlash</Button>
      </CardContent></Card></TabsContent>

      <TabsContent value="modullar"><Card className="max-w-2xl"><CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">O'chirilgan modul yon menyuda ko'rinmaydi. Ma'lumotlar o'chmaydi.</p>
        {(Object.keys(MODULE_NAMES) as (keyof typeof MODULE_NAMES)[]).map((k) => (
          <label key={k} className="flex min-h-11 items-center justify-between rounded-xl border border-border p-3.5 text-sm font-semibold">{MODULE_NAMES[k]}
            <Switch aria-label={MODULE_NAMES[k]} checked={s.modules[k]} onCheckedChange={(v) => set("modules", { ...s.modules, [k]: v })} /></label>))}
        <Button loading={busy} onClick={() => put("modules")}>Saqlash</Button>
      </CardContent></Card></TabsContent>

      <TabsContent value="ai"><AiTab s={s} set={set} put={put} busy={busy} integrations={d.integrations} /></TabsContent>

      <TabsContent value="tolov"><Card className="max-w-2xl"><CardContent className="space-y-4">
        <Field label="To'lov rejimi" hint="«Provayder» faqat webhook kalitlari ulangandan keyin ishlaydi">
          <Select value={s.payments.mode} onChange={(e) => set("payments", { ...s.payments, mode: e.target.value as SettingsMap["payments"]["mode"] })}>
            <option value="off">Yopiq: sotib olish o'chirilgan</option><option value="manual">Bank o'tkazmasi (admin tasdiqlaydi)</option><option value="provider">Provayder (webhook)</option></Select></Field>
        <Field label="Bank o'tkazmasi ko'rsatmasi" hint="Foydalanuvchi buyurtma bergach shuni ko'radi: karta/hisob raqami va izohga buyurtma kodini yozish"><Textarea value={s.payments.manualInstructions} maxLength={1000} onChange={(e) => set("payments", { ...s.payments, manualInstructions: e.target.value })} /></Field>
        <Button loading={busy} onClick={() => put("payments")}>Saqlash</Button>
        <ul className="space-y-1.5 border-t border-border pt-3 text-sm">{d.integrations.filter((i) => i.id === "payments").map((i) => <Status key={i.id} i={i} />)}</ul>
      </CardContent></Card></TabsContent>

      <TabsContent value="elon"><Card className="max-w-3xl"><CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">Bosh sahifada hamma foydalanuvchiga ko'rinadi. Faqat «faol» va muddati o'tmagan e'lonlar ko'rsatiladi. Havola: sayt ichidagi yo'l (masalan <code>/seminarlar</code>) yoki <code>https://</code>.</p>
        {s.announcements.items.length === 0 && <p className="rounded-xl border border-dashed border-border p-5 text-center text-sm text-muted-foreground">Hali e'lon yo'q.</p>}
        {s.announcements.items.map((a, i) => {
          const upd = (patch: Partial<typeof a>) => set("announcements", { items: s.announcements.items.map((x, k) => (k === i ? { ...x, ...patch } : x)) });
          return (
            <div key={a.id} className="space-y-3 rounded-xl border border-border p-4">
              <Field label="Sarlavha"><Input value={a.title} maxLength={120} onChange={(e) => upd({ title: e.target.value })} /></Field>
              <Field label="Matn (ixtiyoriy)"><Textarea className="min-h-16" value={a.text} maxLength={500} onChange={(e) => upd({ text: e.target.value })} /></Field>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Havola (ixtiyoriy)"><Input value={a.href} maxLength={300} placeholder="/seminarlar" onChange={(e) => upd({ href: e.target.value })} /></Field>
                <Field label="Tugash sanasi (ixtiyoriy)"><Input type="date" value={a.until} onChange={(e) => upd({ until: e.target.value })} /></Field>
              </div>
              <div className="flex items-center justify-between gap-3">
                <label className="flex items-center gap-3"><Switch checked={a.active} onCheckedChange={(v) => upd({ active: v })} aria-label="Faol" /><span className="text-sm font-semibold">Faol</span></label>
                <Button size="sm" variant="ghost" onClick={() => set("announcements", { items: s.announcements.items.filter((_, k) => k !== i) })}>O'chirish</Button>
              </div>
            </div>);
        })}
        <div className="flex flex-wrap gap-2">
          {s.announcements.items.length < 10 && <Button variant="outline" onClick={() => set("announcements", { items: [...s.announcements.items, { id: Math.random().toString(36).slice(2, 10), title: "", text: "", href: "", active: true, until: "" }] })}>E'lon qo'shish</Button>}
          <Button loading={busy} onClick={() => put("announcements")}>Saqlash</Button>
        </div>
      </CardContent></Card></TabsContent>

      <TabsContent value="kontent"><Card className="max-w-2xl"><CardContent className="space-y-4">
        <Field label="AI haqida ogohlantirish" hint="AI natijalari yonida ko'rsatiladi"><Input value={s.content.aiDisclaimer} maxLength={300} onChange={(e) => set("content", { ...s.content, aiDisclaimer: e.target.value })} /></Field>
        <Field label="Kontent siyosati" hint="Mualliflar va foydalanuvchilar uchun qoidalar (matn)"><Textarea className="min-h-40" value={s.content.policy} maxLength={4000} onChange={(e) => set("content", { ...s.content, policy: e.target.value })} /></Field>
        <Button loading={busy} onClick={() => put("content")}>Saqlash</Button>
      </CardContent></Card></TabsContent>

      <TabsContent value="xabar"><Card className="max-w-2xl"><CardContent className="space-y-3">
        {([["enabled", "Bildirishnomalar yoqilgan"], ["seminarAnnouncements", "Yangi seminar haqida hammaga xabar yuborish"]] as const).map(([k, l]) => (
          <label key={k} className="flex min-h-11 items-center justify-between rounded-xl border border-border p-3.5 text-sm font-semibold">{l}
            <Switch aria-label={l} checked={s.notifications[k]} onCheckedChange={(v) => set("notifications", { ...s.notifications, [k]: v })} /></label>))}
        <Button loading={busy} onClick={() => put("notifications")}>Saqlash</Button>
      </CardContent></Card></TabsContent>

      <TabsContent value="ulanish"><Card className="max-w-3xl"><CardHeader><CardTitle>Tashqi xizmatlar</CardTitle></CardHeader><CardContent>
        <p className="mb-3 text-sm text-muted-foreground">Kalitlar Netlify (yoki hosting) «Environment variables» bo'limida kiritiladi. Bu yerda faqat ulangan-ulanmagani ko'rinadi.</p>
        <ul className="space-y-2">{d.integrations.map((i) => <Status key={i.id} i={i} />)}</ul>
      </CardContent></Card></TabsContent>
    </Tabs>
  );
}

function Status({ i }: { i: Integration }) {
  return (
    <li className="rounded-xl border border-border p-3 text-sm">
      <div className="flex items-center justify-between gap-3"><span className="font-semibold">{i.name}</span>
        <Badge variant={i.configured ? "success" : "amber"}>{i.configured ? <><CheckCircle2 className="h-3.5 w-3.5" />Ulangan</> : <><CircleSlash className="h-3.5 w-3.5" />Ulanmagan</>}</Badge></div>
      {!i.configured && <p className="mt-1.5 text-xs text-muted-foreground">Kerak: <code>{i.needs.join(", ")}</code>. {i.hint}</p>}
    </li>
  );
}

type Usage = { days: number; features: { feature: string; calls: number; ok: number; errors: number; blocked: number; latencyMs: number | null; tokens: number; costUsd: number }[] };
function UsageCard() {
  const q = useQuery<Usage>("/api/admin/ai/usage");
  return (
    <Card className="lg:col-span-2"><CardHeader><CardTitle>So'nggi 7 kunlik sarf</CardTitle></CardHeader><CardContent className="px-0">
      <QueryView q={q} skeleton={<p className="px-5 text-sm text-muted-foreground">Yuklanmoqda...</p>}>{(u) => u.features.length === 0 ? <p className="px-5 text-sm text-muted-foreground">Bu davrda AI so'rovi bo'lmagan.</p> : (
        <div className="w-full overflow-x-auto"><table className="w-full min-w-[560px] text-sm"><thead><tr className="text-left text-xs uppercase text-muted-foreground"><th className="px-5 py-2">Funksiya</th><th>So'rov</th><th>Muvaffaqiyatli</th><th>Xato</th><th>Bloklangan</th><th>Kechikish</th><th>Token</th><th>Narx</th></tr></thead>
          <tbody>{u.features.map((f) => <tr key={f.feature} className="border-t border-border/60"><td className="px-5 py-2 font-semibold">{f.feature}</td><td>{f.calls}</td><td>{f.ok}</td><td>{f.errors}</td><td>{f.blocked}</td><td>{f.latencyMs ? `${f.latencyMs} ms` : "—"}</td><td>{f.tokens.toLocaleString("ru-RU")}</td><td>{f.costUsd ? `$${f.costUsd.toFixed(3)}` : "—"}</td></tr>)}</tbody></table></div>)}</QueryView>
    </CardContent></Card>
  );
}

function AiTab({ s, set, put, busy, integrations }: { s: SettingsMap; set: <K extends SettingKey>(k: K, v: SettingsMap[K]) => void; put: (k: SettingKey) => void; busy: boolean; integrations: Integration[] }) {
  const toast = useToast();
  const [h, setH] = React.useState<Health | null>(null); const [testing, setTesting] = React.useState(false);
  const test = async () => {
    setTesting(true); const r = await api<Health>("/api/admin/ai/test", "POST"); setTesting(false);
    if (!r.ok) { toast("error", r.error); return; }
    setH(r.data);
  };
  const a = s.ai;
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card><CardHeader><CardTitle>Limitlar va narx</CardTitle></CardHeader><CardContent className="space-y-4">
        <label className="flex min-h-11 items-center justify-between rounded-xl border border-border p-3.5 text-sm font-semibold">AI yoqilgan<Switch aria-label="AI yoqilgan" checked={a.enabled} onCheckedChange={(v) => set("ai", { ...a, enabled: v })} /></label>
        <label className="flex min-h-11 items-center justify-between rounded-xl border border-border p-3.5 text-sm font-semibold">Bepul AI yoqilgan<Switch aria-label="Bepul AI yoqilgan" checked={a.freeEnabled} onCheckedChange={(v) => set("ai", { ...a, freeEnabled: v })} /></label>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Kunlik limit (FREE)" hint="Bo'sh: server standarti. PRO ×2, PREMIUM ×3"><Input type="number" min={1} value={a.dailyLimit ?? ""} onChange={(e) => set("ai", { ...a, dailyLimit: numOrNull(e.target.value) })} /></Field>
          <Field label="Bepul AI kunlik limiti" hint="Bo'sh: server standarti"><Input type="number" min={1} value={a.freeDailyLimit ?? ""} onChange={(e) => set("ai", { ...a, freeDailyLimit: numOrNull(e.target.value) })} /></Field>
          <Field label="Daqiqada so'rov"><Input type="number" min={1} max={120} value={a.perMinute} onChange={(e) => set("ai", { ...a, perMinute: Number(e.target.value) || 1 })} /></Field>
          <span />
          <Field label="Kirish narxi, USD / 1 mln token" hint="0: xarajat hisoblanmaydi"><Input type="number" min={0} step="0.01" value={a.priceInPerMTok} onChange={(e) => set("ai", { ...a, priceInPerMTok: Number(e.target.value) || 0 })} /></Field>
          <Field label="Chiqish narxi, USD / 1 mln token"><Input type="number" min={0} step="0.01" value={a.priceOutPerMTok} onChange={(e) => set("ai", { ...a, priceOutPerMTok: Number(e.target.value) || 0 })} /></Field>
        </div>
        <Button loading={busy} onClick={() => put("ai")}>Saqlash</Button>
      </CardContent></Card>
      <Card><CardHeader><CardTitle>Ulanish holati</CardTitle></CardHeader><CardContent className="space-y-3">
        <ul className="space-y-2">{integrations.filter((i) => i.id.startsWith("ai-")).map((i) => <Status key={i.id} i={i} />)}</ul>
        <Button variant="outline" loading={testing} onClick={test}><Plug className="h-4 w-4" />Ulanishni sinash</Button>
        {h && (
          <div className="space-y-1.5 rounded-xl bg-muted p-3 text-sm" aria-live="polite">
            {!h.claude.configured && h.free.length === 0 && <p>Hech qaysi AI xizmati ulanmagan: sinash uchun xizmat yo'q.</p>}
            {h.claude.configured && <p>Claude{h.claude.model ? ` (${h.claude.model})` : ""}: <b className={h.claude.ok ? "text-success" : "text-danger"}>{h.claude.ok ? "ishlayapti" : `xato (${h.claude.error ?? "?"})`}</b> · {h.claude.ms} ms</p>}
            {h.free.map((f) => <p key={f.host}>{f.host} ({f.model}): <b className={f.ok ? "text-success" : "text-danger"}>{f.ok ? "ishlayapti" : `xato (${f.error ?? "?"})`}</b> · {f.ms} ms</p>)}
          </div>)}
      </CardContent></Card>
      <UsageCard />
    </div>
  );
}
