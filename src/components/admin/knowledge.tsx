"use client";
import * as React from "react";
import { Archive, Check, ExternalLink, Flag, Pencil, Plus, RotateCcw, Search, X } from "lucide-react";
import { api } from "@/lib/admin-client";
import { useQuery } from "@/lib/use-query";
import { QueryView } from "@/components/layout/query-view";
import { StatCard } from "@/components/layout/page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { EmptyState } from "@/components/ui/states";
import { Table, Td, Th } from "@/components/ui/table";
import { useToast } from "@/components/ui/toast";

type Mode = "off" | "shadow" | "on";
type Counts = { approved: number; stale: number; needsRecheck: number; flagged: number; archived: number; pending: number; needsSource: number };
type Demand = { days: number; asked: number; fromKb: number; byAi: number; unanswered: number; helpful: number; unhelpful: number; hitRate: number; subjects: { subject: string; asked: number; fromKb: number; unanswered: number }[]; topics: { subject: string; topic: string; asked: number; fromKb: number; unanswered: number }[]; hidden: boolean };
export type Overview =
  | { available: false; mode: Mode; embeddings: { configured: boolean; ready: boolean; version: string } }
  | { available: true; mode: Mode; embeddings: { configured: boolean; ready: boolean; version: string }; counts: Counts; demand: Demand;
      missing: { id: string; question: string; askCount: number; subject: string | null; topic: string | null; status: string }[];
      stale: { id: string; question: string; status: string; expiresAt: string | null }[];
      flagged: { id: string; question: string; updatedAt: string; unhelpful: number; helpful: number }[];
      audit: { id: string; operation: string; actor: string; at: string }[] };
export type Prov = { id: string; kind: "free"; host: string; model: string; role: string; roleLabel: string; explicitRole: boolean; breakerSeconds: number; calls: number; errors: number; errorPct: number; avgMs: number | null; tokens: number };
export type Providers = { free: Prov[]; claude: { id: string; host: string; model: string; calls: number; errors: number; errorPct: number; avgMs: number | null; tokens: number } | null; note: string };

type Entry = {
  id: string; questionCanonical: string; answer: string; subject: string | null; topic: string | null; category: string; effectiveStatus: string; status: string; expiresAt: string | null; reviewedAt: string;
  sources: { title: string; url: string; trust?: string }[]; sourceVersion: string | null; servedCount: number; helpful: number; unhelpful: number; origin: string;
};
type Cand = { id: string; normalizedQuestion: string; proposedAnswer: string; subject: string | null; topic: string | null; category: string; generatedByProvider: string; model: string | null; evidence: { sources?: { title: string; url: string }[] }; riskFlags: string[]; reviewStatus: string; askCount: number; createdAt: string; expiresAt: string };

const STATUS: Record<string, { label: string; v: "success" | "amber" | "danger" | "neutral" }> = {
  APPROVED: { label: "Tasdiqlangan", v: "success" }, NEEDS_RECHECK: { label: "Qayta tekshirish kerak", v: "amber" }, STALE: { label: "Eskirgan", v: "amber" },
  FLAGGED: { label: "Xato deb belgilangan", v: "danger" }, ARCHIVED: { label: "Arxivda", v: "neutral" },
};
const FLAG: Record<string, string> = { no_source: "Manba yo'q", weak_source: "Manba ishonchsiz", old_year: "Eski yil bor", copied_text: "Matn manbadan ko'chirilgan", injection_suspect: "Shubhali ko'rsatma", duplicate: "Takror bo'lishi mumkin" };
const MODE: Record<Mode, { label: string; text: string }> = {
  off: { label: "O'chiq", text: "Bilim markazi javobga umuman ta'sir qilmaydi va hech narsa yig'ilmaydi." },
  shadow: { label: "Kuzatuv", text: "Javob avvalgidek AI'dan keladi. Markaz faqat «topilarmidi?» ni o'lchaydi va (rozilik bergan foydalanuvchilardan) nomzod yig'adi." },
  on: { label: "Yoqiq", text: "Tasdiqlangan bilim mos kelsa, AI chaqirilmasdan manbali javob beriladi; qisman mos bo'lsa AI'ga tayanch bo'ladi. Telefon, email kabi shaxsiy ma'lumot AI'ga ketishdan oldin niqoblanadi." },
};
const dateOf = (s: string | null | undefined) => (s ? new Date(s).toISOString().slice(0, 10) : "");

