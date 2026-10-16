"use client";
import * as React from "react";
import Link from "next/link";
import { BookOpen, Receipt } from "lucide-react";
import { SectionHeader } from "@/components/layout/section-header";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/states";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

/** Sotib olingan kurslar va to'lov tarixi bitta bo'limda (ikkalasi ham to'lov tizimi ulangach to'ladi). */
export default function Page() {
  return (
    <div className="mx-auto max-w-6xl">
      <SectionHeader title="Kurslarim va xaridlar" lead="Sotib olingan kurslar, o'qish progressi, cheklar va to'lov tarixi." />
      <Tabs defaultValue="kurslar">
        <TabsList><TabsTrigger value="kurslar">Kurslarim</TabsTrigger><TabsTrigger value="xaridlar">Xaridlar</TabsTrigger></TabsList>
        <TabsContent value="kurslar"><EmptyState icon={BookOpen} title="Hali kurs yo'q" text="Sotib olingan kurslar shu yerda ko'rinadi. Katalogdan o'zingizga mosini tanlang." action={<Button asChild><Link href="/market">Katalogga o'tish</Link></Button>} /></TabsContent>
        <TabsContent value="xaridlar"><EmptyState icon={Receipt} title="Xaridlar yo'q" text="To'lov tizimi ulangach, cheklar va to'lov tarixi shu yerda paydo bo'ladi." /></TabsContent>
      </Tabs>
    </div>
  );
}
