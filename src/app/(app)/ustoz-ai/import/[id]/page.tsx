"use client";
import * as React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { AlertTriangle, BookMarked, Play, RefreshCw, Trash2 } from "lucide-react";
import { api } from "@/lib/admin-client";
import { useQuery } from "@/lib/use-query";
import { ACTIVE, STATUS_LABEL, type ImportStatusInfo, type SessionView } from "@/lib/import-client";
import { QueryView } from "@/components/layout/query-view";
import { SectionHeader } from "@/components/layout/section-header";
import { AddFiles } from "@/components/import/add-files";
import { FileRow, ProcessingCard } from "@/components/import/processing-card";
import { ReviewCenter } from "@/components/import/review-center";
import { useImportRunner } from "@/components/import/use-import-runner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select } from "@/components/ui/form";
import { useToast } from "@/components/ui/toast";

const ROLES = [["AUTO", "Avtomatik aniqlansin"], ["QUESTIONS", "Savollar"], ["ANSWERS", "Javoblar kaliti"]] as const;

function Workspace({ session, reload }: { session: SessionView; reload: () => void }) {
  const toast = useToast();
  const router = useRouter();
  const [cfg, setCfg] = React.useState<ImportStatusInfo | null>(null);
  const [busy, setBusy] = React.useState<string | null>(null);
  React.useEffect(() => { void (async () => { const r = await api<ImportStatusInfo>("/api/import/status"); if (r.ok) setCfg(r.data); })(); }, []);

  const active = ACTIVE.includes(session.status);
  const { last, offline } = useImportRunner(session.id, session.status, () => reload(), () => reload());

  const act = async (name: string, fn: () => ReturnType<typeof api>, ok?: string) => {
    setBusy(name);
    const r = await fn();
    setBusy(null);
    if (!r.ok) { toast("error", r.error); return false; }
    if (ok) toast("success", ok);
    reload();
    return true;
  };
  const start = () => act("start", () => api(`/api/import/${session.id}/start`, "POST", {}));
  const cancel = () => act("cancel", () => api(`/api/import/${session.id}/cancel`, "POST"), "Jarayon bekor qilindi. Topilgan savollar saqlandi.");
  const retry = () => act("retry", () => api(`/api/import/${session.id}/recheck`, "POST"), "Jarayon qayta boshlandi.");
  const remove = async () => {
    if (!window.confirm("Bu import va yuklangan fayllar o'chiriladi. Saqlangan shaxsiy testlaringiz o'zgarmaydi. Davom etamizmi?")) return;
    if (await act("delete", () => api(`/api/import/${session.id}`, "DELETE"))) router.push("/ustoz-ai/import");
  };
  const setRole = (fid: string, role: string) => act("role", () => api(`/api/import/${session.id}/files/${fid}`, "PATCH", { role }));
  const removeFile = (fid: string) => act("file", () => api(`/api/import/${session.id}/files/${fid}`, "DELETE"), "Fayl olib tashlandi.");

  const canStart = session.files.length > 0 && session.files.every((f) => !["PENDING_UPLOAD"].includes(f.parseStatus));
  const accept = cfg?.accept ?? ".pdf,.docx,.xlsx,.csv,.pptx,.odt,.ods,.odp,.txt,.jpg,.jpeg,.png,.webp";
  const maxBytes = (cfg?.maxMb ?? 20) * 1024 * 1024;
  const fileControls = (fid: string, role: string) => (
    <div className="flex items-center gap-1.5">
      <Select value={role === "MATERIAL" ? "AUTO" : role} onChange={(e) => void setRole(fid, e.target.value)} disabled={busy !== null || active} aria-label="Fayl vazifasi" className="h-8 w-44 text-xs">
        {ROLES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </Select>
      <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Faylni olib tashlash" disabled={busy !== null || active} onClick={() => void removeFile(fid)}><Trash2 className="h-4 w-4" aria-hidden /></Button>
    </div>
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={session.status === "FAILED" ? "danger" : session.status === "USER_APPROVED" ? "success" : active ? "blue" : "neutral"}>{STATUS_LABEL[session.status] ?? session.status}</Badge>
        {session.collections.map((c) => <Button key={c.id} asChild variant="outline" size="sm"><Link href={`/ustoz-ai/testlarim/${c.id}`}><BookMarked className="h-4 w-4" aria-hidden />{c.title}</Link></Button>)}
        <span className="flex-1" />
        <Button variant="ghost" size="sm" disabled={active} loading={busy === "delete"} onClick={remove}><Trash2 className="h-4 w-4" aria-hidden />Importni o'chirish</Button>
      </div>

      {cfg && cfg.blocked.length > 0 && session.status === "UPLOADED" && (
        <ul className="space-y-1 rounded-xl bg-amber/10 p-3">{cfg.blocked.map((b) => <li key={b} className="flex items-start gap-2 text-sm"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber" aria-hidden />{b}</li>)}</ul>
      )}

      {session.status === "UPLOADED" && (
        <Card className="space-y-4 p-5">
          <div>
            <h2 className="text-lg font-bold">Yuklangan fayllar</h2>
            <p className="text-sm text-muted-foreground">Savollar va javoblar alohida fayllarda bo'lsa, ularni qo'shib, vazifasini belgilang. Bilmasangiz, «Avtomatik aniqlansin» qoldiring: tarkibiga qarab aniqlanadi.</p>
          </div>
          <ul className="space-y-2">{session.files.map((f) => <FileRow key={f.id} f={f} right={fileControls(f.id, f.role)} />)}</ul>
          <div className="flex flex-wrap items-center gap-3">
            <AddFiles sessionId={session.id} accept={accept} maxBytes={maxBytes} onAdded={reload} disabled={session.files.length >= (cfg?.maxFiles ?? 6)} />
            <AddFiles sessionId={session.id} accept={accept} maxBytes={maxBytes} role="ANSWERS" label="Javoblar kalitini qo'shish" onAdded={reload} disabled={session.files.length >= (cfg?.maxFiles ?? 6)} />
            <span className="flex-1" />
            <Button size="lg" disabled={!canStart} loading={busy === "start"} onClick={() => void start()}><Play className="h-4 w-4" aria-hidden />Tahlilni boshlash</Button>
          </div>
        </Card>
      )}

      {active && <ProcessingCard session={session} last={last} offline={offline} onCancel={() => void cancel()} cancelling={busy === "cancel"} />}

      {(session.status === "FAILED" || session.status === "CANCELED") && (
        <Card className="space-y-3 border-danger/30 p-5">
          <h2 className="text-lg font-bold">{session.status === "FAILED" ? "Tahlil to'liq tugamadi" : "Jarayon bekor qilingan"}</h2>
          <p className="text-sm text-muted-foreground">{session.error ?? "Topilgan savollar saqlangan. Jarayonni qolgan joyidan davom ettirishingiz mumkin."}</p>
          <ul className="space-y-2">{session.files.map((f) => <FileRow key={f.id} f={f} />)}</ul>
          <div><Button loading={busy === "retry"} onClick={() => void retry()}><RefreshCw className="h-4 w-4" aria-hidden />Davom ettirish</Button></div>
        </Card>
      )}

      {session.status === "NEEDS_REVIEW" && session.aiBlocked && (
        <p role="status" className="flex items-start gap-2 rounded-xl bg-amber/10 p-3 text-sm"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber" aria-hidden /><span>{session.aiBlocked} Savollar saqlandi va fayldagi kalit bo'yicha ko'rib chiqildi. AI tayyor bo'lgach «Hammasini qayta tekshirish»ni bosing.</span></p>
      )}
      {!active && session.warnings.length > 0 && (
        <details className="rounded-xl border border-border bg-card p-3 text-sm">
          <summary className="cursor-pointer font-semibold">Eslatmalar ({session.warnings.length})</summary>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground">{session.warnings.map((w, i) => <li key={i}>{w}</li>)}</ul>
        </details>
      )}

      {!["UPLOADED", "FAILED", "CANCELED"].includes(session.status) && (
        <>
          {!active && (
            <div className="flex flex-wrap items-center gap-3">
              <AddFiles sessionId={session.id} accept={accept} maxBytes={maxBytes} label="Fayl qo'shish" onAdded={reload} />
              <AddFiles sessionId={session.id} accept={accept} maxBytes={maxBytes} role="ANSWERS" label="Javoblar kalitini qo'shish" onAdded={reload} />
              <p className="text-xs text-muted-foreground">Yangi fayl qo'shilsa, tahlil faqat yangi fayl uchun qayta boshlanadi.</p>
            </div>
          )}
          {(!active || session.counts.total > 0) && <ReviewCenter session={session} locked={active} onSessionChanged={reload} />}
        </>
      )}
    </div>
  );
}

export default function Page() {
  const { id } = useParams<{ id: string }>();
  const q = useQuery<SessionView>(id ? `/api/import/${id}` : null);
  return (
    <div className="mx-auto max-w-7xl">
      <SectionHeader title={q.data?.title ?? "Yuklangan material"} lead="Fayl tahlili, savollarni tekshirish va shaxsiy testga saqlash." back={{ href: "/ustoz-ai/import", label: "Oldingi yuklashlarim" }} />
      <QueryView q={q}>{(s) => <Workspace session={s} reload={q.reload} />}</QueryView>
    </div>
  );
}