// ------------------------------------------------------------------ Holat
async function savingAi(patch: (ai: Record<string, unknown>) => Record<string, unknown>) {
  const cur = await api<{ settings: { ai: Record<string, unknown> } }>("/api/admin/settings");
  if (!cur.ok) return cur;
  return api("/api/admin/settings", "PUT", { key: "ai", value: patch(cur.data.settings.ai) });
}

function ModeCard({ mode, onChanged }: { mode: Mode; onChanged: () => void }) {
  const toast = useToast();
  const [busy, setBusy] = React.useState<Mode | null>(null);
  const set = async (m: Mode) => {
    if (m === mode) return;
    if (m === "on" && !window.confirm("Bilim markazi yoqilsa, tasdiqlangan bilim foydalanuvchilarga javob sifatida ko'rinadi. Davom etilsinmi?")) return;
    setBusy(m);
    const r = await savingAi((ai) => ({ ...ai, hubMode: m }));
    setBusy(null);
    if (!r.ok) { toast("error", r.error); return; }
    toast("success", `Rejim: ${MODE[m].label}.`); onChanged();
  };
  return (
    <Card>
      <CardHeader><div><CardTitle>Ishlash rejimi</CardTitle><CardDescription>{MODE[mode].text}</CardDescription></div></CardHeader>
      <CardContent className="flex flex-wrap gap-2">
        {(["off", "shadow", "on"] as Mode[]).map((m) => (
          <Button key={m} variant={m === mode ? "primary" : "outline"} loading={busy === m} onClick={() => set(m)} aria-pressed={m === mode}>{MODE[m].label}</Button>))}
      </CardContent>
    </Card>
  );
}

