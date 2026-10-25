"use client";
import * as React from "react";
import { BookMarked, CheckCheck, ChevronLeft, ChevronRight, KeyRound, RefreshCw } from "lucide-react";
import { api } from "@/lib/admin-client";
import { useQuery } from "@/lib/use-query";
import type { QuestionDetail, QuestionList, SessionView } from "@/lib/import-client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select } from "@/components/ui/form";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import { EvidencePanel } from "./evidence-panel";
import { FilePreview } from "./file-preview";
import { QuestionCard } from "./question-card";
import { SaveDialog } from "./save-dialog";

type Filter = "all" | "ready" | "review" | "noanswer" | "conflict" | "approved" | "removed";
type Pane = "questions" | "evidence" | "file";

function Stat({ label, value, tone }: { label: string; value: number; tone?: string }) {
  return <div className="rounded-xl border border-border bg-card px-3 py-2"><p className={cn("text-xl font-extrabold leading-none", tone)}>{value}</p><p className="mt-1 text-xs text-muted-foreground">{label}</p></div>;
}

/**
 * Tekshiruv markazi: xulosa, filtrlar, 3 ustunli ish maydoni (asl fayl / savollar / AI natijasi va manbalar). Mobilda bo'limlar bo'yicha almashtiriladi.
 * `locked` — import hali ishlayotgan paytda (qisman natijalar ko'rinadi, lekin tahrirlash o'chiq).
 */
