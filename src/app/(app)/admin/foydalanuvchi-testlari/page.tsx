"use client";
import { UserTests } from "@/components/admin/user-tests";
import { adminModule } from "@/lib/modules";
import { PageHeader } from "@/components/layout/page";

/** Foydalanuvchi testlari: ustozlar yuborgan shaxsiy testlarni ko'rib chiqish va umumiy bankka tasdiqlash. Hujjat: docs/SMART-IMPORT.md */
export default function Page() {
  return (
    <>
      <PageHeader module={adminModule} title="Foydalanuvchi testlari" description="Ustozlar ulashish uchun yuborgan testlar: faqat tasdiqlangan savollar umumiy bankka o'tadi" />
      <UserTests />
    </>
  );
}