export function OverviewTab({ q, providers, go }: { q: ReturnType<typeof useQuery<{ overview: Overview; providers: Providers }>>; providers: Providers | null; go: (tab: string) => void }) {
  return (
    <QueryView q={q}>{({ overview: o }) => (
      <div className="space-y-5">
        <ModeCard mode={o.mode} onChanged={q.reload} />
        {!o.available ? (
          <Card><CardContent className="space-y-2">
            <p className="font-bold">Bilim markazi jadvallari hali yaratilmagan</p>
            <p className="text-sm text-muted-foreground">Dasturchi <code className="rounded bg-muted px-1">prisma/supabase-update-knowledge-base.sql</code> faylini bazaga qo'llashi kerak (faqat yangi jadvallar qo'shiladi, mavjud ma'lumotga tegilmaydi). Shundan so'ng bu sahifa to'liq ishlaydi.</p>
          </CardContent></Card>
        ) : (<>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Tasdiqlangan bilimlar" value={String(o.counts.approved)} icon={Check} tone="teal" />
            <button type="button" className="text-left" onClick={() => go("review")}><StatCard label="Tekshiruv kutayotgan" value={String(o.counts.pending + o.counts.needsSource)} icon={Search} tone="amber" /></button>
            <StatCard label="Eskirgan / qayta tekshiruv" value={String(o.counts.stale + o.counts.needsRecheck)} icon={RotateCcw} tone="violet" />
            <StatCard label="Xato deb belgilangan" value={String(o.counts.flagged)} icon={Flag} tone="rose" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label={`Savollar (${o.demand.days} kun)`} value={String(o.demand.asked)} icon={Search} tone="blue" />
            <StatCard label="Bazadan javob (hit rate)" value={`${o.demand.hitRate}%`} icon={Check} tone="teal" delta={o.mode === "shadow" ? "kuzatuv: «bo'lardi» o'lchovi" : undefined} />
            <StatCard label="AI orqali / javobsiz" value={`${o.demand.byAi} / ${o.demand.unanswered}`} icon={Search} tone="amber" />
            <StatCard label="Foydali / noto'g'ri baho" value={`${o.demand.helpful} / ${o.demand.unhelpful}`} icon={Flag} tone="violet" />
          </div>
          <div className="grid gap-5 lg:grid-cols-2">
            <Card><CardHeader><div><CardTitle>Eng ko'p so'ralgan fan va mavzular</CardTitle><CardDescription>Foydalanuvchisiz, kunlik yig'ma. 5 tadan kam so'ralgani ko'rsatilmaydi (kichik guruh himoyasi).</CardDescription></div></CardHeader>
              <CardContent>{o.demand.subjects.length + o.demand.topics.length === 0 ? <EmptyState title="Hali ma'lumot yo'q" text={o.mode === "off" ? "Rejim «O'chiq»: hech narsa yig'ilmaydi." : "Yetarli savol yig'ilgach ko'rinadi."} /> : (
                <Table><thead><tr><Th>Fan / mavzu</Th><Th>So'ralgan</Th><Th>Bazadan</Th><Th>Javobsiz</Th></tr></thead><tbody>
                  {o.demand.subjects.map((s) => <tr key={`s${s.subject}`}><Td className="font-semibold capitalize">{s.subject}</Td><Td>{s.asked}</Td><Td>{s.fromKb}</Td><Td>{s.unanswered}</Td></tr>)}
                  {o.demand.topics.map((t) => <tr key={`t${t.subject}${t.topic}`}><Td><span className="capitalize text-muted-foreground">{t.subject ? `${t.subject}: ` : ""}</span>{t.topic}</Td><Td>{t.asked}</Td><Td>{t.fromKb}</Td><Td>{t.unanswered}</Td></tr>)}
                </tbody></Table>)}</CardContent></Card>
            <Card><CardHeader><div><CardTitle>Javobi yetishmayotgan savollar</CardTitle><CardDescription>Faqat rozilik bergan foydalanuvchilarning tozalangan savollari; ko'p so'ralgani yuqorida.</CardDescription></div></CardHeader>
              <CardContent>{o.missing.length === 0 ? <EmptyState title="Hozircha yo'q" text="Rozilik bergan foydalanuvchilar savoli shu yerda to'planadi." /> : (
                <ul className="space-y-2">{o.missing.map((m) => (
                  <li key={m.id} className="flex items-start justify-between gap-3 rounded-xl bg-muted/50 p-3 text-sm"><span>{m.question}{m.subject && <span className="ml-1 text-xs capitalize text-muted-foreground">· {m.subject}</span>}</span><Badge variant={m.status === "NEEDS_SOURCE" ? "amber" : "blue"}>{m.askCount} marta</Badge></li>))}</ul>)}
                {o.missing.length > 0 && <Button className="mt-3" variant="outline" size="sm" onClick={() => go("review")}>Ko'rib chiqishga o'tish</Button>}</CardContent></Card>
          </div>
          <div className="grid gap-5 lg:grid-cols-2">
            <Card><CardHeader><div><CardTitle>Eskirgan bilimlar</CardTitle><CardDescription>Muddati o'tgan yoki qayta tekshiruv kutayotgan: qidiruvda ishlatilmaydi.</CardDescription></div></CardHeader>
              <CardContent>{o.stale.length === 0 ? <EmptyState title="Eskirgan bilim yo'q" text="Hammasi dolzarb." /> : (
                <ul className="space-y-2">{o.stale.map((e) => <li key={e.id} className="flex items-start justify-between gap-3 rounded-xl bg-muted/50 p-3 text-sm"><span>{e.question}</span><Badge variant="amber">{STATUS[e.status]?.label ?? e.status}{e.expiresAt ? ` · ${dateOf(e.expiresAt)}` : ""}</Badge></li>)}</ul>)}
                {o.stale.length > 0 && <Button className="mt-3" variant="outline" size="sm" onClick={() => go("entries")}>Bilimlarga o'tish</Button>}</CardContent></Card>
            <Card><CardHeader><div><CardTitle>Xato deb belgilangan bilimlar</CardTitle><CardDescription>Kamida 3 ta alohida «noto'g'ri» bahosi olgan yozuv qidiruvdan avtomatik chiqadi. Qayta yoqish faqat sizda.</CardDescription></div></CardHeader>
              <CardContent>{o.flagged.length === 0 ? <EmptyState title="Yo'q" text="Xato deb belgilangan bilim yo'q." /> : (
                <ul className="space-y-2">{o.flagged.map((e) => <li key={e.id} className="flex items-start justify-between gap-3 rounded-xl bg-muted/50 p-3 text-sm"><span>{e.question}</span><Badge variant="danger">{e.unhelpful} noto'g'ri · {e.helpful} foydali</Badge></li>)}</ul>)}</CardContent></Card>
          </div>
          <Card><CardHeader><div><CardTitle>Oxirgi amallar (audit)</CardTitle><CardDescription>Faqat qo'shiladigan jurnal: o'zgartirib yoki o'chirib bo'lmaydi.</CardDescription></div></CardHeader>
            <CardContent>{o.audit.length === 0 ? <p className="text-sm text-muted-foreground">Hali amal yo'q.</p> : (
              <ul className="space-y-1 text-sm">{o.audit.map((a) => <li key={a.id} className="flex flex-wrap gap-x-3"><span className="text-muted-foreground">{new Date(a.at).toLocaleString("uz-UZ")}</span><span className="font-semibold">{a.operation}</span><span className="text-muted-foreground">{a.actor === "system" ? "tizim" : "admin"}</span></li>)}</ul>)}</CardContent></Card>
          <p className="text-xs text-muted-foreground">Vektorli qidiruv: {o.embeddings.configured && o.embeddings.ready ? `yoqilgan (${o.embeddings.version})` : o.embeddings.configured ? "kalit bor, lekin vektor jadvali yo'q (ixtiyoriy SQL qo'llanmagan): kalit so'zlar bilan ishlaydi" : "ulanmagan: kalit so'zlar bilan ishlaydi"}. Provayderlar: {providers ? `${providers.free.length} ta bepul${providers.claude ? " + Claude" : ""}` : "—"}.</p>
        </>)}
      </div>)}</QueryView>
  );
}

