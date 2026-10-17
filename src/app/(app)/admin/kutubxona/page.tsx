"use client";
import * as React from "react";
import { Check, Trash2, X } from "lucide-react";
import { adminModule } from "@/lib/modules";
import { api } from "@/lib/admin-client";
import { useQuery } from "@/lib/use-query";
import { mb, VIS, type LibDoc } from "@/components/bilimxona/types";
import { QueryView } from "@/components/layout/query-view";
import { PageHeader } from "@/components/layout/page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select } from "@/components/ui/form";
import { EmptyState } from "@/components/ui/states";
import { Table, Td, Th } from "@/components/ui/table";
import { useToast } from "@/components/ui/toast";

export default function Page() {
  const toast = useToast();
  const [vis, setVis] = React.useState("PUBLIC_PENDING");
  const q = useQuery<{ docs: LibDoc[] }>(`/api/admin/library?visibility=${vis}`);
  const [busy, setBusy] = React.useState("");
  const act = async (d: LibDoc, action: "approve" | "reject") => {
    setBusy(d.id); const r = await api(`/api/admin/library/${d.id}`, "PATCH", { action }); setBusy("");
    if (!r.ok) { toast("error", r.error); return; }
    toast("success", action === "approve" ? "Hujjat ommaviy qilindi." : "Rad etildi: hujjat shaxsiy qoldi."); q.reload();
  };
  const remove = async (d: LibDoc) => {
    if (!window.confirm(`«${d.title}» butunlay o'chirilsinmi (fayl bilan)?`)) return;
    const r = await api(`/api/admin/library/${d.id}`, "DELETE"); if (!r.ok) toast("error", r.error); else { toast("success", "O'chirildi."); q.reload(); }
  };
  return (
    <>
      <PageHeader module={adminModule} title="Kutubxona" description="Ommaviy qilish so'rovlarini tekshiring. Tasdiqlangan hujjat hamma uchun ko'rinadi" />
      <Card>
        <div className="p-4"><Select className="w-56" value={vis} onChange={(e) => setVis(e.target.value)} aria-label="Ko'rinish"><option value="PUBLIC_PENDING">Tekshiruvda</option><option value="PUBLIC">Ommaviy</option><option value="PRIVATE">Shaxsiy</option></Select></div>
        <QueryView q={q}>{(d) => d.docs.length === 0 ? <div className="p-4 pt-0"><EmptyState title="Hujjat yo'q" text={vis === "PUBLIC_PENDING" ? "Tekshiruvni kutayotgan hujjat yo'q." : "Bu holatda hujjat yo'q."} /></div> : (
          <Table><thead><tr><Th>Hujjat</Th><Th>Egasi</Th><Th>Hajm</Th><Th>Ko'rinish</Th><Th><span className="sr-only">Amallar</span></Th></tr></thead><tbody>
            {d.docs.map((x) => (
              <tr key={x.id}>
                <Td className="font-semibold">{x.title}<p className="text-xs font-normal text-muted-foreground">{x.type} · {x.fileName}{x.subject ? ` · ${x.subject}` : ""}</p></Td>
                <Td>{x.owner ?? "—"}</Td><Td className="whitespace-nowrap">{mb(x.sizeBytes)}</Td>
                <Td><Badge variant={x.visibility === "PUBLIC" ? "teal" : x.visibility === "PUBLIC_PENDING" ? "amber" : "neutral"}>{VIS[x.visibility]}</Badge></Td>
                <Td className="whitespace-nowrap text-right">
                  {x.visibility === "PUBLIC_PENDING" && <><Button size="sm" variant="success" loading={busy === x.id} onClick={() => act(x, "approve")}><Check className="h-4 w-4" />Tasdiqlash</Button>{" "}<Button size="sm" variant="outline" onClick={() => act(x, "reject")}><X className="h-4 w-4" />Rad etish</Button></>}
                  <Button size="sm" variant="ghost" aria-label="O'chirish" onClick={() => remove(x)}><Trash2 className="h-4 w-4 text-danger" /></Button>
                </Td>
              </tr>))}
          </tbody></Table>)}</QueryView>
      </Card>
    </>
  );
}
