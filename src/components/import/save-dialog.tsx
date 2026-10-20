"use client";
import * as React from "react";
import Link from "next/link";
import { BookMarked } from "lucide-react";
import { api } from "@/lib/admin-client";
import { canvasToPng, cropFigure } from "@/lib/figure-crop";
import { COLLECTION_STATUS_LABEL, type CollectionRow } from "@/lib/import-client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Field, Input, Select } from "@/components/ui/form";
import { SuccessState } from "@/components/ui/states";

type Topics = { subjects: { id: string; name: string; topics: { id: string; name: string }[] }[] };
type Saved = { collectionId: string; added: number; skipped: number; notEligible: number; waitingFigures: number };
type Pending = { questionId: string; n: number; page: number | null; box: [number, number, number, number] | null; fileId: string; fileKind: string; done: boolean };

/** Tasdiqlangan savollarni shaxsiy testga saqlash: yangi test yoki mavjudiga qo'shish. Savollar umumiy bankka tushmaydi. */
export function SaveDialog({ open, onOpenChange, sessionId, defaultTitle, approved, onSaved }: { open: boolean; onOpenChange: (v: boolean) => void; sessionId: string; defaultTitle: string; approved: number; onSaved: () => void }) {
  const [title, setTitle] = React.useState(defaultTitle);
  const [target, setTarget] = React.useState("");
  const [topicId, setTopicId] = React.useState("");
  const [cols, setCols] = React.useState<CollectionRow[]>([]);
  const [topics, setTopics] = React.useState<Topics["subjects"]>([]);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");
  const [saved, setSaved] = React.useState<Saved | null>(null);

  React.useEffect(() => {
    if (!open) return;
    setSaved(null); setError(""); setTitle(defaultTitle);
    void (async () => {
      const [c, t] = await Promise.all([api<CollectionRow[]>("/api/personal-tests"), api<Topics>("/api/practice/topics")]);
      if (c.ok) setCols(c.data.filter((x) => ["PRIVATE_ACTIVE", "REJECTED"].includes(x.status)));
      if (t.ok) setTopics(t.data.subjects.filter((s) => s.topics.length));
    })();
  }, [open, defaultTitle]);

  const [prep, setPrep] = React.useState<{ done: number; total: number } | null>(null);

  /** Rasm joyi bor tasdiqlangan savollar: asl sahifadan rasm kesiladi va yuklanadi (tayyor testda savol bilan birga ko'rsatilishi uchun). */
  const prepareFigures = async (): Promise<number> => {
    const p = await api<{ items: Pending[] }>(`/api/import/${sessionId}/figures`);
    if (!p.ok) throw new Error(p.error);
    const todo = p.data.items.filter((x) => !x.done && x.box && x.page);
    let failed = 0;
    for (let i = 0; i < todo.length; i++) {
      setPrep({ done: i, total: todo.length });
      const it = todo[i];
      try {
        const blob = await canvasToPng(await cropFigure(sessionId, it.fileId, it.fileKind, { page: it.page, box: it.box }));
        const res = await fetch(`/api/import/${sessionId}/questions/${it.questionId}/figures/${it.n}`, { method: "PUT", headers: { "content-type": "image/png" }, body: blob });
        if (!res.ok) failed++;
      } catch { failed++; }
    }
    setPrep(null);
    return failed;
  };

  const save = async () => {
    setBusy(true); setError("");
    try { await prepareFigures(); } catch (e) { setPrep(null); setBusy(false); setError((e as Error).message || "Rasmlarni tayyorlab bo'lmadi."); return; }
    const r = await api<Saved>(`/api/import/${sessionId}/save`, "POST", { ...(target ? { collectionId: target } : { title: title.trim() || undefined }), ...(topicId && { topicId }) });
    setBusy(false);
    if (!r.ok) { setError(r.error); return; }
    setSaved(r.data); onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Testga saqlash" description={`${approved} ta tasdiqlangan savol shaxsiy testingizga qo'shiladi. Ular faqat sizga ko'rinadi.`}>
        {saved ? (
          <SuccessState title="Saqlandi" text={`${saved.added} ta savol qo'shildi${saved.skipped ? `, ${saved.skipped} tasi oldin qo'shilgan` : ""}${saved.notEligible - saved.waitingFigures > 0 ? `, ${saved.notEligible - saved.waitingFigures} tasi mos kelmadi (bitta to'g'ri javobli emas)` : ""}${saved.waitingFigures ? `, ${saved.waitingFigures} tasi saqlanmadi: rasmi tayyor bo'lmadi (rasm kesilmadi). Savol matnidan rasm belgisini olib tashlang yoki qayta urinib ko'ring` : ""}.`}
            action={<Button asChild><Link href={`/ustoz-ai/testlarim/${saved.collectionId}`}><BookMarked className="h-4 w-4" aria-hidden />Testni ochish</Link></Button>} />
        ) : (
          <div className="space-y-3.5">
            <Field label="Qayerga saqlansin?">
              <Select value={target} onChange={(e) => setTarget(e.target.value)}>
                <option value="">Yangi test yaratish</option>
                {cols.map((c) => <option key={c.id} value={c.id}>{c.title} ({c.counts.total} ta, {COLLECTION_STATUS_LABEL[c.status] ?? c.status})</option>)}
              </Select>
            </Field>
            {!target && <Field label="Test nomi"><Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} /></Field>}
            <Field label="Mavzu (ixtiyoriy)" hint="Mavzusi aniqlanmagan savollar shu mavzuga biriktiriladi. Tanlamasangiz, ular «Tasniflanmagan» bo'lib qoladi.">
              <Select value={topicId} onChange={(e) => setTopicId(e.target.value)}>
                <option value="">Tanlanmagan</option>
                {topics.map((s) => <optgroup key={s.id} label={s.name}>{s.topics.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</optgroup>)}
              </Select>
            </Field>
            {prep && <p role="status" className="text-sm text-muted-foreground">Savoldagi rasmlar tayyorlanmoqda: {prep.done + 1} / {prep.total}…</p>}
            {error && <p role="alert" className="text-sm text-danger">{error}</p>}
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => onOpenChange(false)}>Bekor qilish</Button>
              <Button loading={busy} disabled={approved === 0 || (!target && title.trim().length < 2)} onClick={save}>Saqlash</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