// ------------------------------------------------------------------ Yozuv shakli
type Form = { questionCanonical: string; answer: string; subject: string; topic: string; category: string; sourcesText: string; sourceVersion: string; expiresOn: string };
const emptyForm: Form = { questionCanonical: "", answer: "", subject: "", topic: "", category: "general", sourcesText: "", sourceVersion: "", expiresOn: "" };

function parseSources(text: string) {
  return text.split("\n").map((l) => l.trim()).filter(Boolean).map((l) => {
    const parts = l.split("|").map((p) => p.trim());
    const url = parts.find((p) => /^https?:\/\//i.test(p)) ?? parts[0];
    const title = parts.filter((p) => p !== url).join(" ");
    return { url, ...(title && { title }) };
  });
}

function EntryDialog({ title, initial, id, candidateId, onClose, onSaved }: { title: string; initial?: Partial<Form>; id?: string; candidateId?: string; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [f, setF] = React.useState<Form>({ ...emptyForm, ...initial });
  const [busy, setBusy] = React.useState(false); const [err, setErr] = React.useState("");
  const up = (k: keyof Form, v: string) => setF((x) => ({ ...x, [k]: v }));
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setErr("");
    const entry = { questionCanonical: f.questionCanonical, answer: f.answer, subject: f.subject || null, topic: f.topic || null, category: f.category, sources: parseSources(f.sourcesText), sourceVersion: f.sourceVersion || null, expiresOn: f.expiresOn || null };
    const r = candidateId ? await api(`/api/admin/knowledge/candidates/${candidateId}`, "POST", { decision: "approve", entry }) : id ? await api(`/api/admin/knowledge/entries/${id}`, "PUT", entry) : await api("/api/admin/knowledge/entries", "POST", entry);
    setBusy(false);
    if (!r.ok) { setErr(r.error); return; }
    toast("success", candidateId ? "Tasdiqlandi: bilim bazasiga qo'shildi." : "Saqlandi."); onSaved();
  };
  const normative = f.category === "normative";
  return (
    <Dialog open onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent title={title} description="Faqat o'zingiz tekshirgan, manbali ma'lumotni saqlang" className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <form onSubmit={submit} className="space-y-4">
          <Field label="Savol (umumlashtirilgan, shaxssiz)"><Input value={f.questionCanonical} onChange={(e) => up("questionCanonical", e.target.value)} required minLength={8} maxLength={500} autoFocus /></Field>
          <Field label="Javob" hint="Qisqa, aniq va o'zbek tilida. Manbadan uzun matn ko'chirmang: qisqa mazmun va havola yetarli."><Textarea className="min-h-32" value={f.answer} onChange={(e) => up("answer", e.target.value)} required minLength={20} maxLength={6000} /></Field>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Fan"><Input value={f.subject} onChange={(e) => up("subject", e.target.value)} maxLength={60} placeholder="matematika" /></Field>
            <Field label="Mavzu"><Input value={f.topic} onChange={(e) => up("topic", e.target.value)} maxLength={120} /></Field>
            <Field label="Turi" hint={normative ? "Manba va muddat majburiy" : undefined}><Select value={f.category} onChange={(e) => up("category", e.target.value)}><option value="general">Umumiy bilim</option><option value="normative">Me'yoriy / rasmiy</option></Select></Field>
          </div>
          <Field label={`Manbalar (https)${normative ? " — majburiy" : ""}`} hint="Har qatorda bittadan: «Sarlavha | https://...» yoki faqat havola. Ishonchlilik darajasi sayt manzilidan avtomatik aniqlanadi."><Textarea className="min-h-20" value={f.sourcesText} onChange={(e) => up("sourcesText", e.target.value)} placeholder={"Vazirlik buyrug'i | https://lex.uz/docs/..."} /></Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Manba versiyasi (ixtiyoriy)" hint="Masalan: buyruq raqami yoki sanasi"><Input value={f.sourceVersion} onChange={(e) => up("sourceVersion", e.target.value)} maxLength={120} /></Field>
            <Field label={`Tekshiruv muddati${normative ? " — majburiy" : " (ixtiyoriy)"}`} hint="Shu sanadan keyin yozuv eskirgan hisoblanadi va qidiruvdan chiqadi"><Input type="date" value={f.expiresOn} onChange={(e) => up("expiresOn", e.target.value)} required={normative} /></Field>
          </div>
          {err && <p role="alert" className="rounded-xl bg-danger/10 p-3 text-sm text-danger">{err}</p>}
          <div className="flex justify-end gap-3"><Button type="button" variant="outline" onClick={onClose}>Bekor qilish</Button><Button type="submit" loading={busy}>{candidateId ? "Tasdiqlash va qo'shish" : "Saqlash"}</Button></div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

const toForm = (c: { questionCanonical: string; answer: string; subject: string | null; topic: string | null; category: string; sources?: { title?: string; url: string }[]; sourceVersion?: string | null; expiresAt?: string | null }): Partial<Form> => ({
  questionCanonical: c.questionCanonical, answer: c.answer, subject: c.subject ?? "", topic: c.topic ?? "", category: c.category,
  sourcesText: (c.sources ?? []).map((s) => (s.title && s.title !== s.url ? `${s.title} | ${s.url}` : s.url)).join("\n"), sourceVersion: c.sourceVersion ?? "", expiresOn: dateOf(c.expiresAt),
});

// ------------------------------------------------------------------ Tekshiruv (nomzodlar)
export function ReviewTab({ onChanged }: { onChanged: () => void }) {
  const toast = useToast();
  const q = useQuery<{ items: Cand[] }>("/api/admin/knowledge/candidates");
  const [approve, setApprove] = React.useState<Cand | null>(null);
  const [busy, setBusy] = React.useState("");
  const reject = async (c: Cand) => {
    const note = window.prompt("Rad etish sababi (ixtiyoriy):");
    if (note === null) return;
    setBusy(c.id); const r = await api(`/api/admin/knowledge/candidates/${c.id}`, "POST", { decision: "reject", note: note || null }); setBusy("");
    if (!r.ok) { toast("error", r.error); return; }
    toast("success", "Rad etildi."); q.reload(); onChanged();
  };
  return (
    <>
      <p className="mb-4 rounded-xl bg-amber/10 px-3.5 py-2.5 text-sm">Bu yerdagi javoblar AI yozgan va hali <b>bilim emas</b>: siz manbani tekshirib tasdiqlamaguncha hech kimga ko'rsatilmaydi. Avtomatik tasdiq yo'q. Foydalanuvchi izi (xesh) ko'rib chiqilgach o'chiriladi.</p>
      <QueryView q={q}>{(d) => d.items.length === 0 ? <EmptyState title="Tekshiruv kutayotgan javob yo'q" text="Foydalanuvchi rozilik bersa va AI bazada yo'q savolga javob bersa, nomzod shu yerda paydo bo'ladi." /> : (
        <div className="space-y-4">{d.items.map((c) => (
          <Card key={c.id}><CardContent className="space-y-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <p className="font-bold">{c.normalizedQuestion}</p>
              <div className="flex flex-wrap gap-1.5">
                <Badge variant="blue">{c.askCount} marta so'ralgan</Badge>
                <Badge>{c.generatedByProvider}{c.model ? ` · ${c.model}` : ""}</Badge>
                {c.reviewStatus === "NEEDS_SOURCE" && <Badge variant="amber">Manba kerak</Badge>}
                {c.category === "normative" && <Badge variant="navy">Me'yoriy</Badge>}
                {c.riskFlags.map((f) => <Badge key={f} variant="danger">{FLAG[f] ?? f}</Badge>)}
              </div>
            </div>
            <p className="whitespace-pre-wrap rounded-xl bg-muted/50 p-3 text-sm">{c.proposedAnswer}</p>
            {c.evidence.sources && c.evidence.sources.length > 0 && <ul className="space-y-1 text-xs">{c.evidence.sources.map((s) => <li key={s.url}><a className="inline-flex items-center gap-1 text-primary" href={s.url} target="_blank" rel="noopener noreferrer">{s.title}<ExternalLink className="h-3 w-3" /></a></li>)}</ul>}
            <p className="text-xs text-muted-foreground">{[c.subject, c.topic].filter(Boolean).join(" · ") || "Fan/mavzu aniqlanmagan"} · {new Date(c.createdAt).toLocaleDateString("uz-UZ")} · 60 kundan keyin avtomatik o'chadi</p>
            <div className="flex flex-wrap gap-2"><Button size="sm" variant="success" onClick={() => setApprove(c)}><Check className="h-4 w-4" />Tekshirib tasdiqlash</Button><Button size="sm" variant="outline" loading={busy === c.id} onClick={() => reject(c)}><X className="h-4 w-4" />Rad etish</Button></div>
          </CardContent></Card>))}</div>)}</QueryView>
      {approve && <EntryDialog title="Nomzodni tasdiqlash" candidateId={approve.id} initial={toForm({ questionCanonical: approve.normalizedQuestion, answer: approve.proposedAnswer, subject: approve.subject, topic: approve.topic, category: approve.category, sources: approve.evidence.sources })} onClose={() => setApprove(null)} onSaved={() => { setApprove(null); q.reload(); onChanged(); }} />}
    </>
  );
}

// ------------------------------------------------------------------ Bilimlar
export function EntriesTab({ onChanged }: { onChanged: () => void }) {
  const toast = useToast();
  const [status, setStatus] = React.useState("ALL");
  const [text, setText] = React.useState(""); const [search, setSearch] = React.useState("");
  const q = useQuery<{ items: Entry[] }>(`/api/admin/knowledge/entries?status=${status}&q=${encodeURIComponent(search)}`);
  const [edit, setEdit] = React.useState<Entry | "new" | null>(null);
  const [restore, setRestore] = React.useState<Entry | null>(null);
  const [busy, setBusy] = React.useState("");
  const act = async (e: Entry, action: "archive" | "flag" | "recheck", ask: string) => {
    if (!window.confirm(ask)) return;
    setBusy(e.id); const r = await api(`/api/admin/knowledge/entries/${e.id}`, "PATCH", { action }); setBusy("");
    if (!r.ok) { toast("error", r.error); return; }
    toast("success", "Bajarildi."); q.reload(); onChanged();
  };
  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Select className="w-52" value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Holat">
          <option value="ALL">Hammasi</option><option value="APPROVED">Tasdiqlangan</option><option value="STALE">Eskirgan</option><option value="NEEDS_RECHECK">Qayta tekshirish</option><option value="FLAGGED">Xato deb belgilangan</option><option value="ARCHIVED">Arxivda</option>
        </Select>
        <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); setSearch(text); }}><Input className="w-56" value={text} onChange={(e) => setText(e.target.value)} placeholder="Qidirish…" aria-label="Qidirish" /><Button type="submit" variant="outline"><Search className="h-4 w-4" />Qidirish</Button></form>
        <Button className="ml-auto" onClick={() => setEdit("new")}><Plus className="h-4 w-4" />Yangi bilim</Button>
      </div>
      <Card>
        <QueryView q={q}>{(d) => d.items.length === 0 ? <div className="p-4"><EmptyState title="Bilim yo'q" text="O'zingiz tekshirgan savol-javobni manba bilan qo'shing yoki nomzodlarni tasdiqlang." /></div> : (
          <Table><thead><tr><Th>Savol va javob</Th><Th>Holat</Th><Th>Muddat</Th><Th>Foydalanish</Th><Th><span className="sr-only">Amallar</span></Th></tr></thead><tbody>
            {d.items.map((e) => { const st = STATUS[e.effectiveStatus] ?? { label: e.effectiveStatus, v: "neutral" as const }; return (
              <tr key={e.id}>
                <Td className="max-w-md"><p className="font-semibold">{e.questionCanonical}</p><p className="line-clamp-2 text-xs font-normal text-muted-foreground">{e.answer}</p>
                  <p className="mt-1 flex flex-wrap gap-1">{e.category === "normative" && <Badge variant="navy">Me'yoriy</Badge>}{[e.subject, e.topic].filter(Boolean).map((x) => <Badge key={x}>{x}</Badge>)}{e.sources.length > 0 && <Badge variant="teal">{e.sources.length} manba</Badge>}</p></Td>
                <Td><Badge variant={st.v}>{st.label}</Badge></Td>
                <Td className="whitespace-nowrap">{dateOf(e.expiresAt) || "—"}</Td>
                <Td className="whitespace-nowrap text-xs">{e.servedCount} marta · 👍 {e.helpful} · 👎 {e.unhelpful}</Td>
                <Td className="whitespace-nowrap text-right">
                  <Button variant="ghost" size="icon" aria-label="Tahrirlash" onClick={() => setEdit(e)}><Pencil className="h-4 w-4" /></Button>
                  {e.effectiveStatus === "APPROVED" && <Button variant="ghost" size="icon" aria-label="Qayta tekshirishga yuborish" loading={busy === e.id} onClick={() => act(e, "recheck", "Yozuv qayta tekshirishga yuboriladi va qidiruvdan chiqadi. Davom etilsinmi?")}><RotateCcw className="h-4 w-4" /></Button>}
                  {["APPROVED", "STALE", "NEEDS_RECHECK"].includes(e.effectiveStatus) && <Button variant="ghost" size="icon" aria-label="Xato deb belgilash" onClick={() => act(e, "flag", "Yozuv xato deb belgilanadi va qidiruvdan chiqadi. Davom etilsinmi?")}><Flag className="h-4 w-4 text-danger" /></Button>}
                  {e.effectiveStatus !== "ARCHIVED" && <Button variant="ghost" size="icon" aria-label="Arxivlash" onClick={() => act(e, "archive", "Yozuv arxivlanadi (o'chirilmaydi). Davom etilsinmi?")}><Archive className="h-4 w-4" /></Button>}
                  {e.effectiveStatus !== "APPROVED" && <Button size="sm" variant="success" onClick={() => setRestore(e)}><Check className="h-4 w-4" />Qayta tasdiqlash</Button>}
                </Td>
              </tr>); })}
          </tbody></Table>)}</QueryView>
      </Card>
      {edit && <EntryDialog title={edit === "new" ? "Yangi bilim" : "Tahrirlash"} id={edit === "new" ? undefined : edit.id} initial={edit === "new" ? undefined : toForm({ ...edit, sources: edit.sources, sourceVersion: edit.sourceVersion })} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); q.reload(); onChanged(); }} />}
      {restore && <RestoreDialog e={restore} onClose={() => setRestore(null)} onSaved={() => { setRestore(null); q.reload(); onChanged(); }} />}
    </>
  );
}

