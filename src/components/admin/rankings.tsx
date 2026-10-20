"use client";
import * as React from "react";
import { Plus, RefreshCw, Trash2 } from "lucide-react";
import { api } from "@/lib/admin-client";
import { useQuery } from "@/lib/use-query";
import { Avatar } from "@/components/avatar";
import { QueryView } from "@/components/layout/query-view";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/form";
import { Switch } from "@/components/ui/switch";
import { Table, Td, Th } from "@/components/ui/table";
import { useToast } from "@/components/ui/toast";

type Settings = { enabled: boolean; directions: { key: string; label: string }[]; examWeight: number; diagWeight: number; maxAttempts: number; minParticipants: number; minDiagnostics: number; seasonStart: string };
type ExamRow = { id: string; title: string; subject: string; active: boolean; directionKey: string | null; rankingEligible: boolean; attempts: number; participants?: number; calibrated?: boolean };
type Person = { userId: string; nickname: string; name: string; hasAvatar: boolean; direction: string | null; optIn: boolean; hidden: boolean };
type Overview = { settings: Settings; exams: ExamRow[]; diagnostics: { participants: number; calibrated: boolean }; standings: number; optedIn: number; participants: Person[] };

const num = (v: string, d: number) => { const n = Number(v); return Number.isFinite(n) ? Math.round(n) : d; };

function SettingsCard({ initial, onSaved }: { initial: Settings; onSaved: () => void }) {
  const toast = useToast();
  const [s, setS] = React.useState(initial);
  const [busy, setBusy] = React.useState(false);
  const save = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true);
    const r = await api("/api/admin/rankings/settings", "PUT", { settings: s });
    setBusy(false);
    if (!r.ok) { toast("error", r.error); return; }
    toast("success", "Reyting sozlamalari saqlandi."); onSaved();
  };
  const upDir = (i: number, p: Partial<{ key: string; label: string }>) => setS((x) => ({ ...x, directions: x.directions.map((d, k) => (k === i ? { ...d, ...p } : d)) }));
  return (
    <Card>
      <CardHeader><div><CardTitle>Sozlamalar</CardTitle><CardDescription>Vaznlar mahsulot taklifi: ilmiy tasdiqlangan universal formula emas. O&apos;zgartirsangiz, reyting darhol qayta hisoblanadi.</CardDescription></div></CardHeader>
      <CardContent>
        <form onSubmit={save} className="space-y-5">
          <label className="flex items-center gap-3"><Switch checked={s.enabled} onCheckedChange={(v) => setS({ ...s, enabled: v })} aria-label="Reyting yoqilgan" /><span className="text-sm"><b>Reyting yoqilgan</b><span className="block text-muted-foreground">O&apos;chiq bo&apos;lsa, /reyting sahifasida «o&apos;chirilgan» deb ko&apos;rsatiladi; natijalar saqlanadi.</span></span></label>

          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Imtihon simulyatori vazni (%)"><Input type="number" min={0} max={100} value={s.examWeight} onChange={(e) => setS({ ...s, examWeight: num(e.target.value, 0) })} /></Field>
            <Field label="Diagnostika vazni (%)"><Input type="number" min={0} max={100} value={s.diagWeight} onChange={(e) => setS({ ...s, diagWeight: num(e.target.value, 0) })} /></Field>
            <Field label="Bir imtihondan hisoblanadigan urinishlar" hint="Dastlabki N tadan eng yaxshisi"><Input type="number" min={1} max={10} value={s.maxAttempts} onChange={(e) => setS({ ...s, maxAttempts: num(e.target.value, 1) })} /></Field>
            <Field label="Taqqoslash uchun minimal ishtirokchi" hint="Imtihon shuncha ustoz topshirmaguncha o'rin hisoblanmaydi"><Input type="number" min={2} max={500} value={s.minParticipants} onChange={(e) => setS({ ...s, minParticipants: num(e.target.value, 2) })} /></Field>
            <Field label="Kerakli diagnostikalar soni"><Input type="number" min={0} max={10} value={s.minDiagnostics} onChange={(e) => setS({ ...s, minDiagnostics: num(e.target.value, 0) })} /></Field>
            <Field label="Mavsum boshlanishi" hint="Bo'sh: barcha vaqt"><Input type="date" value={s.seasonStart} onChange={(e) => setS({ ...s, seasonStart: e.target.value })} /></Field>
          </div>

          <fieldset className="space-y-2">
            <legend className="mb-1 text-sm font-semibold">Reyting yo&apos;nalishlari</legend>
            {s.directions.map((d, i) => (
              <div key={i} className="flex flex-wrap items-center gap-2">
                <Input value={d.key} onChange={(e) => upDir(i, { key: e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, "") })} className="h-10 w-44" aria-label="Kalit" placeholder="KALIT" maxLength={30} />
                <Input value={d.label} onChange={(e) => upDir(i, { label: e.target.value })} className="h-10 min-w-0 flex-1" aria-label="Nomi" placeholder="Nomi" maxLength={40} />
                <Button type="button" variant="ghost" size="icon" aria-label="Yo'nalishni olib tashlash" disabled={s.directions.length <= 1} onClick={() => setS((x) => ({ ...x, directions: x.directions.filter((_, k) => k !== i) }))}><Trash2 className="h-4 w-4" aria-hidden /></Button>
              </div>
            ))}
            {s.directions.length < 12 && <Button type="button" variant="outline" size="sm" onClick={() => setS((x) => ({ ...x, directions: [...x.directions, { key: "", label: "" }] }))}><Plus className="h-4 w-4" aria-hidden />Yo&apos;nalish qo&apos;shish</Button>}
            <p className="text-xs text-muted-foreground">Kalit profilda tanlangan yo&apos;nalish va imtihon yo&apos;nalishi bilan bog&apos;lanadi: mavjud kalitlarni o&apos;zgartirmang.</p>
          </fieldset>
          <Button type="submit" loading={busy}>Saqlash</Button>
        </form>
      </CardContent>
    </Card>
  );
}

