"use client";
import * as React from "react";
import Link from "next/link";
import { FileText, Globe, MessageSquare, Search, Star, Trash2, Download } from "lucide-react";
import { modules } from "@/lib/modules";
import { api } from "@/lib/admin-client";
import { cn } from "@/lib/utils";
import { useQuery } from "@/lib/use-query";
import { mb, VIS, type LibDoc, type LibList } from "@/components/bilimxona/types";
import { QueryView } from "@/components/layout/query-view";
import { PageHeader } from "@/components/layout/page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/form";
import { EmptyState } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";

const SCOPES = [["", "Hammasi"], ["mine", "Mening"], ["favorites", "Sevimli"]] as const;

export default function Page() {
  const toast = useToast();
  const [q, setQ] = React.useState(""); const [term, setTerm] = React.useState(""); const [subject, setSubject] = React.useState(""); const [scope, setScope] = React.useState(""); const [page, setPage] = React.useState(1);
  React.useEffect(() => { const t = setTimeout(() => { setTerm(q.trim()); setPage(1); }, 350); return () => clearTimeout(t); }, [q]);
  const list = useQuery<LibList>(`/api/library?${new URLSearchParams({ ...(term && { q: term }), ...(subject && { subject }), ...(scope && { scope }), page: String(page) })}`);
  const [busy, setBusy] = React.useState("");

  const open = async (d: LibDoc) => {
    setBusy(d.id); const r = await api<{ url: string }>(`/api/library/${d.id}/download`); setBusy("");
    if (!r.ok) { toast("error", r.error); return; }
    window.open(r.data.url, "_blank", "noopener,noreferrer");
  };
  const fav = async (d: LibDoc) => { const r = await api(`/api/library/${d.id}/favorite`, "POST"); if (!r.ok) toast("error", r.error); else list.reload(); };
  const publish = async (d: LibDoc) => {
    if (!window.confirm("Hujjat administrator tekshiruvidan so'ng hamma uchun ko'rinadi. So'rov yuboraylikmi?")) return;
    const r = await api(`/api/library/${d.id}/publish`, "POST"); if (!r.ok) toast("error", r.error); else { toast("success", "So'rov yuborildi."); list.reload(); }
  };
  const remove = async (d: LibDoc) => {
    if (!window.confirm(`«${d.title}» o'chirilsinmi? Fayl ham o'chadi.`)) return;
    const r = await api(`/api/library/${d.id}`, "DELETE"); if (!r.ok) toast("error", r.error); else { toast("success", "O'chirildi."); list.reload(); }
  };

  return (
    <>
      <PageHeader module={modules[5]} title="BILIMXONA" description="Elektron kutubxona: hujjatlaringiz va tasdiqlangan ommaviy materiallar"
        actions={<><Button asChild variant="outline"><Link href="/bilimxona/suhbat"><MessageSquare className="h-4 w-4" />Hujjat bilan suhbat</Link></Button><Button asChild><Link href="/bilimxona/yuklash">Fayl yuklash</Link></Button></>} />
      <div className="mb-5 grid gap-3 sm:grid-cols-[1fr_200px_auto]">
        <div className="relative"><Search className="absolute left-3.5 top-3.5 h-4 w-4 text-muted-foreground" aria-hidden /><Input className="pl-10" placeholder="Nomi yoki teg bo'yicha qidirish" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Kutubxonadan qidirish" /></div>
        <Select value={subject} onChange={(e) => { setSubject(e.target.value); setPage(1); }} aria-label="Fan"><option value="">Barcha fanlar</option>{(list.data?.subjects ?? []).map((s) => <option key={s}>{s}</option>)}</Select>
        <div className="flex gap-1 rounded-xl bg-muted p-1" role="group" aria-label="Ko'rinish">{SCOPES.map(([k, l]) => <button key={k} onClick={() => { setScope(k); setPage(1); }} aria-pressed={scope === k} className={cn("min-h-9 rounded-lg px-3 text-sm font-semibold", scope === k ? "bg-card shadow-soft" : "text-muted-foreground")}>{l}</button>)}</div>
      </div>
      <QueryView q={list}>{(d) => (
        <>
          {!d.storage.configured && <p className="mb-4 rounded-xl bg-amber/10 px-3.5 py-2.5 text-sm">{d.storage.note} Mavjud hujjatlarni ko'rish va qidirish ishlaydi.</p>}
          {d.docs.length === 0 ? (
            <EmptyState icon={FileText} title={term || subject || scope ? "Hujjat topilmadi" : "Kutubxona bo'sh"} text={term || subject || scope ? "Qidiruv yoki filtrni o'zgartirib ko'ring." : "PDF, DOCX yoki TXT fayl yuklang: u faqat sizga ko'rinadi. Administrator tasdiqlagan ommaviy hujjatlar ham shu yerda paydo bo'ladi."}
              action={d.storage.configured && !term && !subject && !scope ? <Button asChild><Link href="/bilimxona/yuklash">Birinchi faylni yuklash</Link></Button> : undefined} />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{d.docs.map((x) => (
              <Card key={x.id} className="flex flex-col p-5">
                <div className="flex items-start gap-3">
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#4F46E5]/10 text-[#4F46E5]"><FileText className="h-5 w-5" aria-hidden /></span>
                  <div className="min-w-0 flex-1"><p className="truncate font-bold" title={x.title}>{x.title}</p><p className="text-sm text-muted-foreground">{x.type} · {mb(x.sizeBytes)} · {new Date(x.createdAt).toLocaleDateString("ru-RU")}</p></div>
                  <button aria-pressed={x.favorite} aria-label={x.favorite ? "Sevimlilardan olib tashlash" : "Sevimlilarga qo'shish"} className="grid h-11 w-11 shrink-0 place-items-center" onClick={() => fav(x)}><Star className={x.favorite ? "h-5 w-5 fill-amber text-amber" : "h-5 w-5 text-muted-foreground"} /></button>
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  <Badge variant={x.visibility === "PUBLIC" ? "teal" : x.visibility === "PUBLIC_PENDING" ? "amber" : "neutral"}>{x.visibility === "PUBLIC" && <Globe className="h-3 w-3" />}{VIS[x.visibility]}</Badge>
                  <Badge variant={x.status === "READY" ? "success" : "neutral"}>{x.status === "READY" ? "Suhbatga tayyor" : "Indekslanmagan"}</Badge>
                  {x.subject && <Badge variant="blue">{x.subject}</Badge>}{x.tags.slice(0, 3).map((t) => <Badge key={t}>#{t}</Badge>)}
                  {!x.mine && x.owner && <Badge>Muallif: {x.owner}</Badge>}
                </div>
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <Button size="sm" variant="outline" loading={busy === x.id} disabled={!d.storage.configured} onClick={() => open(x)}><Download className="h-4 w-4" />Ochish</Button>
                  {x.status === "READY" && <Button asChild size="sm" variant="outline"><Link href={`/bilimxona/suhbat?doc=${x.id}`}><MessageSquare className="h-4 w-4" />Suhbat</Link></Button>}
                  {x.mine && x.visibility === "PRIVATE" && <Button size="sm" variant="ghost" onClick={() => publish(x)}>Ommaviy qilish</Button>}
                  {x.mine && <Button size="sm" variant="ghost" aria-label="O'chirish" onClick={() => remove(x)}><Trash2 className="h-4 w-4 text-danger" /></Button>}
                </div>
              </Card>))}</div>)}
          {d.pages > 1 && <div className="mt-6 flex items-center justify-center gap-3 text-sm"><Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(page - 1)}>Oldingi</Button><span>{d.page} / {d.pages}</span><Button size="sm" variant="outline" disabled={page >= d.pages} onClick={() => setPage(page + 1)}>Keyingi</Button></div>}
        </>)}</QueryView>
    </>
  );
}
