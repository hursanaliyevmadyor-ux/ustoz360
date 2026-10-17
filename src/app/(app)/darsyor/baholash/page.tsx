"use client";
import * as React from "react";
import { Copy, Download, Plus, Printer, Save, Trash2 } from "lucide-react";
import { modules } from "@/lib/modules";
import { csvCell } from "@/server/csv";
import { downloadBlob, safeName } from "@/lib/download";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/layout/page";
import { DocList, loadDoc, persistDoc, useDocList } from "@/components/darsyor/store";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/toast";

export default function Page() {
  // Bosh sahifadan ochilganda: ?tab=rubrika|kuzatuv&doc=<id>
  const [tab, setTab] = React.useState("rubrika"); const [doc, setDoc] = React.useState<string | null>(null);
  React.useEffect(() => { const q = new URLSearchParams(window.location.search); if (q.get("tab")) setTab(q.get("tab")!); setDoc(q.get("doc")); }, []);
  return (
    <>
      <PageHeader module={modules[1]} title="Baholash materiallari" description="Rubrika, kuzatuv varaqasi va fikr-mulohaza: saqlanadi, chop etiladi, CSV qilib yuklanadi" />
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="no-print"><TabsTrigger value="rubrika">Rubrika</TabsTrigger><TabsTrigger value="kuzatuv">Kuzatuv varaqasi</TabsTrigger><TabsTrigger value="fikr">Fikr-mulohaza</TabsTrigger></TabsList>
        <TabsContent value="rubrika"><RubricTab initialDoc={tab === "rubrika" ? doc : null} /></TabsContent>
        <TabsContent value="kuzatuv"><ObservationTab initialDoc={tab === "kuzatuv" ? doc : null} /></TabsContent>
        <TabsContent value="fikr"><FeedbackTab /></TabsContent>
      </Tabs>
    </>
  );
}

// ---------------- Rubrika ----------------
type Rubric = { levels: string[]; criteria: { name: string; cells: string[] }[] };
const TEMPLATES: Record<string, { levels: string[]; criteria: { name: string; cells: string[] }[] }> = {
  bosh: { levels: ["Boshlang'ich", "O'rta", "Yuqori"], criteria: [{ name: "Mavzuni tushunish", cells: ["", "", ""] }, { name: "Amaliy qo'llash", cells: ["", "", ""] }, { name: "Fikrni bayon etish", cells: ["", "", ""] }] },
  insho: { levels: ["1 — qoniqarsiz", "2 — qoniqarli", "3 — yaxshi", "4 — a'lo"], criteria: [
    { name: "Mazmun va g'oya", cells: ["G'oya aniq emas", "G'oya bor, lekin yetarli ochilmagan", "G'oya aniq va asoslangan", "G'oya chuqur, o'ziga xos"] },
    { name: "Tuzilma", cells: ["Kirish/xulosa yo'q", "Tuzilma qisman", "Mantiqiy tuzilma", "Mukammal bog'langan tuzilma"] },
    { name: "Til va imlo", cells: ["Ko'p xato", "Bir necha xato", "Kam xato", "Xatosiz"] },
  ] },
  taqdimot: { levels: ["Boshlang'ich", "O'rta", "Yuqori"], criteria: [{ name: "Mazmunning to'liqligi", cells: ["", "", ""] }, { name: "Nutq va vaqtdan foydalanish", cells: ["", "", ""] }, { name: "Savollarga javob", cells: ["", "", ""] }, { name: "Ko'rgazmali vositalar", cells: ["", "", ""] }] },
  guruh: { levels: ["Boshlang'ich", "O'rta", "Yuqori"], criteria: [{ name: "Hamkorlik", cells: ["", "", ""] }, { name: "Vazifalar taqsimoti", cells: ["", "", ""] }, { name: "Natija", cells: ["", "", ""] }] },
};
const rubricCsv = (title: string, r: Rubric) => ["Mezon," + r.levels.map(csvCell).join(",")].concat(r.criteria.map((c) => [c.name, ...r.levels.map((_, i) => c.cells[i] ?? "")].map(csvCell).join(","))).join("\r\n").replace(/^/, `${csvCell(title)}\r\n`);

