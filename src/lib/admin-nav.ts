import { BarChart3, BookOpen, BrainCircuit, CalendarDays, ClipboardList, FileBarChart, Layers, LayoutDashboard, Library, Megaphone, ScrollText, Settings, Users, Wallet, FlaskConical, Boxes, Compass, FileCheck2, Trophy, type LucideIcon } from "lucide-react";

/** Admin saytining menyusi: yo'nalishlar bo'yicha guruhlangan. Admin bu yerdan hamma bo'limni tekshiradi va o'zgartiradi. */
export type AdminItem = { href: string; label: string; icon: LucideIcon; hint?: string };
export type AdminGroup = { title: string; items: AdminItem[] };

export const ADMIN_NAV: AdminGroup[] = [
  { title: "Boshqaruv", items: [
    { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
    { href: "/admin/statistika", label: "Statistika", icon: BarChart3, hint: "Yo'nalishlar, adminlar va ustozlar bo'yicha" },
    { href: "/admin/hisobotlar", label: "Hisobotlar", icon: FileBarChart },
    { href: "/admin/audit", label: "Audit jurnali", icon: ScrollText },
  ] },
  { title: "Foydalanuvchilar", items: [
    { href: "/admin/foydalanuvchilar", label: "Foydalanuvchilar", icon: Users, hint: "Rollar, bloklash, tarif" },
  ] },
  { title: "Kontent", items: [
    { href: "/admin/savollar", label: "Savollar banki", icon: FlaskConical },
    { href: "/admin/foydalanuvchi-testlari", label: "Foydalanuvchi testlari", icon: FileCheck2, hint: "Ustozlar yuborgan testlarni ko'rib chiqish" },
    { href: "/admin/reyting", label: "Reyting boshqaruvi", icon: Trophy, hint: "Yo'nalishlar, vaznlar, reytingga hisoblanadigan imtihonlar, moderatsiya" },
    { href: "/admin/mavzular", label: "Fanlar va mavzular", icon: Layers },
    { href: "/admin/imtihonlar", label: "Imtihonlar", icon: ClipboardList },
    { href: "/admin/seminarlar", label: "Seminarlar", icon: CalendarDays },
    { href: "/admin/rasmiy", label: "Rasmiy ma'lumotlar", icon: Compass },
    { href: "/admin/kutubxona", label: "Kutubxona", icon: Library },
    { href: "/admin/elonlar", label: "Yangilik va e'lonlar", icon: Megaphone },
  ] },
  { title: "AI Bilim markazi", items: [
    { href: "/admin/ai-bilim", label: "AI Bilim markazi", icon: BrainCircuit, hint: "Tasdiqlangan bilim, nomzodlar, provayderlar" },
  ] },
  { title: "Savdo", items: [
    { href: "/admin/kurslar", label: "Kurslar", icon: BookOpen },
    { href: "/admin/tolovlar", label: "To'lovlar", icon: Wallet },
  ] },
  { title: "Tizim", items: [
    { href: "/admin/modullar", label: "Modullar", icon: Boxes, hint: "Yoqish/o'chirish va boshqaruv" },
    { href: "/admin/sozlamalar", label: "Sozlamalar", icon: Settings, hint: "AI, to'lov, ulanishlar" },
  ] },
];

export const ADMIN_ITEMS = ADMIN_NAV.flatMap((g) => g.items.map((i) => ({ ...i, group: g.title })));

/** Joriy yo'lga mos admin bandi (eng uzun mos kelgani). */
export function adminItemFor(path: string) {
  return [...ADMIN_ITEMS].sort((a, b) => b.href.length - a.href.length).find((i) => path === i.href || (i.href !== "/admin" && path.startsWith(i.href + "/")));
}

/** Ustoz bo'limidagi admin paneli: shu bo'limni qaerda boshqarish kerak. */
export const MANAGE_LINKS: { prefix: string; href: string; label: string }[] = [
  { prefix: "/ustoz-ai", href: "/admin/savollar", label: "Savollar bankini boshqarish" },
  { prefix: "/imtihon", href: "/admin/imtihonlar", label: "Imtihonlarni boshqarish" },
  { prefix: "/darsyor", href: "/admin/modullar", label: "DARSYOR boshqaruvi" },
  { prefix: "/toifa", href: "/admin/rasmiy", label: "Rasmiy ma'lumotlarni boshqarish" },
  { prefix: "/market", href: "/admin/kurslar", label: "Kurslarni boshqarish" },
  { prefix: "/sinf", href: "/admin/modullar", label: "SINF boshqaruvi" },
  { prefix: "/bilimxona", href: "/admin/kutubxona", label: "Kutubxonani boshqarish" },
  { prefix: "/seminarlar", href: "/admin/seminarlar", label: "Seminarlarni boshqarish" },
  { prefix: "/bepul-ai", href: "/admin/sozlamalar", label: "AI sozlamalari" },
  { prefix: "/ai", href: "/admin/sozlamalar", label: "AI sozlamalari" },
  { prefix: "/dashboard", href: "/admin/elonlar", label: "Yangilik va e'lonlar" },
  { prefix: "/obuna", href: "/admin/tolovlar", label: "To'lovlarni boshqarish" },
];
export const manageLinkFor = (path: string) => MANAGE_LINKS.find((m) => path === m.prefix || path.startsWith(m.prefix + "/"));
