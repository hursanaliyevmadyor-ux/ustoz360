"use client";
import * as React from "react";
import { adminModule } from "@/lib/modules";
import { useQuery } from "@/lib/use-query";
import { QueryView } from "@/components/layout/query-view";
import { PageHeader } from "@/components/layout/page";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/form";
import { EmptyState } from "@/components/ui/states";
import { Table, Td, Th } from "@/components/ui/table";

type Audit = { items: { id: string; action: string; actor: string; meta: Record<string, unknown> | null; createdAt: string }[] };
const ACTION: Record<string, string> = {
  "admin.user_roles": "Rollar o'zgardi", "admin.user_block": "Bloklandi", "admin.user_unblock": "Blokdan chiqarildi", "admin.user_plan": "Tarif berildi", "admin.setting": "Sozlama o'zgardi",
  "admin.ai_test": "AI ulanishi sinaldi", "admin.official_save": "Rasmiy ma'lumot saqlandi", "admin.official_delete": "Rasmiy ma'lumot o'chirildi", "admin.library_approve": "Hujjat ommaviy qilindi", "admin.library_reject": "Hujjat rad etildi",
  "admin.library_delete": "Hujjat o'chirildi", "payment.paid": "To'lov tasdiqlandi", "payment.refunded": "To'lov qaytarildi", "market.approve": "Kurs tasdiqlandi", "market.reject": "Kurs rad etildi", "market.archive": "Kurs arxivlandi",
};
const meta = (m: Record<string, unknown> | null) => (m ? Object.entries(m).map(([k, v]) => `${k}: ${typeof v === "object" ? JSON.stringify(v) : String(v)}`).join(", ").slice(0, 140) : "");

export default function Page() {
  const q = useQuery<Audit>("/api/admin/audit");
  const [term, setTerm] = React.useState("");
  return (
    <>
      <PageHeader module={adminModule} title="Audit jurnali" description="Adminlar qilgan muhim amallar: kim, nima, qachon" />
      <Card>
        <div className="p-4"><Input className="max-w-sm" placeholder="Amal yoki admin bo'yicha qidirish" value={term} onChange={(e) => setTerm(e.target.value)} aria-label="Qidirish" /></div>
        <QueryView q={q}>{(d) => {
          const rows = d.items.filter((r) => `${r.actor} ${ACTION[r.action] ?? r.action}`.toLowerCase().includes(term.toLowerCase()));
          return rows.length === 0 ? <div className="p-4 pt-0"><EmptyState title="Yozuv yo'q" text="Admin amallari shu yerda ko'rinadi." /></div> : (
            <Table><thead><tr><Th>Vaqt</Th><Th>Admin</Th><Th>Amal</Th><Th>Tafsilot</Th></tr></thead><tbody>
              {rows.map((r) => <tr key={r.id}><Td className="whitespace-nowrap">{new Date(r.createdAt).toLocaleString("ru-RU", { dateStyle: "short", timeStyle: "short" })}</Td><Td>{r.actor}</Td><Td className="font-semibold">{ACTION[r.action] ?? r.action}</Td><Td className="max-w-[320px] truncate text-xs text-muted-foreground" title={meta(r.meta)}>{meta(r.meta)}</Td></tr>)}
            </tbody></Table>);
        }}</QueryView>
      </Card>
    </>
  );
}
