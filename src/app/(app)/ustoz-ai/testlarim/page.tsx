"use client";
import Link from "next/link";
import { FileUp, FolderHeart } from "lucide-react";
import { TONES } from "@/lib/choices";
import { useQuery } from "@/lib/use-query";
import { COLLECTION_STATE_LABEL, COLLECTION_STATUS_LABEL, dateText, type CollectionRow } from "@/lib/import-client";
import { QueryView } from "@/components/layout/query-view";
import { SectionHeader } from "@/components/layout/section-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/states";

const STATE_TONE: Record<string, "success" | "blue" | "amber" | "neutral"> = { VERIFIED: "success", TEACHER_CONFIRMED: "blue", PARTIAL: "amber", UNVERIFIED: "amber", EMPTY: "neutral" };

export default function Page() {
  const q = useQuery<CollectionRow[]>("/api/personal-tests");
  return (
    <div className="mx-auto max-w-5xl">
      <SectionHeader title="Mening testlarim" lead="Yuklagan materialingizdan tayyorlangan shaxsiy testlar. Ular faqat sizga ko'rinadi, admin tasdiqlamaguncha umumiy bankka tushmaydi." back={{ href: "/ustoz-ai", label: "USTOZ AI" }} />
      <div className="mb-4 flex flex-wrap gap-2">
        <Button asChild><Link href="/ustoz-ai"><FileUp className="h-4 w-4" aria-hidden />Yangi fayl yuklash</Link></Button>
        <Button asChild variant="outline"><Link href="/ustoz-ai/import">Oldingi yuklashlarim</Link></Button>
      </div>
      <QueryView q={q}>
        {(rows) => rows.length === 0 ? (
          <EmptyState icon={FolderHeart} title="Hali shaxsiy test yo'q" text="Test faylini yuklang, savollarni tekshiring va «Testga saqlash»ni bosing: shu yerda paydo bo'ladi."
            action={<Button asChild><Link href="/ustoz-ai">Fayl yuklash</Link></Button>} />
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {rows.map((c) => (
              <li key={c.id}>
                <Card className="flex h-full flex-col gap-3 p-4">
                  <div className="flex items-start gap-3">
                    <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${TONES.violet}`}><FolderHeart className="h-5 w-5" aria-hidden /></span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-bold">{c.title}</p>
                      <p className="text-sm text-muted-foreground">{c.counts.total} ta savol · {dateText(c.updatedAt)}{c.subject ? ` · ${c.subject}` : ""}</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <Badge variant={STATE_TONE[c.state] ?? "neutral"}>{COLLECTION_STATE_LABEL[c.state] ?? c.state}</Badge>
                    <Badge variant={c.status === "PUBLIC_APPROVED" ? "success" : c.status === "SUBMITTED_TO_ADMIN" ? "amber" : "neutral"}>{COLLECTION_STATUS_LABEL[c.status] ?? c.status}</Badge>
                    {c.counts.unverified > 0 && <Badge variant="amber">{c.counts.unverified} ta tasdiqlanmagan</Badge>}
                  </div>
                  {c.submission?.notes && <p className="rounded-xl bg-muted px-3 py-2 text-xs text-muted-foreground">Admin izohi: {c.submission.notes}</p>}
                  <div className="mt-auto"><Button asChild size="sm"><Link href={`/ustoz-ai/testlarim/${c.id}`}>Ochish</Link></Button></div>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </QueryView>
    </div>
  );
}