function RubricTab({ initialDoc }: { initialDoc: string | null }) {
  const toast = useToast();
  const list = useDocList("rubric");
  const [title, setTitle] = React.useState("Rubrika");
  const [r, setR] = React.useState<Rubric>(structuredClone(TEMPLATES.bosh));
  const [docId, setDocId] = React.useState<string | null>(null);
  const [dirty, setDirty] = React.useState(false); const [busy, setBusy] = React.useState(false);
  const up = (n: Rubric) => { setR(n); setDirty(true); };
  const setCell = (i: number, j: number, v: string) => up({ ...r, criteria: r.criteria.map((c, k) => (k === i ? { ...c, cells: r.levels.map((_, x) => (x === j ? v : c.cells[x] ?? "")) } : c)) });

  const save = async (status: "DRAFT" | "SAVED") => {
    setBusy(true);
    const res = await persistDoc({ kind: "rubric", title: title.trim() || "Rubrika", status, data: r }, docId);
    setBusy(false);
    if (!res.ok) { toast("error", res.status === 401 ? "Saqlash uchun tizimga kiring." : res.error); return; }
    setDocId(res.data.id); setDirty(false); list.reload(); toast("success", "Rubrika saqlandi.");
  };
  const open = async (id: string) => {
    if (dirty && !window.confirm("Saqlanmagan o'zgarishlar yo'qoladi. Davom etasizmi?")) return;
    const res = await loadDoc<Rubric>(id);
    if (!res.ok) { toast("error", res.error); return; }
    setR(res.data.data); setTitle(res.data.title); setDocId(id); setDirty(false);
  };
  React.useEffect(() => { if (initialDoc) void open(initialDoc); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialDoc]);
  const tpl = (k: string) => { if (dirty && !window.confirm("Joriy jadval almashtiriladi. Davom etasizmi?")) return; setR(structuredClone(TEMPLATES[k])); setDocId(null); setDirty(true); };

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
      <Card className="print-area">
        <CardHeader><CardTitle>Rubrika muharriri</CardTitle>
          <div className="no-print flex flex-wrap items-center gap-2">
            {dirty && <Badge variant="neutral">Saqlanmagan</Badge>}
            <Button size="sm" variant="outline" loading={busy} onClick={() => save("DRAFT")}>Qoralama</Button>
            <Button size="sm" loading={busy} onClick={() => save("SAVED")}><Save className="h-4 w-4" />Saqlash</Button>
            <Button size="sm" variant="outline" onClick={() => downloadBlob(`${safeName(title)}.csv`, rubricCsv(title, r), "text/csv;charset=utf-8", true)}><Download className="h-4 w-4" />CSV</Button>
            <Button size="sm" variant="outline" onClick={() => window.print()}><Printer className="h-4 w-4" />Chop etish</Button>
          </div></CardHeader>
        <CardContent className="space-y-4">
          <div className="no-print grid gap-3 sm:grid-cols-2">
            <Field label="Nomi"><Input value={title} maxLength={120} onChange={(e) => { setTitle(e.target.value); setDirty(true); }} /></Field>
            <Field label="Shablon" hint="Tanlansa jadval almashadi"><Select value="" onChange={(e) => e.target.value && tpl(e.target.value)}><option value="">Tanlang...</option><option value="bosh">Bo'sh (3 daraja)</option><option value="insho">Insho (4 daraja)</option><option value="taqdimot">Taqdimot</option><option value="guruh">Guruh ishi</option></Select></Field>
          </div>
          <h3 className="print-only text-lg font-bold">{title}</h3>
          <div className="overflow-x-auto"><table className="w-full min-w-[640px] border-separate border-spacing-1 text-sm">
            <thead><tr><th className="w-40 text-left text-xs uppercase text-muted-foreground">Mezon</th>{r.levels.map((l, i) => (
              <th key={i}><Input value={l} aria-label={`${i + 1}-daraja nomi`} maxLength={40} className="font-bold" onChange={(e) => up({ ...r, levels: r.levels.map((x, k) => (k === i ? e.target.value : x)) })} /></th>))}<th className="no-print" /></tr></thead>
            <tbody>{r.criteria.map((c, i) => (
              <tr key={i} className="print-break align-top">
                <td><Textarea className="min-h-16 font-semibold" value={c.name} aria-label={`${i + 1}-mezon`} maxLength={120} onChange={(e) => up({ ...r, criteria: r.criteria.map((x, k) => (k === i ? { ...x, name: e.target.value } : x)) })} /></td>
                {r.levels.map((_, j) => <td key={j}><Textarea className="min-h-16" value={c.cells[j] ?? ""} placeholder="Tavsif" aria-label={`${c.name || i + 1}: ${r.levels[j]}`} maxLength={400} onChange={(e) => setCell(i, j, e.target.value)} /></td>)}
                <td className="no-print"><Button variant="ghost" size="icon" aria-label="Mezonni o'chirish" disabled={r.criteria.length <= 1} onClick={() => up({ ...r, criteria: r.criteria.filter((_, k) => k !== i) })}><Trash2 className="h-4 w-4" /></Button></td>
              </tr>))}</tbody></table></div>
          <div className="no-print flex flex-wrap gap-2">
            {r.criteria.length < 15 && <Button variant="outline" size="sm" onClick={() => up({ ...r, criteria: [...r.criteria, { name: "Yangi mezon", cells: r.levels.map(() => "") }] })}><Plus className="h-4 w-4" />Mezon</Button>}
            {r.levels.length < 5 && <Button variant="outline" size="sm" onClick={() => up({ ...r, levels: [...r.levels, `${r.levels.length + 1}-daraja`], criteria: r.criteria.map((c) => ({ ...c, cells: [...c.cells, ""] })) })}><Plus className="h-4 w-4" />Daraja</Button>}
            {r.levels.length > 2 && <Button variant="ghost" size="sm" onClick={() => up({ levels: r.levels.slice(0, -1), criteria: r.criteria.map((c) => ({ ...c, cells: c.cells.slice(0, -1) })) })}>Oxirgi darajani olib tashlash</Button>}
          </div>
        </CardContent></Card>
      <DocList list={list} activeId={docId} onOpen={open} title="Mening rubrikalarim" empty="Hali saqlangan rubrika yo'q." />
    </div>
  );
}

