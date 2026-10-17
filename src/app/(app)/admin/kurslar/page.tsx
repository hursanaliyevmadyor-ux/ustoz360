"use client";
import * as React from "react";
import { Check, X, Archive } from "lucide-react";
import { adminModule } from "@/lib/modules";
import { api } from "@/lib/admin-client";
import { fmtUzs } from "@/lib/plans";
import { useQuery } from "@/lib/use-query";
import { QueryView } from "@/components/layout/query-view";
import { PageHeader } from "@/components/layout/page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Field, Select, Textarea } from "@/components/ui/form";
import { EmptyState } from "@/components/ui/states";
import { Table, Td, Th } from "@/components/ui/table";
import { useToast } from "@/components/ui/toast";

type C = { id: string; title: string; description: string; subject: string; kind: string; priceUzs: number; lessonCount: number; accessUrl: string | null; status: string; rejectReason: string | null; author: string; sales: number };
const LABEL: Record<string, { t: string; v: "neutral" | "amber" | "success" | "danger" | "blue" }> = {
  DRAFT: { t: "Qoralama", v: "neutral" }, REVIEW: { t: "Tekshiruvda", v: "amber" }, APPROVED: { t: "Tasdiqlangan", v: "success" }, REJECTED: { t: "Rad etilgan", v: "danger" }, ARCHIVED: { t: "Arxiv", v: "neutral" },
};

export default function Page() {
  const toast = useToast();
  const [status, setStatus] = React.useState("REVIEW");
  const q = useQuery<{ courses: C[] }>(`/api/admin/courses?status=${status}`);
  const [reject, setReject] = React.useState<C | null>(null);
  const [busy, setBusy] = React.useState("");
  const act = async (c: C, body: object, ok: string) => {
    setBusy(c.id);
    const r = await api(`/api/admin/courses/${c.id}`, "PATCH", body);
    setBusy("");
    if (!r.ok) { toast("error", r.error); return; }
    toast("success", ok); q.reload();
  };
  return (
    <>
      <PageHeader module={adminModule} title="Kurslar" description="Mualliflar yuborgan kurslarni tekshiring: tasdiqlangani katalogda ko'rinadi" />
      <Card>
        <div className="p-4"><Select className="w-56" value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Holat">
          {Object.entries(LABEL).map(([k, v]) => <option key={k} value={k}>{v.t}</option>)}</Select></div>
        <QueryView q={q}>{(d) => d.courses.length === 0 ? <div className="p-4 pt-0"><EmptyState title="Kurs yo'q" text={status === "REVIEW" ? "Tekshiruvni kutayotgan kurs yo'q." : "Bu holatda kurs yo'q."} /></div> : (
          <Table><thead><tr><Th>Kurs</Th><Th>Muallif</Th><Th>Narx</Th><Th>Holat</Th><Th><span className="sr-only">Amallar</span></Th></tr></thead><tbody>
            {d.courses.map((c) => (
              <tr key={c.id}>
                <Td className="max-w-[320px]"><p className="font-semibold">{c.title}</p><p className="text-xs text-muted-foreground">{c.kind} · {c.subject}{c.lessonCount ? ` · ${c.lessonCount} dars` : ""}</p>
                  <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{c.description}</p>
                  {c.accessUrl && <a href={c.accessUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-primary underline">Kurs havolasi</a>}
                  {c.rejectReason && <p className="mt-1 text-xs text-danger">Sabab: {c.rejectReason}</p>}</Td>
                <Td>{c.author}</Td>
                <Td className="whitespace-nowrap">{c.priceUzs ? fmtUzs(c.priceUzs) : "Bepul"}</Td>
                <Td><Badge variant={LABEL[c.status]?.v}>{LABEL[c.status]?.t ?? c.status}</Badge>{c.sales > 0 && <p className="mt-1 text-xs text-muted-foreground">{c.sales} ta sotuv</p>}</Td>
                <Td className="whitespace-nowrap text-right">
                  {c.status === "REVIEW" && <>
                    <Button size="sm" variant="success" loading={busy === c.id} onClick={() => act(c, { action: "approve" }, "Kurs tasdiqlandi.")}><Check className="h-4 w-4" />Tasdiqlash</Button>{" "}
                    <Button size="sm" variant="outline" onClick={() => setReject(c)}><X className="h-4 w-4" />Rad etish</Button>
                  </>}
                  {c.status === "APPROVED" && <Button size="sm" variant="outline" loading={busy === c.id} onClick={() => window.confirm("Kurs katalogdan olinadi (sotib olganlarda qoladi). Davom etasizmi?") && act(c, { action: "archive" }, "Kurs arxivlandi.")}><Archive className="h-4 w-4" />Arxivlash</Button>}
                </Td>
              </tr>))}
          </tbody></Table>)}</QueryView>
      </Card>
      {reject && <RejectDialog c={reject} onClose={() => setReject(null)} onDone={() => { setReject(null); q.reload(); }} />}
    </>
  );
}

function RejectDialog({ c, onClose, onDone }: { c: C; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const [reason, setReason] = React.useState(""); const [busy, setBusy] = React.useState(false); const [err, setErr] = React.useState("");
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setErr("");
    const r = await api(`/api/admin/courses/${c.id}`, "PATCH", { action: "reject", reason });
    setBusy(false);
    if (!r.ok) { setErr(r.error); return; }
    toast("success", "Kurs rad etildi. Muallifga xabar yuborildi."); onDone();
  };
  return (
    <Dialog open onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent title="Kursni rad etish" description={c.title}>
        <form onSubmit={submit} className="space-y-4">
          <Field label="Sabab (muallif ko'radi)"><Textarea value={reason} onChange={(e) => setReason(e.target.value)} required maxLength={300} autoFocus /></Field>
          {err && <p role="alert" className="rounded-xl bg-danger/10 p-3 text-sm text-danger">{err}</p>}
          <div className="flex justify-end gap-3"><Button type="button" variant="outline" onClick={onClose}>Bekor qilish</Button><Button type="submit" variant="danger" loading={busy}>Rad etish</Button></div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
