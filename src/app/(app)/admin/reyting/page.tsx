"use client";
import { RankingAdmin } from "@/components/admin/rankings";
import { PageHeader } from "@/components/layout/page";
import { adminModule } from "@/lib/modules";

/** Reyting boshqaruvi: yo'nalishlar, vaznlar, urinishlar, reytingga hisoblanadigan imtihonlar, qayta hisoblash va moderatsiya. Hujjat: docs/REYTING.md */
export default function Page() {
  return (
    <>
      <PageHeader module={adminModule} title="Reyting boshqaruvi" description="Ustozlar reytingi sozlamalari, reytingga hisoblanadigan imtihonlar va moderatsiya" />
      <RankingAdmin />
    </>
  );
}
