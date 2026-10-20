"use client";
import * as React from "react";
import Link from "next/link";
import { BookMarked } from "lucide-react";
import { api } from "@/lib/admin-client";
import { COLLECTION_STATUS_LABEL, type CollectionRow } from "@/lib/import-client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Field, Input, Select } from "@/components/ui/form";
import { SuccessState } from "@/components/ui/states";

type Topics = { subjects: { id: string; name: string; topics: { id: string; name: string }[] }[] };
type Saved = { collectionId: string; added: number; skipped: number; notEligible: number };

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

  const save = async () => {
    setBusy(true); setError("");
    const r = await api<Saved>(`/api/import/${sessionId}/save`, "POST", { ...(target ? { collectionId: target } : { title: title.trim() || undefined }), ...(topicId && { topicId }) });
    setBusy(false);
    if (!r.ok) { setError(r.error); return; }
    setSaved(r.data); onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Testga saqlash" description={`${approved} ta tasdiqlangan savol shaxsiy testingizga qo'shiladi. Ular faqat sizga ko'rinadi.`}>
        {saved ? (
          <SuccessState title="Saqlandi" text={`${saved.added} ta savol qo'shildi${saved.skipped ? `, ${saved.skipped} tasi oldin qo'shilgan` : ""}${saved.notEligible ? `, ${saved.notEligible} tasi mos kelmadi (bitta to'g'ri javobli emas)` : ""}.`}
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