function RestoreDialog({ e, onClose, onSaved }: { e: Entry; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [on, setOn] = React.useState(""); const [busy, setBusy] = React.useState(false); const [err, setErr] = React.useState("");
  const submit = async (ev: React.FormEvent) => {
    ev.preventDefault(); setBusy(true); setErr("");
    const r = await api(`/api/admin/knowledge/entries/${e.id}`, "PATCH", { action: "restore", expiresOn: on || null });
    setBusy(false);
    if (!r.ok) { setErr(r.error); return; }
    toast("success", "Qayta tasdiqlandi."); onSaved();
  };
  return (
    <Dialog open onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent title="Qayta tasdiqlash" description="Manbani yana bir bor tekshirdingizmi? Tasdiqlansa yozuv qidiruvga qaytadi." className="max-w-md">
        <form onSubmit={submit} className="space-y-4">
          <p className="rounded-xl bg-muted/50 p-3 text-sm">{e.questionCanonical}</p>
          <Field label={`Yangi tekshiruv muddati${e.category === "normative" ? " — majburiy" : " (ixtiyoriy)"}`}><Input type="date" value={on} onChange={(x) => setOn(x.target.value)} required={e.category === "normative"} /></Field>
          {err && <p role="alert" className="rounded-xl bg-danger/10 p-3 text-sm text-danger">{err}</p>}
          <div className="flex justify-end gap-3"><Button type="button" variant="outline" onClick={onClose}>Bekor qilish</Button><Button type="submit" variant="success" loading={busy}>Tasdiqlash</Button></div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ------------------------------------------------------------------ Provayderlar
export function ProvidersTab({ providers, onChanged }: { providers: Providers | null; onChanged: () => void }) {
  const toast = useToast();
  const [busy, setBusy] = React.useState("");
  const setRole = async (id: string, role: string) => {
    setBusy(id);
    const r = await savingAi((ai) => { const roles = { ...((ai.providerRoles as Record<string, string>) ?? {}) }; if (role === "default") delete roles[id]; else roles[id] = role; return { ...ai, providerRoles: roles }; });
    setBusy("");
    if (!r.ok) { toast("error", r.error); return; }
    toast("success", "Rol saqlandi."); onChanged();
  };
  if (!providers) return null;
  return (
    <div className="space-y-4">
      <p className="rounded-xl bg-muted/60 px-3.5 py-2.5 text-sm">Har savol hamma AI'ga yuborilmaydi: avval bilim bazasi, keyin tartib bo'yicha <b>bitta</b> xizmat, xato bersa keyingisi. Ketma-ket 3 marta xato bergan xizmat 1 daqiqaga oxiriga suriladi. <b>Asosiy</b> birinchi, <b>zaxira</b> tabiiy tartibda, <b>tekshiruvchi</b> va <b>o'chirilgan</b> oddiy zanjirdan chiqadi. {providers.note}</p>
      <Card>
        {providers.free.length === 0 ? <div className="p-4"><EmptyState title="Bepul AI xizmati ulanmagan" text="Vercel'da FREE_LLM_* o'zgaruvchilarini sozlang (Sozlamalar → AI)." /></div> : (
          <Table><thead><tr><Th>Xizmat</Th><Th>Model</Th><Th>Rol</Th><Th>24 soat</Th><Th>Xato</Th><Th>Kechikish</Th><Th>Holat</Th></tr></thead><tbody>
            {providers.free.map((p) => (
              <tr key={p.id}>
                <Td className="font-semibold">{p.id.replace("free", "Bepul ")}<p className="text-xs font-normal text-muted-foreground">{p.host}</p></Td>
                <Td className="max-w-[14rem] break-words text-xs">{p.model}</Td>
                <Td><Select className="h-9 w-40" value={p.explicitRole ? p.role : "default"} disabled={busy === p.id} onChange={(e) => setRole(p.id, e.target.value)} aria-label={`${p.id} roli`}>
                  <option value="default">Tabiiy tartib</option><option value="primary">Asosiy</option><option value="fallback">Zaxira</option><option value="verifier">Tekshiruvchi</option><option value="disabled">O'chirilgan</option></Select></Td>
                <Td>{p.calls} ta{p.tokens ? <span className="block text-xs text-muted-foreground">{p.tokens.toLocaleString("uz-UZ")} token</span> : null}</Td>
                <Td><Badge variant={p.calls === 0 ? "neutral" : p.errorPct >= 50 ? "danger" : p.errorPct > 0 ? "amber" : "success"}>{p.calls === 0 ? "—" : `${p.errorPct}%`}</Badge></Td>
                <Td className="whitespace-nowrap">{p.avgMs != null ? `${p.avgMs} ms` : "—"}</Td>
                <Td>{p.role === "disabled" && p.explicitRole ? <Badge>O'chirilgan</Badge> : p.breakerSeconds > 0 ? <Badge variant="danger">Uzilgan ({p.breakerSeconds} s)</Badge> : <Badge variant="success">Ishlayapti</Badge>}</Td>
              </tr>))}
            {providers.claude && <tr><Td className="font-semibold">Claude<p className="text-xs font-normal text-muted-foreground">{providers.claude.host}</p></Td><Td className="text-xs">{providers.claude.model}</Td><Td>—</Td><Td>{providers.claude.calls} ta</Td><Td>{providers.claude.calls ? `${providers.claude.errorPct}%` : "—"}</Td><Td>{providers.claude.avgMs != null ? `${providers.claude.avgMs} ms` : "—"}</Td><Td><Badge variant="success">Ulangan</Badge></Td></tr>}
          </tbody></Table>)}
      </Card>
      <p className="text-xs text-muted-foreground">Uzilish holati faqat shu server nusxasida xotirada saqlanadi. «Ulanishni sinash» tugmasi Sozlamalar → AI bo'limida.</p>
    </div>
  );
}