function ExamsCard({ data, onSaved }: { data: Overview; onSaved: () => void }) {
  const toast = useToast();
  const [busy, setBusy] = React.useState<string | null>(null);
  const save = async (e: ExamRow, patch: { rankingEligible?: boolean; directionKey?: string | null }) => {
    setBusy(e.id);
    const r = await api("/api/admin/rankings/settings", "PUT", { exams: [{ id: e.id, ...patch }] });
    setBusy(null);
    if (!r.ok) { toast("error", r.error); return; }
    toast("success", "Saqlandi."); onSaved();
  };
  return (
    <Card>
      <CardHeader><div><CardTitle>Reytingga hisoblanadigan imtihonlar</CardTitle><CardDescription>Nashr qilingan imtihon avtomatik reytingga qo&apos;shilmaydi: alohida shu yerda tasdiqlanadi. Diagnostika: {data.diagnostics.participants} ta ishtirokchi, {data.diagnostics.calibrated ? "taqqoslashga yetarli" : "hali yetarli emas"}.</CardDescription></div></CardHeader>
      <CardContent>
        <Table>
          <thead><tr><Th>Imtihon</Th><Th>Yo&apos;nalish</Th><Th>Nashr</Th><Th>Ishtirokchi</Th><Th>Reytingga</Th></tr></thead>
          <tbody>
            {data.exams.length === 0 && <tr><Td colSpan={5} className="text-center text-muted-foreground">Imtihonlar yo&apos;q.</Td></tr>}
            {data.exams.map((e) => (
              <tr key={e.id}>
                <Td><p className="font-semibold">{e.title}</p><p className="text-xs text-muted-foreground">{e.subject}</p></Td>
                <Td>
                  <Select value={e.directionKey ?? ""} disabled={busy === e.id} onChange={(ev) => void save(e, { directionKey: ev.target.value || null })} className="h-9 w-44 text-sm" aria-label={`${e.title}: yo'nalish`}>
                    <option value="">Umumiy</option>
                    {data.settings.directions.map((d) => <option key={d.key} value={d.key}>{d.label}</option>)}
                  </Select>
                </Td>
                <Td><Badge variant={e.active ? "success" : "neutral"}>{e.active ? "Nashr qilingan" : "Yashirin"}</Badge></Td>
                <Td>{e.rankingEligible ? <span>{e.participants ?? 0} {e.calibrated ? <Badge variant="teal">taqqoslanadi</Badge> : <Badge variant="amber">yetarli emas</Badge>}</span> : <span className="text-muted-foreground">—</span>}</Td>
                <Td><Switch checked={e.rankingEligible} disabled={busy === e.id} onCheckedChange={(v) => void save(e, { rankingEligible: v })} aria-label={`${e.title}: reytingga hisoblansin`} /></Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </CardContent>
    </Card>
  );
}

function Moderation({ initial, reload }: { initial: Person[]; reload: () => void }) {
  const toast = useToast();
  const [q, setQ] = React.useState("");
  const [rows, setRows] = React.useState(initial);
  React.useEffect(() => setRows(initial), [initial]);
  const [busy, setBusy] = React.useState<string | null>(null);
  const search = async () => { const r = await api<Overview>(`/api/admin/rankings?q=${encodeURIComponent(q.trim())}`); if (r.ok) setRows(r.data.participants); };
  const act = async (p: Person, action: "hide" | "unhide" | "reset_nickname" | "remove_avatar") => {
    if (action === "reset_nickname" && !window.confirm(`«${p.nickname}» niki tiklansinmi? Foydalanuvchi reytingdan chiqariladi va yangi nik tanlashi kerak bo'ladi.`)) return;
    setBusy(p.userId + action);
    const r = await api("/api/admin/rankings/moderate", "POST", { userId: p.userId, action });
    setBusy(null);
    if (!r.ok) { toast("error", r.error); return; }
    toast("success", "Bajarildi."); reload();
  };
  return (
    <Card>
      <CardHeader><div><CardTitle>Nik va avatar moderatsiyasi</CardTitle><CardDescription>Nomaqbul nik yoki rasmni olib tashlash, foydalanuvchini reytingdan yashirish. Shaxsiy natijalar saqlanadi. Har amal audit jurnaliga yoziladi.</CardDescription></div></CardHeader>
      <CardContent className="space-y-3">
        <form onSubmit={(e) => { e.preventDefault(); void search(); }} className="flex gap-2"><Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nik bo'yicha qidirish" aria-label="Nik bo'yicha qidirish" maxLength={30} /><Button type="submit" variant="outline">Qidirish</Button></form>
        {rows.length === 0 ? <p className="text-sm text-muted-foreground">Nik tanlagan foydalanuvchi topilmadi.</p> : (
          <ul className="space-y-2">
            {rows.map((p) => (
              <li key={p.userId} className="flex flex-wrap items-center gap-3 rounded-xl border border-border p-3">
                <Avatar name={p.nickname} size={36} tone="soft" />
                <div className="min-w-0 flex-1"><p className="truncate text-sm font-bold">{p.nickname} <span className="font-normal text-muted-foreground">· {p.name}</span></p>
                  <p className="text-xs text-muted-foreground">{p.optIn ? "Reytingda qatnashadi" : "Rozilik yo'q"}{p.hidden ? " · yashirilgan" : ""}{p.hasAvatar ? " · rasmi bor" : ""}</p></div>
                <div className="flex flex-wrap gap-1.5">
                  <Button size="sm" variant="outline" loading={busy === p.userId + (p.hidden ? "unhide" : "hide")} onClick={() => void act(p, p.hidden ? "unhide" : "hide")}>{p.hidden ? "Qaytarish" : "Yashirish"}</Button>
                  {p.hasAvatar && <Button size="sm" variant="outline" loading={busy === p.userId + "remove_avatar"} onClick={() => void act(p, "remove_avatar")}>Rasmni olib tashlash</Button>}
                  <Button size="sm" variant="danger" loading={busy === p.userId + "reset_nickname"} onClick={() => void act(p, "reset_nickname")}>Nikni tiklash</Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

/** Admin: Reyting boshqaruvi. */
export function RankingAdmin() {
  const q = useQuery<Overview>("/api/admin/rankings");
  const toast = useToast();
  const [busy, setBusy] = React.useState(false);
  const recalc = async () => {
    setBusy(true);
    const r = await api<{ standings: number; participants: number }>("/api/admin/rankings/recalculate", "POST");
    setBusy(false);
    if (!r.ok) { toast("error", r.error); return; }
    toast("success", `Qayta hisoblandi: ${r.data.standings} ta ustoz reytingda (${r.data.participants} ta rozilik bergan).`); q.reload();
  };
  return (
    <QueryView q={q}>
      {(d) => (
        <div className="space-y-6">
          <div className="grid gap-3 sm:grid-cols-4">
            {[["Holat", d.settings.enabled ? "Yoqilgan" : "O'chirilgan"], ["Rozilik berganlar", d.optedIn], ["Reytingdagilar", d.standings], ["Reytingga imtihonlar", d.exams.filter((e) => e.rankingEligible).length]].map(([k, v]) => (
              <Card key={String(k)} className="p-4"><p className="text-xs font-semibold text-muted-foreground">{k}</p><p className="mt-1 text-2xl font-extrabold">{v}</p></Card>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="outline" loading={busy} onClick={() => void recalc()}><RefreshCw className="h-4 w-4" aria-hidden />Reytingni qayta hisoblash</Button>
            <p className="text-sm text-muted-foreground">Reyting manba natijalardan har safar hisoblanadi (60 soniya keshlanadi): bir natija ikki marta hisoblanmaydi.</p>
          </div>
          <SettingsCard key={JSON.stringify(d.settings)} initial={d.settings} onSaved={q.reload} />
          <ExamsCard data={d} onSaved={q.reload} />
          <Moderation initial={d.participants} reload={q.reload} />
        </div>
      )}
    </QueryView>
  );
}
