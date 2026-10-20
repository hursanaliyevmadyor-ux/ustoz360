"use client";
import * as React from "react";
import Link from "next/link";
import { BookMarked, FileText, Trash2 } from "lucide-react";
import { api } from "@/lib/admin-client";
import { useQuery } from "@/lib/use-query";
import { ACTIVE, dateText, STATUS_LABEL, type SessionRow } from "@/lib/import-client";
import { ImportDropzone } from "@/components/import/import-dropzone";
import { QueryView } from "@/components/layout/query-view";
import { SectionHeader } from "@/components/layout/section-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";

const TONE: Record<string, "blue" | "success" | "danger" | "amber" | "neutral"> = { USER_APPROVED: "success", FAILED: "danger", NEEDS_REVIEW: "amber", READY_FOR_USER: "success", CANCELED: "neutral" };

export default function Page() {
  const toast = useToast();
  const q = useQuery<SessionRow[]>("/api/import");
  const [deleting, setDeleting] = React.useState<string | null>(null);

  // Faol importlar bo'lsa ro'yxat vaqti-vaqti bilan yangilanadi.
  const hasActive = q.data?.some((s) => ACTIVE.includes(s.status)) ?? false;
  const reload = q.reload;
  React.useEffect(() => { if (!hasActive) return; const t = setInterval(reload, 8000); return () => clearInterval(t); }, [hasActive, reload]);

  const remove = async (s: SessionRow) => {
    if (!window.confirm(`«${s.title}» importi va fayllari o'chiriladi. Saqlangan shaxsiy testlar o'zgarmaydi. Davom etamizmi?`)) return;
    setDeleting(s.id);
    const r = await api(`/api/import/${s.id}`, "DELETE");
    setDeleting(null);
    if (!r.ok) { toast("error", r.error); return; }
    toast("success", "Import o'chirildi.");
    reload();
  };

  return (
    <div className="mx-auto max-w-5xl">
      <SectionHeader title="Oldingi yuklashlarim" lead="Yuklagan fayllaringiz va ulardan ajratilgan savollar. Yarim qolgan tahlilni davom ettirishingiz mumkin." back={{ href: "/ustoz-ai", label: "USTOZ AI" }} />
      <ImportDropzone className="mb-6" />
      <div className="mb-4 flex flex-wrap gap-2">
        <Button asChild variant="outline" size="sm"><Link href="/ustoz-ai/testlarim"><BookMarked className="h-4 w-4" aria-hidden />Mening testlarim</Link></Button>
      </div>
      <QueryView q={q}>
        {(rows) => rows.length === 0 ? (
          <EmptyState icon={FileText} title="Hali fayl yuklanmagan" text="Yuqoridagi kartaga test yoki material faylini tashlang: savollar ajratiladi va tekshiriladi." />
        ) : (
          <ul className="space-y-3">
            {rows.map((s) => (
              <li key={s.id}>
                <Card className="flex flex-wrap items-center gap-3 p-4">
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"><FileText className="h-5 w-5" aria-hidden /></span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-bold">{s.title}</p>
                    <p className="text-sm text-muted-foreground">{s.files} ta fayl · {s.questions} ta savol · {dateText(s.createdAt)}{s.label && ACTIVE.includes(s.status) ? ` · ${s.label}` : ""}</p>
                  </div>
                  <Badge variant={TONE[s.status] ?? "blue"}>{STATUS_LABEL[s.status] ?? s.status}</Badge>
                  <Button asChild size="sm"><Link href={`/ustoz-ai/import/${s.id}`}>{ACTIVE.includes(s.status) || s.status === "UPLOADED" ? "Davom ettirish" : "Ochish"}</Link></Button>
                  <Button variant="ghost" size="icon" aria-label={`${s.title} importini o'chirish`} disabled={ACTIVE.includes(s.status)} loading={deleting === s.id} onClick={() => void remove(s)}><Trash2 className="h-4 w-4" aria-hidden /></Button>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </QueryView>
    </div>
  );
}
