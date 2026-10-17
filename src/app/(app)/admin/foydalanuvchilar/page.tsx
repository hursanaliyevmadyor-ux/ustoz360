"use client";
import * as React from "react";
import { Search, ShieldCheck, UserCog } from "lucide-react";
import { adminModule } from "@/lib/modules";
import { api } from "@/lib/admin-client";
import { useQuery } from "@/lib/use-query";
import { PLAN_KEYS } from "@/lib/plans";
import { ROLE_KEYS, ROLE_LABEL, type Role } from "@/lib/roles";
import { QueryView } from "@/components/layout/query-view";
import { PageHeader } from "@/components/layout/page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Field, Input, Select } from "@/components/ui/form";
import { EmptyState } from "@/components/ui/states";
import { Table, Td, Th } from "@/components/ui/table";
import { useToast } from "@/components/ui/toast";

type U = { id: string; name: string | null; email: string | null; phone: string | null; telegram: string | null; createdAt: string; blocked: boolean; roles: Role[]; plan: string; onboarded: boolean };
type List = { total: number; page: number; pages: number; users: U[] };
type Audit = { items: { id: string; action: string; actor: string; meta: Record<string, unknown> | null; createdAt: string }[] };
const date = (iso: string) => new Date(iso).toISOString().slice(0, 10).split("-").reverse().join(".");
const ACTION: Record<string, string> = { "admin.user_roles": "Rollar o'zgardi", "admin.user_block": "Bloklandi", "admin.user_unblock": "Blokdan chiqarildi", "admin.user_plan": "Tarif berildi", "admin.setting": "Sozlama o'zgardi", "admin.ai_test": "AI ulanishi sinaldi" };

export default function Page() {
  const [q, setQ] = React.useState(""); const [term, setTerm] = React.useState(""); const [role, setRole] = React.useState(""); const [page, setPage] = React.useState(1);
  const [edit, setEdit] = React.useState<U | null>(null);
  React.useEffect(() => { const t = setTimeout(() => { setTerm(q.trim()); setPage(1); }, 350); return () => clearTimeout(t); }, [q]);
  const url = `/api/admin/users?${new URLSearchParams({ ...(term && { q: term }), ...(role && { role }), page: String(page) })}`;
  const list = useQuery<List>(url);
  const audit = useQuery<Audit>("/api/admin/audit");
  return (
    <>
      <PageHeader module={adminModule} title="Foydalanuvchilar" description="Haqiqiy ro'yxatdan o'tganlar: rollar, bloklash va tarif" />
      <Card>
        <div className="flex flex-wrap gap-3 p-4">
          <div className="relative min-w-[200px] flex-1"><Search className="absolute left-3.5 top-3.5 h-4 w-4 text-muted-foreground" aria-hidden /><Input className="pl-10" placeholder="Ism, email yoki telefon" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Qidirish" /></div>
          <Select className="w-52" value={role} onChange={(e) => { setRole(e.target.value); setPage(1); }} aria-label="Rol bo'yicha"><option value="">Barcha rollar</option>{ROLE_KEYS.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}</Select>
        </div>
        <QueryView q={list}>{(d) => d.users.length === 0 ? <div className="p-4 pt-0"><EmptyState title="Foydalanuvchi topilmadi" text="Qidiruv shartlarini o'zgartiring." /></div> : (
          <>
            <Table><thead><tr><Th>Foydalanuvchi</Th><Th>Rollar</Th><Th>Tarif</Th><Th>Ro'yxatdan o'tgan</Th><Th>Holat</Th><Th><span className="sr-only">Amallar</span></Th></tr></thead><tbody>
              {d.users.map((u) => (
                <tr key={u.id}>
                  <Td><p className="font-semibold">{u.name ?? "—"}</p><p className="text-xs text-muted-foreground">{u.email ?? (u.telegram ? `@${u.telegram}` : u.phone ?? "—")}</p></Td>
                  <Td><div className="flex flex-wrap gap-1">{u.roles.map((r) => <Badge key={r} variant={r === "ADMIN" || r === "SUPERADMIN" ? "navy" : "neutral"}>{ROLE_LABEL[r]}</Badge>)}</div></Td>
                  <Td><Badge variant={u.plan === "FREE" ? "neutral" : "blue"}>{u.plan}</Badge></Td>
                  <Td className="whitespace-nowrap">{date(u.createdAt)}</Td>
                  <Td><Badge variant={u.blocked ? "danger" : "success"}>{u.blocked ? "Bloklangan" : "Faol"}</Badge></Td>
                  <Td className="text-right"><Button size="sm" variant="outline" onClick={() => setEdit(u)}><UserCog className="h-4 w-4" />Boshqarish</Button></Td>
                </tr>))}
            </tbody></Table>
            <div className="flex items-center justify-between gap-3 p-4 text-sm">
              <span className="text-muted-foreground">Jami: {d.total} ta</span>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(page - 1)}>Oldingi</Button>
                <span>{d.page} / {d.pages}</span>
                <Button size="sm" variant="outline" disabled={page >= d.pages} onClick={() => setPage(page + 1)}>Keyingi</Button>
              </div>
            </div>
          </>)}</QueryView>
      </Card>
      <Card className="mt-6"><CardHeader><CardTitle>So'nggi admin amallari</CardTitle></CardHeader><CardContent className="px-0">
        <QueryView q={audit} skeleton={<p className="px-5 text-sm text-muted-foreground">Yuklanmoqda...</p>}>{(a) => a.items.length === 0 ? <p className="px-5 text-sm text-muted-foreground">Hali admin amali yo'q.</p> : (
          <Table><thead><tr><Th>Vaqt</Th><Th>Kim</Th><Th>Amal</Th></tr></thead><tbody>
            {a.items.slice(0, 15).map((r) => <tr key={r.id}><Td className="whitespace-nowrap">{new Date(r.createdAt).toLocaleString("ru-RU", { dateStyle: "short", timeStyle: "short" })}</Td><Td>{r.actor}</Td><Td>{ACTION[r.action] ?? r.action}</Td></tr>)}
          </tbody></Table>)}</QueryView>
      </CardContent></Card>
      {edit && <UserDialog u={edit} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); list.reload(); audit.reload(); }} />}
    </>
  );
}

