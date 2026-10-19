"use client";
import * as React from "react";
import { adminModule } from "@/lib/modules";
import { useQuery } from "@/lib/use-query";
import { EntriesTab, OverviewTab, ProvidersTab, ReviewTab, type Overview, type Providers } from "@/components/admin/knowledge";
import { PageHeader } from "@/components/layout/page";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

/**
 * AI Bilim markazi: admin panel ichidagi alohida bo'lim. Tasdiqlangan bilimlar, tekshiruv kutayotgan javoblar, provayderlar va ehtiyojlar.
 * Hamma amal admin huquqi bilan va audit jurnaliga yoziladi. Hujjat: docs/KNOWLEDGE-HUB.md
 */
export default function Page() {
  const q = useQuery<{ overview: Overview; providers: Providers }>("/api/admin/knowledge");
  const [tab, setTab] = React.useState("overview");
  const pending = q.data?.overview.available ? q.data.overview.counts.pending + q.data.overview.counts.needsSource : 0;
  return (
    <>
      <PageHeader module={adminModule} title="AI Bilim markazi" description="Tekshirilgan javoblar bazasi: AI uni birinchi ishlatadi, ehtiyojlar shaxssiz o'rganiladi" />
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="overview">Holat</TabsTrigger>
          <TabsTrigger value="review">Tekshiruv {pending > 0 && <Badge variant="amber" className="ml-1">{pending}</Badge>}</TabsTrigger>
          <TabsTrigger value="entries">Bilimlar</TabsTrigger>
          <TabsTrigger value="providers">Provayderlar</TabsTrigger>
        </TabsList>
        <TabsContent value="overview"><OverviewTab q={q} providers={q.data?.providers ?? null} go={setTab} /></TabsContent>
        <TabsContent value="review"><ReviewTab onChanged={q.reload} /></TabsContent>
        <TabsContent value="entries"><EntriesTab onChanged={q.reload} /></TabsContent>
        <TabsContent value="providers"><ProvidersTab providers={q.data?.providers ?? null} onChanged={q.reload} /></TabsContent>
      </Tabs>
    </>
  );
}