export function ReviewCenter({ session, locked, onSessionChanged }: { session: SessionView; locked: boolean; onSessionChanged: () => void }) {
  const toast = useToast();
  const c = session.counts;
  const [filter, setFilter] = React.useState<Filter>("all");
  const [page, setPage] = React.useState(1);
  const [selected, setSelected] = React.useState<string | null>(null);
  const [pane, setPane] = React.useState<Pane>("questions");
  const [fileId, setFileId] = React.useState<string | null>(null);
  const [detailTick, setDetailTick] = React.useState(0);
  const [saveOpen, setSaveOpen] = React.useState(false);
  const [bulk, setBulk] = React.useState(false);
  const [keying, setKeying] = React.useState(false);
  const [rechecking, setRechecking] = React.useState(false);
  const [section, setSection] = React.useState("");
  const [pageOverride, setPageOverride] = React.useState<string | null>(null);
  const kinds = React.useMemo(() => Object.fromEntries(session.files.map((f) => [f.id, f.kind])), [session.files]);

  const list = useQuery<QuestionList>(`/api/import/${session.id}/questions?filter=${filter}&page=${page}${section ? `&section=${section}` : ""}`);
  const detail = useQuery<QuestionDetail>(selected ? `/api/import/${session.id}/questions/${selected}?t=${detailTick}` : null);
  const items = React.useMemo(() => list.data?.items ?? [], [list.data]);

  // Tanlangan savol ro'yxatda bo'lmasa (filtr o'zgardi, qaror qabul qilindi) birinchisi tanlanadi.
  React.useEffect(() => { if (!items.length) { if (selected) setSelected(null); return; } if (!selected || !items.some((x) => x.id === selected)) setSelected(items[0].id); }, [items, selected]);
  // Ishlov tugagach ro'yxat yangilanadi.
  const wasLocked = React.useRef(locked);
  const reloadList = list.reload;
  React.useEffect(() => { if (wasLocked.current && !locked) { reloadList(); setDetailTick((t) => t + 1); } wasLocked.current = locked; }, [locked, reloadList]);
  const det = detail.data && detail.data.id === selected ? detail.data : null;

  const sel = items.find((x) => x.id === selected) ?? null;
  // Foydalanuvchi «Asl fayl» ro'yxatidan tanlagan fayl (fileId) birinchi o'rinda: avval tanlangan savolning fayli har doim ustun kelib, ikkinchi fayl ochilmasdi.
  const selFile = fileId ?? sel?.fileId ?? session.files[0]?.id ?? null;
  // Savolning sahifasi faqat o'sha savolning o'z faylida ko'rsatiladi (boshqa faylga o'tilganda sahifa raqami olinmaydi).
  const previewPage = selFile && selFile === sel?.fileId ? pageOverride ?? sel?.sourcePage ?? null : null;

  const changed = (opts?: { advance?: boolean; detail?: boolean }) => {
    if (opts?.advance) {
      const i = items.findIndex((x) => x.id === selected);
      const next = items[i + 1] ?? items[i - 1];
      if (next) setSelected(next.id);
    }
    if (opts?.detail) setDetailTick((t) => t + 1);
    list.reload(); onSessionChanged();
  };

  const confirmReady = async () => {
    setBulk(true);
    const r = await api<{ confirmed: number }>(`/api/import/${session.id}/questions/confirm-ready`, "POST");
    setBulk(false);
    if (!r.ok) { toast("error", r.error); return; }
    toast("success", r.data.confirmed ? `${r.data.confirmed} ta tayyor savol qabul qilindi.` : "Qabul qilinadigan tayyor savol qolmadi.");
    changed();
  };
  /** Javoblar kaliti savol raqamiga qarab moslashgan: kalitdagi javoblar birdan «To'g'ri» deb belgilanadi (ziddiyatli va noaniq savollar o'tkazib yuboriladi). */
  const confirmKey = async () => {
    if (!window.confirm(`Fayldagi javoblar kaliti savol raqamiga qarab ${c.withKey} ta savolga moslashgan. Kalitdagi javoblar «To'g'ri» deb belgilanadi; ziddiyatli yoki noaniq o'qilgan savollar o'tkazib yuboriladi. Davom etamizmi?`)) return;
    setKeying(true);
    const r = await api<{ confirmed: number; skipped: { conflict: number; uncertain: number; unsupported: number; other: number }; total: number }>(`/api/import/${session.id}/questions/confirm-key`, "POST");
    setKeying(false);
    if (!r.ok) { toast("error", r.error); return; }
    const sk = r.data.skipped, skippedN = sk.conflict + sk.uncertain + sk.unsupported + sk.other;
    toast(r.data.confirmed ? "success" : "info", r.data.confirmed
      ? `${r.data.confirmed} ta savolning javobi kalit bo'yicha belgilandi.${skippedN ? ` ${skippedN} tasi o'tkazib yuborildi (ziddiyat yoki noaniq): ularni o'zingiz ko'rib chiqing.` : ""}`
      : "Kalit bo'yicha belgilanadigan savol qolmadi (hammasi qaror qilingan yoki ko'rib chiqishni talab qiladi).");
    changed();
  };
  const recheckAll = async () => {
    setRechecking(true);
    const r = await api(`/api/import/${session.id}/recheck`, "POST");
    setRechecking(false);
    if (!r.ok) { toast("error", r.error); return; }
    toast("info", "Qayta tekshirish boshlandi.");
    onSessionChanged();
  };

  const setF = (f: Filter) => { setFilter(f); setPage(1); setSelected(null); };
  const pickSection = (v: string) => { setSection(v); setPage(1); setSelected(null); };
  const openPage = (p: number | null) => { if (p) { setFileId(null); setPageOverride(`${p}`); setPane("file"); } };
  // Boshqa savol tanlansa, ko'rsatiladigan fayl ham shu savolning fayliga qaytadi.
  React.useEffect(() => { setPageOverride(null); setFileId(null); }, [selected]);
  const tabs: { key: Filter; label: string; n: number }[] = [
    { key: "all", label: "Hammasi", n: c.total - c.removed }, { key: "ready", label: "Tayyor", n: c.ready }, { key: "review", label: "Tekshirish kerak", n: c.review },
    { key: "noanswer", label: "Javobi topilmagan", n: c.noAnswer }, { key: "conflict", label: "Ziddiyatli", n: c.conflict }, { key: "approved", label: "Tasdiqlangan", n: c.approved },
  ];

  if (c.total === 0) {
    return (
      <EmptyState title="Savol topilmadi" text={session.files.some((f) => f.parseError) ? "Fayl o'qilmadi yoki undan savol ajratib bo'lmadi. Fayl holatidagi izohga qarang." : "Bu fayllardan savol ajratilmadi. Savollar va variantlar aniq ko'rinadigan fayl yuklab ko'ring."} />
    );
  }

  return (
    <section aria-labelledby="review-title" className="space-y-4">
      <div>
        <h2 id="review-title" className="text-2xl font-extrabold tracking-tight">Savollaringiz tayyor. Keling, tekshirib chiqamiz.</h2>
        <p className="mt-1 text-sm text-muted-foreground">Hech narsa avtomatik tasdiqlanmaydi: har bir javobni siz ko'rib chiqasiz. Tasdiqlangan savollar faqat sizning shaxsiy testingizga saqlanadi.</p>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        <Stat label="Jami savol" value={c.total - c.removed} />
        <Stat label="Tayyor" value={c.ready} tone="text-success" />
        <Stat label="Tekshirish kerak" value={c.review} tone="text-amber" />
        <Stat label="Javobi topilmagan" value={c.noAnswer} tone="text-danger" />
        <Stat label="Ziddiyatli" value={c.conflict} tone="text-danger" />
        <Stat label="Tasdiqlangan" value={c.approved} tone="text-primary" />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button disabled={locked || c.approved === 0} onClick={() => setSaveOpen(true)}><BookMarked className="h-4 w-4" aria-hidden />Testga saqlash{c.approved > 0 ? ` (${c.approved})` : ""}</Button>
        <Button variant="outline" disabled={locked || c.ready === 0} loading={bulk} onClick={confirmReady}><CheckCheck className="h-4 w-4" aria-hidden />Tayyorlarini qabul qilish</Button>
        {c.withKey > 0 && <Button variant="outline" disabled={locked} loading={keying} onClick={confirmKey}><KeyRound className="h-4 w-4" aria-hidden />Kalit bo&apos;yicha belgilash ({c.withKey})</Button>}
        <Button variant="ghost" disabled={locked} loading={rechecking} onClick={recheckAll}><RefreshCw className="h-4 w-4" aria-hidden />Hammasini qayta tekshirish</Button>
        {c.removed > 0 && <Button variant="ghost" size="sm" onClick={() => setF(filter === "removed" ? "all" : "removed")}>{filter === "removed" ? "Hammasiga qaytish" : `Olib tashlanganlar (${c.removed})`}</Button>}
      </div>

      {session.groups.length > 1 && (
        <label className="flex flex-wrap items-center gap-2 text-sm">
          <span className="font-semibold">Test:</span>
          <Select value={section} onChange={(e) => pickSection(e.target.value)} className="h-9 w-full max-w-md text-sm" aria-label="Testni tanlang">
            <option value="">Hammasi ({session.groups.reduce((a, g) => a + g.count, 0)} ta savol, {session.groups.length} ta test)</option>
            {session.groups.map((g) => <option key={g.section} value={g.section}>{g.title} ({g.count})</option>)}
          </Select>
        </label>
      )}

      <div role="tablist" aria-label="Savollar filtri" className="flex gap-1.5 overflow-x-auto pb-1">
        {tabs.map((t) => (
          <button key={t.key} role="tab" aria-selected={filter === t.key} onClick={() => setF(t.key)}
            className={cn("shrink-0 whitespace-nowrap rounded-full border px-3.5 py-1.5 text-sm font-semibold transition-colors", filter === t.key ? "border-primary bg-primary text-white" : "border-border bg-card hover:bg-muted")}>
            {t.label} <span className={cn("ml-1 text-xs", filter === t.key ? "text-white/80" : "text-muted-foreground")}>{t.n}</span>
          </button>
        ))}
      </div>

      <div className="flex gap-1 rounded-xl bg-muted p-1 lg:hidden" role="tablist" aria-label="Ko'rinish">
        {([["questions", "Savollar"], ["evidence", "Javob dalili"], ["file", "Asl fayl"]] as const).map(([k, l]) => (
          <button key={k} role="tab" aria-selected={pane === k} onClick={() => setPane(k)} className={cn("flex-1 rounded-lg px-2 py-1.5 text-sm font-semibold", pane === k ? "bg-card shadow-soft" : "text-muted-foreground")}>{l}</button>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,280px)_minmax(0,1fr)_minmax(0,340px)] lg:items-start">
        <Card className={cn("p-4 lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto", pane !== "file" && "hidden lg:block")}>
          <FilePreview sessionId={session.id} files={session.files} fileId={selFile} page={previewPage} onPickFile={setFileId} />
        </Card>

        <div className={cn("min-w-0", pane !== "questions" && "hidden lg:block")}>
          {list.loading && !list.data ? <div className="space-y-2" aria-busy="true"><Skeleton className="h-16" /><Skeleton className="h-16" /><Skeleton className="h-16" /></div>
            : list.error ? <ErrorState text={list.error} onRetry={list.reload} />
            : items.length === 0 ? <EmptyState title="Bu bo'limda savol yo'q" text="Boshqa filtrni tanlang." />
            : (
              <>
                <ul className="space-y-2.5">
                  {items.map((q) => <QuestionCard key={q.id} sessionId={session.id} q={q} selected={q.id === selected} locked={locked} fileKind={q.fileId ? kinds[q.fileId] ?? null : null} onSelect={() => { setSelected(q.id); setPane("questions"); }} onChanged={changed} onOpenPage={openPage} />)}
                </ul>
                {(list.data?.pages ?? 1) > 1 && (
                  <nav className="mt-4 flex items-center justify-center gap-3" aria-label="Sahifalar">
                    <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}><ChevronLeft className="h-4 w-4" aria-hidden />Oldingi</Button>
                    <span className="text-sm text-muted-foreground">{page} / {list.data?.pages}</span>
                    <Button variant="outline" size="sm" disabled={page >= (list.data?.pages ?? 1)} onClick={() => setPage((p) => p + 1)}>Keyingi<ChevronRight className="h-4 w-4" aria-hidden /></Button>
                  </nav>
                )}
              </>
            )}
          {locked && <p role="status" className="mt-3"><Badge variant="amber">Jarayon tugaguncha tahrirlash o'chiq</Badge></p>}
        </div>

        <Card className={cn("p-4 lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto", pane !== "evidence" && "hidden lg:block")}>
          <EvidencePanel detail={selected ? det : null} loading={detail.loading || (!!selected && !det && !detail.error)} error={detail.error} />
        </Card>
      </div>

      <SaveDialog open={saveOpen} onOpenChange={setSaveOpen} sessionId={session.id} defaultTitle={session.title} approved={c.approved} onSaved={() => { list.reload(); onSessionChanged(); }} />
    </section>
  );
}
