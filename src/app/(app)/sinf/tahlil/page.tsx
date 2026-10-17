"use client";
import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Pencil, Trash2 } from "lucide-react";
import { modules } from "@/lib/modules";
import { api } from "@/lib/admin-client";
import { useQuery } from "@/lib/use-query";
import { AnalysisPanel, ComparePanel, ResultsPanel, StudentsPanel, type Detail } from "@/components/sinf/class-view";
import { QueryView } from "@/components/layout/query-view";
import { PageHeader } from "@/components/layout/page";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/form";
import { EmptyState, Skeleton } from "@/components/ui/states";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/toast";
import { ClassDialog } from "@/components/sinf/class-dialog";
import type { listClasses } from "@/server/sinf";

const VIEWS = ["natijalar", "tahlil", "taqqoslash", "oquvchilar"] as const;

function Inner() {
  const router = useRouter(); const sp = useSearchParams(); const toast = useToast();
  const classes = useQuery<Awaited<ReturnType<typeof listClasses>>>("/api/sinf");
  const wanted = sp.get("classId");
  const first = classes.data?.classes[0]?.id ?? null;
  const classId = wanted && classes.data?.classes.some((c) => c.id === wanted) ? wanted : first;
  const detail = useQuery<Detail>(classId ? `/api/sinf/${classId}` : null);
  const view = (VIEWS as readonly string[]).includes(sp.get("view") ?? "") ? sp.get("view")! : "natijalar";
  const go = (next: { classId?: string; view?: string }) => router.replace(`/sinf/tahlil?${new URLSearchParams({ classId: next.classId ?? classId ?? "", view: next.view ?? view })}`, { scroll: false });
  const [edit, setEdit] = React.useState(false);

  const remove = async () => {
    if (!detail.data || !window.confirm(`«${detail.data.name}» sinfi, o'quvchilari va natijalari o'chiriladi. Davom etasizmi?`)) return;
    const r = await api(`/api/sinf/${detail.data.id}`, "DELETE");
    if (!r.ok) { toast("error", r.error); return; }
    toast("success", "Sinf o'chirildi."); router.replace("/sinf");
  };

  return (
    <>
      <PageHeader module={modules[4]} title="Tahlil va natijalar" description="Natijalarni kiriting, mavzular bo'yicha tahlil va oldin/keyin taqqoslashni ko'ring" />
      <QueryView q={classes}>{(c) => c.classes.length === 0 ? (
        <EmptyState title="Hali sinf yo'q" text="Avval sinf yarating." action={<Button asChild><Link href="/sinf">Sinflarga o'tish</Link></Button>} />
      ) : (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center gap-3">
            <Select className="w-64" value={classId ?? ""} onChange={(e) => go({ classId: e.target.value })} aria-label="Sinf">{c.classes.map((x) => <option key={x.id} value={x.id}>{x.name} · {x.subject}</option>)}</Select>
            <Button variant="outline" size="sm" onClick={() => setEdit(true)} disabled={!detail.data}><Pencil className="h-4 w-4" />Sinfni tahrirlash</Button>
            <Button variant="ghost" size="sm" onClick={remove} disabled={!detail.data}><Trash2 className="h-4 w-4 text-danger" />O'chirish</Button>
          </div>
          <QueryView q={detail} skeleton={<Skeleton className="h-64 w-full" />}>{(d) => (
            <Tabs value={view} onValueChange={(v) => go({ view: v })}>
              <TabsList className="flex-wrap"><TabsTrigger value="natijalar">Natijalar</TabsTrigger><TabsTrigger value="tahlil">Tahlil</TabsTrigger><TabsTrigger value="taqqoslash">Oldin / keyin</TabsTrigger><TabsTrigger value="oquvchilar">O'quvchilar</TabsTrigger></TabsList>
              <TabsContent value="natijalar"><ResultsPanel d={d} q={detail} /></TabsContent>
              <TabsContent value="tahlil"><AnalysisPanel d={d} /></TabsContent>
              <TabsContent value="taqqoslash"><ComparePanel d={d} /></TabsContent>
              <TabsContent value="oquvchilar"><StudentsPanel d={d} q={detail} /></TabsContent>
            </Tabs>)}</QueryView>
          {edit && detail.data && <ClassDialog id={detail.data.id} initial={{ name: detail.data.name, subject: detail.data.subject, grade: detail.data.grade }} onClose={() => setEdit(false)} onSaved={() => { setEdit(false); detail.reload(); classes.reload(); }} />}
        </div>)}</QueryView>
    </>
  );
}

export default function Page() {
  return <React.Suspense fallback={<Skeleton className="h-96 w-full" />}><Inner /></React.Suspense>;
}
