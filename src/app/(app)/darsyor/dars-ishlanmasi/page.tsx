"use client";
import * as React from "react";
import { Download, FileDown, Printer, Save, Wand2 } from "lucide-react";
import { modules } from "@/lib/modules";
import { api } from "@/lib/admin-client";
import { downloadBlob, downloadDoc, escapeHtml, safeName } from "@/lib/download";
import { PageHeader } from "@/components/layout/page";
import { useShell } from "@/components/layout/shell-context";
import { DocList, loadDoc, persistDoc, useDocList } from "@/components/darsyor/store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { NoBackendNote } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import type { z } from "zod";
import type { lessonPlanData } from "@/server/docsvalid";

const SECTIONS = ["Maqsad va kutiladigan natijalar", "Kerakli jihozlar", "Tashkiliy qism", "O'tgan mavzuni takrorlash", "Yangi mavzu", "Amaliy mashqlar", "Mustahkamlash", "Formativ baholash", "Uy vazifasi", "Refleksiya"];
const SUBJECTS = ["Matematika", "Ona tili", "Tabiiy fanlar", "Ingliz tili", "Tarix", "Fizika", "Kimyo", "Biologiya", "Informatika", "Boshlang'ich ta'lim"];
type Plan = z.infer<typeof lessonPlanData>;
const empty = () => Object.fromEntries(SECTIONS.map((s) => [s, ""]));
const NOTE_SECTIONS = (sections: Record<string, string>) => [...SECTIONS, ...Object.keys(sections).filter((k) => !SECTIONS.includes(k))];