// ---------------- Kuzatuv varaqasi ----------------
type Obs = { group: string; indicators: string[]; columns: string[]; marks: Record<string, "+" | "±" | "-">; notes: string };
const CYCLE: Record<string, "+" | "±" | "-" | ""> = { "": "+", "+": "±", "±": "-", "-": "" };
const obsStart = (): Obs => ({ group: "", indicators: ["Faol qatnashadi", "Vazifani mustaqil bajaradi", "Hamkorlik qiladi"], columns: ["1-o'quvchi", "2-o'quvchi", "3-o'quvchi"], marks: {}, notes: "" });
const obsCsv = (title: string, o: Obs) => `${csvCell(title)}\r\n${csvCell(o.group)}\r\n` + ["Ko'rsatkich," + o.columns.map(csvCell).join(",")].concat(o.indicators.map((ind, i) => [ind, ...o.columns.map((_, j) => o.marks[`${i}:${j}`] ?? "")].map(csvCell).join(","))).join("\r\n") + `\r\n${csvCell("Izoh: " + o.notes)}`;

function ObservationTab({ initialDoc }: { initialDoc: string | null }) {
  const toast = useToast();
  const list = useDocList("observation");
  const [title, setTitle] = React.useState("Kuzatuv varaqasi");
  const [o, setO] = React.useState<Obs>(obsStart());
  const [docId, setDocId] = React.useState<string | null>(null);
  const [dirty, setDirty] = React.useState(false); const [busy, setBusy] = React.useState(false);
  const up = (n: Obs) => { setO(n); setDirty(true); };
  const cycle = (i: number, j: number) => {
    const key = `${i}:${j}`; const next = CYCLE[o.marks[key] ?? ""];
    const marks = { ...o.marks }; if (next) marks[key] = next; else delete marks[key];
    up({ ...o, marks });
  };
  const save = async (status: "DRAFT" | "SAVED") => {
    setBusy(true);
    const res = await persistDoc({ kind: "observation", title: title.trim() || "Kuzatuv varaqasi", status, data: o }, docId);
    setBusy(false);
    if (!res.ok) { toast("error", res.status === 401 ? "Saqlash uchun tizimga kiring." : res.error); return; }
    setDocId(res.data.id); setDirty(false); list.reload(); toast("success", "Kuzatuv varaqasi saqlandi.");
  };
  const open = async (id: string) => {
    if (dirty && !window.confirm("Saqlanmagan o'zgarishlar yo'qoladi. Davom etasizmi?")) return;
    const res = await loadDoc<Obs>(id);
    if (!res.ok) { toast("error", res.error); return; }
    setO(res.data.data); setTitle(res.data.title); setDocId(id); setDirty(false);
  };
  React.useEffect(() => { if (initialDoc) void open(initialDoc); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialDoc]);
  const plus = (j: number) => o.indicators.reduce((n, _, i) => n + (o.marks[`${i}:${j}`] === "+" ? 1 : 0), 0);

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
      <Card className="print-area">
        <CardHeader><CardTitle>Kuzatuv varaqasi</CardTitle>
          <div className="no-print flex flex-wrap items-center gap-2">
            {dirty && <Badge variant="neutral">Saqlanmagan</Badge>}
            <Button size="sm" variant="outline" loading={busy} onClick={() => save("DRAFT")}>Qoralama</Button>
            <Button size="sm" loading={busy} onClick={() => save("SAVED")}><Save className="h-4 w-4" />Saqlash</Button>
            <Button size="sm" variant="outline" onClick={() => downloadBlob(`${safeName(title)}.csv`, obsCsv(title, o), "text/csv;charset=utf-8", true)}><Download className="h-4 w-4" />CSV</Button>
            <Button size="sm" variant="outline" onClick={() => window.print()}><Printer className="h-4 w-4" />Chop etish</Button>
          </div></CardHeader>
        <CardContent className="space-y-4">
          <div className="no-print grid gap-3 sm:grid-cols-2">
            <Field label="Nomi"><Input value={title} maxLength={120} onChange={(e) => { setTitle(e.target.value); setDirty(true); }} /></Field>
            <Field label="Sinf / guruh"><Input value={o.group} maxLength={80} onChange={(e) => up({ ...o, group: e.target.value })} /></Field>
          </div>
          <p className="no-print rounded-xl bg-amber/10 px-3.5 py-2.5 text-xs">Ustunlarda o'quvchining ism-familiyasi o'rniga taxallus yoki raqam yozing (shaxsiy ma'lumotni kamaytirish uchun). Katakni bosing: + (bajaradi), ± (qisman), − (hali yo'q).</p>
          <h3 className="print-only text-lg font-bold">{title}{o.group ? ` — ${o.group}` : ""}</h3>
          <div className="overflow-x-auto"><table className="w-full min-w-[560px] border-separate border-spacing-1 text-sm">
            <thead><tr><th className="text-left text-xs uppercase text-muted-foreground">Ko'rsatkich</th>{o.columns.map((c, j) => (
              <th key={j} className="w-24"><Input value={c} aria-label={`${j + 1}-ustun`} maxLength={40} className="px-2 text-center" onChange={(e) => up({ ...o, columns: o.columns.map((x, k) => (k === j ? e.target.value : x)) })} /></th>))}<th className="no-print" /></tr></thead>
            <tbody>{o.indicators.map((ind, i) => (
              <tr key={i}>
                <td><Input value={ind} aria-label={`${i + 1}-ko'rsatkich`} maxLength={160} onChange={(e) => up({ ...o, indicators: o.indicators.map((x, k) => (k === i ? e.target.value : x)) })} /></td>
                {o.columns.map((_, j) => {
                  const m = o.marks[`${i}:${j}`] ?? "";
                  return <td key={j}><button type="button" onClick={() => cycle(i, j)} aria-label={`${ind || i + 1}, ${o.columns[j]}: ${m === "-" ? "yo'q" : m === "±" ? "qisman" : m === "+" ? "bajaradi" : "belgilanmagan"}`}
                    className={cn("h-11 w-full rounded-lg border border-border text-lg font-bold", m === "+" && "bg-success/10 text-success", m === "±" && "bg-amber/15 text-warning", m === "-" && "bg-danger/10 text-danger")}>{m === "-" ? "−" : m}</button></td>;
                })}
                <td className="no-print"><Button variant="ghost" size="icon" aria-label="Ko'rsatkichni o'chirish" disabled={o.indicators.length <= 1} onClick={() => up({ ...o, indicators: o.indicators.filter((_, k) => k !== i), marks: Object.fromEntries(Object.entries(o.marks).filter(([k]) => !k.startsWith(`${i}:`)).map(([k, v]) => { const [a, b] = k.split(":").map(Number); return [`${a > i ? a - 1 : a}:${b}`, v]; })) })}><Trash2 className="h-4 w-4" /></Button></td>
              </tr>))}
              <tr><td className="text-right text-xs font-semibold text-muted-foreground">«+» soni</td>{o.columns.map((_, j) => <td key={j} className="text-center font-bold">{plus(j)}</td>)}<td className="no-print" /></tr></tbody></table></div>
          <div className="no-print flex flex-wrap gap-2">
            {o.indicators.length < 20 && <Button size="sm" variant="outline" onClick={() => up({ ...o, indicators: [...o.indicators, ""] })}><Plus className="h-4 w-4" />Ko'rsatkich</Button>}
            {o.columns.length < 12 && <Button size="sm" variant="outline" onClick={() => up({ ...o, columns: [...o.columns, `${o.columns.length + 1}-o'quvchi`] })}><Plus className="h-4 w-4" />Ustun</Button>}
            {o.columns.length > 1 && <Button size="sm" variant="ghost" onClick={() => up({ ...o, columns: o.columns.slice(0, -1), marks: Object.fromEntries(Object.entries(o.marks).filter(([k]) => Number(k.split(":")[1]) < o.columns.length - 1)) })}>Oxirgi ustunni olib tashlash</Button>}
          </div>
          <Field label="Izohlar"><Textarea value={o.notes} maxLength={2000} onChange={(e) => up({ ...o, notes: e.target.value })} /></Field>
        </CardContent></Card>
      <DocList list={list} activeId={docId} onOpen={open} title="Mening varaqalarim" empty="Hali saqlangan varaqa yo'q." />
    </div>
  );
}