function UserDialog({ u, onClose, onSaved }: { u: U; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [roles, setRoles] = React.useState<Role[]>(u.roles);
  const [plan, setPlan] = React.useState(u.plan); const [days, setDays] = React.useState("30");
  const [busy, setBusy] = React.useState(false); const [err, setErr] = React.useState("");
  const toggle = (r: Role) => setRoles((s) => (s.includes(r) ? s.filter((x) => x !== r) : [...s, r]));
  const same = roles.length === u.roles.length && roles.every((r) => u.roles.includes(r));

  const save = async (body: Record<string, unknown>, ok: string) => {
    setBusy(true); setErr("");
    const r = await api(`/api/admin/users/${u.id}`, "PATCH", body);
    setBusy(false);
    if (!r.ok) { setErr(r.error); return; }
    toast("success", ok); onSaved();
  };
  return (
    <Dialog open onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent title={u.name ?? u.email ?? "Foydalanuvchi"} description={u.email ?? undefined} className="max-h-[90vh] max-w-lg overflow-y-auto">
        <div className="space-y-5">
          <section aria-label="Rollar">
            <p className="mb-2 flex items-center gap-1.5 text-sm font-bold"><ShieldCheck className="h-4 w-4" aria-hidden />Rollar</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {ROLE_KEYS.map((r) => (
                <label key={r} className="flex min-h-11 items-center gap-2.5 rounded-xl border border-border px-3 text-sm">
                  <input type="checkbox" className="h-4 w-4" checked={roles.includes(r) || r === "TEACHER"} disabled={r === "TEACHER"} onChange={() => toggle(r)} />{ROLE_LABEL[r]}
                </label>))}
            </div>
            <Button className="mt-3" size="sm" disabled={same} loading={busy} onClick={() => save({ roles }, "Rollar saqlandi.")}>Rollarni saqlash</Button>
          </section>
          <section aria-label="Tarif" className="border-t border-border pt-4">
            <p className="mb-2 text-sm font-bold">Tarifni qo'lda berish</p>
            <div className="grid gap-3 sm:grid-cols-[1fr_120px]">
              <Field label="Tarif"><Select value={plan} onChange={(e) => setPlan(e.target.value)}>{PLAN_KEYS.map((p) => <option key={p}>{p}</option>)}</Select></Field>
              <Field label="Kun"><Input type="number" min={1} max={366} value={days} onChange={(e) => setDays(e.target.value)} disabled={plan === "FREE"} /></Field>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">FREE tanlansa faol obunalar to'xtatiladi.</p>
            <Button className="mt-3" size="sm" variant="outline" loading={busy} onClick={() => save({ plan, planDays: Number(days) || 30 }, "Tarif yangilandi.")}>Tarifni saqlash</Button>
          </section>
          <section aria-label="Hisob holati" className="border-t border-border pt-4">
            <p className="mb-2 text-sm font-bold">Hisob</p>
            <Button size="sm" variant={u.blocked ? "success" : "danger"} loading={busy}
              onClick={() => { if (u.blocked || window.confirm("Foydalanuvchi bloklansa, tizimga kira olmaydi va barcha sessiyalari yopiladi. Davom etasizmi?")) void save({ blocked: !u.blocked }, u.blocked ? "Blokdan chiqarildi." : "Bloklandi."); }}>
              {u.blocked ? "Blokdan chiqarish" : "Bloklash"}
            </Button>
          </section>
          {err && <p role="alert" className="rounded-xl bg-danger/10 p-3 text-sm text-danger">{err}</p>}
        </div>
      </DialogContent>
    </Dialog>
  );
}