export default function Page() {
  const toast = useToast(); const { pub } = useShell();
  const list = useDocList("lesson_plan");
  const [f, setF] = React.useState({ subject: "Matematika", grade: "3", topic: "", dur: "45", goal: "" });
  const [body, setBody] = React.useState<Record<string, string> | null>(null);
  const [aiMade, setAiMade] = React.useState(false);
  const [docId, setDocId] = React.useState<string | null>(null);
  const [dirty, setDirty] = React.useState(false);
  const [busy, setBusy] = React.useState<"" | "ai" | "save">("");
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => { setF({ ...f, [k]: e.target.value }); setDirty(true); };
  const title = `${f.topic.trim() || "Dars ishlanmasi"} (${f.grade}-sinf)`;

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!f.topic.trim()) { toast("error", "Mavzuni kiriting."); return; }
    setBusy("ai");
    const r = await api<{ sections: Record<string, string> }>("/api/ai/lesson", "POST", { subject: f.subject, grade: f.grade, topic: f.topic, duration: f.dur, goal: f.goal });
    setBusy("");
    if (r.ok) { setBody(r.data.sections); setAiMade(true); setDocId(null); setDirty(true); toast("success", "AI qoralama yozdi. Tekshirib, kerakli joyini tahrirlang."); return; }
    // AI ishlamasa ham ish to'xtamaydi: bo'sh shablon bilan qo'lda davom etiladi.
    setBody(empty()); setAiMade(false); setDocId(null); setDirty(true);
    toast("info", r.status === 401 ? "AI uchun tizimga kiring. Hozircha bo'sh shablon berildi." : r.status === 503 ? "AI hozir ulanmagan. Bo'sh shablonni qo'lda to'ldirishingiz mumkin." : r.error);
  };

  const save = async (status: "DRAFT" | "SAVED") => {
    if (!body) return;
    setBusy("save");
    const data: Plan = { params: { subject: f.subject, grade: f.grade, topic: f.topic, duration: Number(f.dur) || 45, goal: f.goal }, sections: body, ai: aiMade };
    const r = await persistDoc({ kind: "lesson_plan", title, subject: f.subject, grade: f.grade, status, data }, docId);
    setBusy("");
    if (!r.ok) { toast("error", r.status === 401 ? "Saqlash uchun tizimga kiring." : r.error); return; }
    setDocId(r.data.id); setDirty(false); list.reload();
    toast("success", status === "DRAFT" ? "Qoralama saqlandi." : "Ishlanma saqlandi.");
  };

  const open = async (id: string) => {
    if (dirty && !window.confirm("Saqlanmagan o'zgarishlar yo'qoladi. Davom etasizmi?")) return;
    const r = await loadDoc<Plan>(id);
    if (!r.ok) { toast("error", r.error); return; }
    const p = r.data.data.params;
    setF({ subject: p.subject, grade: p.grade, topic: p.topic, dur: String(p.duration), goal: p.goal ?? "" });
    setBody({ ...empty(), ...r.data.data.sections }); setAiMade(!!r.data.data.ai); setDocId(id); setDirty(false);
  };

  // Bosh sahifadagi "so'nggi ishlarim"dan ochish: ?doc=<id>
  React.useEffect(() => { const id = new URLSearchParams(window.location.search).get("doc"); if (id) void open(id); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const text = () => `DARS ISHLANMASI\nFan: ${f.subject}\nSinf: ${f.grade}\nMavzu: ${f.topic}\nDavomiyligi: ${f.dur} daqiqa\nMaqsad: ${f.goal}\n\n` + NOTE_SECTIONS(body ?? {}).map((s) => `## ${s}\n${body?.[s] ?? ""}\n`).join("\n");
  const html = () => `<h1>${escapeHtml(title)}</h1><p><b>Fan:</b> ${escapeHtml(f.subject)} &nbsp; <b>Sinf:</b> ${escapeHtml(f.grade)} &nbsp; <b>Davomiyligi:</b> ${escapeHtml(f.dur)} daqiqa</p>${f.goal ? `<p><b>Maqsad:</b> ${escapeHtml(f.goal)}</p>` : ""}` +
    NOTE_SECTIONS(body ?? {}).filter((s) => body?.[s]?.trim()).map((s) => `<h2>${escapeHtml(s)}</h2><p>${escapeHtml(body![s]).replace(/\n/g, "<br>")}</p>`).join("");

  return (
    <>
      <PageHeader module={modules[1]} title="Dars ishlanmasi" description="Parametrlarni tanlang: AI qoralama yozadi, siz tahrirlab saqlaysiz" />
      <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
        <div className="space-y-6 no-print">
          <Card><CardHeader><CardTitle>Parametrlar</CardTitle></CardHeader>
            <form onSubmit={create}><CardContent className="space-y-4">
              <Field label="Fan"><Input list="subjects" value={f.subject} onChange={set("subject")} maxLength={80} required /></Field>
              <datalist id="subjects">{SUBJECTS.map((s) => <option key={s} value={s} />)}</datalist>
              <Field label="Sinf"><Select value={f.grade} onChange={set("grade")}>{[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((g) => <option key={g}>{g}</option>)}</Select></Field>
              <Field label="Mavzu"><Input value={f.topic} onChange={set("topic")} placeholder="Masalan: Kasrlarni solishtirish" maxLength={200} /></Field>
              <Field label="Davomiyligi (daqiqa)"><Input type="number" min={10} max={120} value={f.dur} onChange={set("dur")} /></Field>
              <Field label="Dars maqsadi"><Textarea value={f.goal} onChange={set("goal")} placeholder="O'quvchi ... qila oladi" maxLength={500} /></Field>
              <Button className="w-full" type="submit" loading={busy === "ai"}><Wand2 className="h-4 w-4" />{busy === "ai" ? "AI yozmoqda (30-60 soniya)..." : "AI bilan yaratish"}</Button>
              <Button className="w-full" type="button" variant="outline" onClick={() => { setBody(empty()); setAiMade(false); setDocId(null); setDirty(true); }}>Bo'sh shablondan boshlash</Button>
              <NoBackendNote>{pub?.aiDisclaimer ?? "AI matni noto'g'ri bo'lishi mumkin: ishlatishdan oldin tekshiring."}</NoBackendNote>
            </CardContent></form></Card>
          <DocList list={list} activeId={docId} onOpen={open} onDeleted={(id) => { if (id === docId) { setDocId(null); setBody(null); } }} title="Mening ishlanmalarim" empty="Hali saqlangan ishlanma yo'q." />
        </div>
        <Card className="print-area">
          <CardHeader><CardTitle>{body ? title : "Natija"}</CardTitle>
            {body && <div className="no-print flex flex-wrap items-center gap-2">
              {aiMade && <Badge variant="amber">AI qoralamasi</Badge>}{dirty && <Badge variant="neutral">Saqlanmagan</Badge>}
              <Button size="sm" variant="outline" loading={busy === "save"} onClick={() => save("DRAFT")}>Qoralama</Button>
              <Button size="sm" loading={busy === "save"} onClick={() => save("SAVED")}><Save className="h-4 w-4" />Saqlash</Button>
              <Button size="sm" variant="outline" onClick={() => downloadBlob(`${safeName(title)}.txt`, text())}><Download className="h-4 w-4" />.txt</Button>
              <Button size="sm" variant="outline" onClick={() => downloadDoc(`${safeName(title)}.doc`, title, html())}><FileDown className="h-4 w-4" />Word</Button>
              <Button size="sm" variant="outline" onClick={() => window.print()}><Printer className="h-4 w-4" />Chop etish / PDF</Button>
            </div>}</CardHeader>
          <CardContent className="space-y-4">
            {!body ? <p className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">Chapdagi formani to'ldirib «AI bilan yaratish»ni bosing yoki bo'sh shablondan boshlang.</p>
              : <><p className="text-sm text-muted-foreground"><b>{f.subject}</b>, {f.grade}-sinf · {f.topic || "mavzu kiritilmagan"} · {f.dur} daqiqa</p>
                <div className="no-print space-y-4">
                  {NOTE_SECTIONS(body).map((s) => (
                    <Field key={s} label={s}><Textarea className="min-h-28" value={body[s] ?? ""} onChange={(e) => { setBody({ ...body, [s]: e.target.value }); setDirty(true); }} /></Field>))}
                </div>
                {/* Chop etishda matn maydonlari qirqilmasligi uchun oddiy matn ko'rinishi */}
                <div className="print-only space-y-3">
                  {f.goal && <p><b>Maqsad:</b> {f.goal}</p>}
                  {NOTE_SECTIONS(body).filter((s) => body[s]?.trim()).map((s) => <div key={s} className="print-break"><h3 className="font-bold">{s}</h3><p className="whitespace-pre-wrap">{body[s]}</p></div>)}
                </div></>}
          </CardContent></Card>
      </div>
    </>
  );
}