// ---------------- Fikr-mulohaza ----------------
const STARTERS = {
  strength: ["Siz ... ni to'g'ri bajardingiz.", "Ayniqsa ... yaxshi chiqdi.", "Fikringizni aniq bayon qildingiz.", "Mustaqil ishlash ko'nikmangiz seziladi."],
  growth: ["... ustida yana ishlash kerak.", "... qismida xatolik bor: qayta ko'rib chiqing.", "Fikringizni misol bilan asoslang.", "Vaqtni yaxshiroq taqsimlang."],
  next: ["Keyingi qadam: ... ni qayta bajarib ko'ring.", "Mana shu namunaga qarab tuzating.", "Shu mavzuda yana 3 ta mashq ishlang.", "Sinfdoshingiz bilan natijani taqqoslang."],
};
const LABEL = { strength: "Kuchli tomon", growth: "O'sish nuqtasi", next: "Keyingi qadam" } as const;

function FeedbackTab() {
  const toast = useToast();
  const [t, setT] = React.useState({ strength: "", growth: "", next: "" });
  const [focus, setFocus] = React.useState<keyof typeof t>("strength");
  const add = (k: keyof typeof t, s: string) => setT((x) => ({ ...x, [k]: (x[k] ? x[k] + " " : "") + s }));
  const full = (Object.keys(LABEL) as (keyof typeof t)[]).filter((k) => t[k].trim()).map((k) => `${LABEL[k]}: ${t[k].trim()}`).join("\n");
  return (
    <div className="grid max-w-4xl gap-6">
      <Card><CardHeader><CardTitle>Formativ fikr-mulohaza</CardTitle></CardHeader><CardContent className="space-y-5">
        <p className="text-sm text-muted-foreground">Uch qismdan iborat qisqa fikr: nima yaxshi, nima o'sishi kerak, keyingi qadam. Tayyor jumlalarni bosib qo'shing va o'zingiz tahrirlang.</p>
        {(Object.keys(LABEL) as (keyof typeof t)[]).map((k) => (
          <div key={k} className="space-y-2">
            <Field label={LABEL[k]}><Textarea className="min-h-20" value={t[k]} maxLength={600} onFocus={() => setFocus(k)} onChange={(e) => setT({ ...t, [k]: e.target.value })} /></Field>
            <div className="flex flex-wrap gap-1.5" role="group" aria-label={`${LABEL[k]} uchun tayyor jumlalar`}>{STARTERS[k].map((s) => <button key={s} type="button" onClick={() => { add(k, s); setFocus(k); }} className={cn("min-h-9 rounded-full border border-border px-3 py-1 text-xs font-semibold hover:bg-muted", focus === k && "border-primary/40")}>{s}</button>)}</div>
          </div>))}
        <div className="flex flex-wrap gap-2">
          <Button disabled={!full} onClick={async () => { try { await navigator.clipboard.writeText(full); toast("success", "Nusxalandi."); } catch { toast("error", "Nusxalab bo'lmadi."); } }}><Copy className="h-4 w-4" />Nusxalash</Button>
          <Button variant="outline" disabled={!full} onClick={() => setT({ strength: "", growth: "", next: "" })}>Tozalash</Button>
        </div>
      </CardContent></Card>
    </div>
  );
}
