"use client";
import * as React from "react";
import { ExternalLink, HelpCircle, Quote, ShieldCheck } from "lucide-react";
import { EVIDENCE_LABEL, ORIGIN_LABEL, type EvidenceItem, type QuestionDetail } from "@/lib/import-client";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/states";
import { NOT_VERIFIED } from "./question-card";

const STATUS_TEXT: Record<string, { label: string; tone: "success" | "amber" | "danger" | "neutral" | "blue" }> = {
  CONFIRMED: { label: "Mustaqil tasdiqlangan", tone: "success" }, USER_CONFIRMED: { label: "O'qituvchi tasdiqlagan", tone: "blue" }, PROPOSED: { label: "AI taklif qildi", tone: "amber" },
  CONFLICT: { label: "Ziddiyatli", tone: "danger" }, NOT_FOUND: { label: "Javob topilmadi", tone: "danger" }, UNVERIFIED: { label: "Tekshirilmagan", tone: "neutral" },
};
const CONF: Record<string, string> = { HIGH: "Yuqori", MEDIUM: "O'rtacha", LOW: "Past" };
const safeUrl = (u?: string) => (u && /^https?:\/\//i.test(u) ? u : null);
const join = (a: string[] | null) => (a && a.length ? a.join(", ") : "—");

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return <div className="flex items-start justify-between gap-3 py-1.5 text-sm"><dt className="text-muted-foreground">{k}</dt><dd className="max-w-[60%] text-right font-semibold">{v}</dd></div>;
}

function Evidence({ e }: { e: EvidenceItem }) {
  const url = safeUrl(e.url);
  return (
    <li className="rounded-xl border border-border bg-card p-3 text-sm">
      <div className="flex flex-wrap items-center gap-1.5">
        <Badge variant={e.type === "WEB" ? "amber" : e.type === "HUB" || e.type === "LIBRARY" ? "teal" : "neutral"}>{EVIDENCE_LABEL[e.type] ?? e.type}</Badge>
        {e.page && <span className="text-xs text-muted-foreground">{e.page}</span>}
        {e.trust && <span className="text-xs text-muted-foreground">· ishonch: {e.trust}</span>}
      </div>
      <p className="mt-1.5 font-semibold">{e.title}</p>
      {e.quote && <blockquote className="mt-1.5 flex gap-1.5 border-l-2 border-primary/40 pl-2.5 text-xs text-muted-foreground"><Quote className="mt-0.5 h-3 w-3 shrink-0" aria-hidden /><span>{e.quote}</span></blockquote>}
      {e.note && <p className="mt-1.5 text-xs text-muted-foreground">{e.note}</p>}
      {url && <a href={url} target="_blank" rel="noopener noreferrer" className="mt-1.5 inline-flex items-center gap-1 break-all text-xs font-semibold text-primary hover:underline"><ExternalLink className="h-3 w-3 shrink-0" aria-hidden />{url.replace(/^https?:\/\//, "").slice(0, 70)}</a>}
    </li>
  );
}

/** «Javobni qanday aniqladik?»: faqat haqiqatan topilgan manbalar. Manba yo'q bo'lsa, o'ylab topilmaydi — halol xabar ko'rsatiladi. */
export function EvidencePanel({ detail, loading, error }: { detail: QuestionDetail | null; loading: boolean; error: string | null }) {
  if (loading && !detail) return <div className="space-y-2" aria-busy="true"><Skeleton className="h-6 w-2/3" /><Skeleton className="h-28" /><Skeleton className="h-20" /></div>;
  if (error) return <p role="alert" className="text-sm text-danger">{error}</p>;
  if (!detail) return <p className="flex items-center gap-2 text-sm text-muted-foreground"><HelpCircle className="h-4 w-4" aria-hidden />Savolni tanlang — javob qanday aniqlangani shu yerda ko'rinadi.</p>;
  const a = detail.answer;
  const st = STATUS_TEXT[a.status] ?? STATUS_TEXT.UNVERIFIED;
  const noAnswer = !a.final?.length && !a.proposed?.length && !a.key?.length;
  return (
    <div className="space-y-3">
      <h3 className="flex items-center gap-2 text-base font-bold"><ShieldCheck className="h-5 w-5 text-teal" aria-hidden />Javobni qanday aniqladik?</h3>
      <div className="flex flex-wrap items-center gap-2"><Badge variant={st.tone}>{st.label}</Badge>{a.confidence && <span className="text-xs text-muted-foreground">Ishonch: {CONF[a.confidence] ?? a.confidence}</span>}</div>
      <dl className="divide-y divide-border rounded-xl border border-border bg-card px-3">
        <Row k="Fayldagi kalit" v={a.key?.length ? `${join(a.key)}${a.keySource === "SEPARATE_FILE" ? " (alohida fayl)" : ""}` : "yo'q"} />
        <Row k="AI / manba taklifi" v={join(a.proposed)} />
        <Row k="Siz tanlagan" v={join(a.final)} />
        <Row k="Aniqlash usuli" v={ORIGIN_LABEL[a.origin] ?? a.origin} />
      </dl>
      {noAnswer && <p role="status" className="rounded-xl bg-danger/10 px-3 py-2 text-sm font-semibold text-danger">{NOT_VERIFIED}</p>}
      {a.status === "CONFLICT" && <p className="rounded-xl bg-danger/10 px-3 py-2 text-sm">Fayldagi javob va mustaqil tekshiruv bir-biriga mos kelmadi. Fayldagi kalit hech qachon avtomatik to'g'ri hisoblanmaydi.</p>}
      {a.note && <p className="text-xs text-muted-foreground">{a.note}</p>}
      {a.explanation && <div><p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Izoh</p><p className="mt-1 whitespace-pre-wrap text-sm">{a.explanation}</p></div>}
      <div>
        <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-muted-foreground">Manbalar</p>
        {detail.evidence.length ? <ul className="space-y-2">{detail.evidence.map((e, i) => <Evidence key={i} e={e} />)}</ul> : <p className="rounded-xl bg-muted px-3 py-2 text-sm text-muted-foreground">Bu savol uchun manba topilmadi. Manba o'ylab topilmaydi — javobni o'zingiz tekshiring.</p>}
      </div>
      {a.verifiedAt && <p className="text-xs text-muted-foreground">Oxirgi tekshiruv: {new Date(a.verifiedAt).toLocaleString("uz-UZ")}</p>}
    </div>
  );
}
