import { Brain, BookOpenCheck, Compass, Store, BarChart3, Library, LayoutDashboard, Bot, type LucideIcon } from "lucide-react";

export type SubPage = { href: string; label: string };
export type Module = {
  key: string; href: string; name: string; short: string; icon: LucideIcon;
  /** Tailwind klasslari statik bo'lishi kerak, shuning uchun to'liq yozilgan */
  bg: string; text: string; soft: string; bar: string; hex: string;
  subs: SubPage[];
};

export const dashboardItem = { href: "/dashboard", name: "Bosh sahifa", icon: LayoutDashboard };

export const modules: Module[] = [
  { key: "ai", href: "/ustoz-ai", name: "USTOZ AI", short: "Diagnostika va reja", icon: Brain, hex: "#2563EB",
    bg: "bg-[#2563EB]", text: "text-[#2563EB]", soft: "bg-[#2563EB]/10", bar: "bg-[#2563EB]",
    subs: [
      { href: "/ustoz-ai", label: "Umumiy" }, { href: "/ustoz-ai/diagnostika", label: "Diagnostika" },
      { href: "/ustoz-ai/testlar", label: "Testlar" }, { href: "/ustoz-ai/bilim-xaritasi", label: "Bilim xaritasi" },
      { href: "/ustoz-ai/xatolar", label: "Xatolar daftari" }, { href: "/ustoz-ai/reja", label: "Shaxsiy reja" },
    ] },
  { key: "darsyor", href: "/darsyor", name: "DARSYOR", short: "Dars tayyorlash", icon: BookOpenCheck, hex: "#D97706",
    bg: "bg-[#D97706]", text: "text-[#B45309]", soft: "bg-[#F59E0B]/15", bar: "bg-[#F59E0B]",
    subs: [
      { href: "/darsyor", label: "Umumiy" }, { href: "/darsyor/dars-ishlanmasi", label: "Dars ishlanmasi" },
      { href: "/darsyor/test-generator", label: "Test generatori" }, { href: "/darsyor/korgazma", label: "Ko'rgazmalar" },
      { href: "/darsyor/baholash", label: "Baholash" },
    ] },
  { key: "toifa", href: "/toifa", name: "TOIFA NAVIGATOR", short: "Attestatsiya yo'li", icon: Compass, hex: "#0D9488",
    bg: "bg-[#0D9488]", text: "text-[#0D9488]", soft: "bg-[#0D9488]/10", bar: "bg-[#0D9488]",
    subs: [
      { href: "/toifa", label: "Umumiy" }, { href: "/toifa/yol-xaritasi", label: "Yo'l xaritasi" },
      { href: "/toifa/kalendar", label: "Kalendar" }, { href: "/toifa/hujjatlar", label: "Hujjatlar" },
    ] },
  { key: "market", href: "/market", name: "USTOZ MARKET", short: "Kurs va materiallar", icon: Store, hex: "#7C3AED",
    bg: "bg-[#7C3AED]", text: "text-[#7C3AED]", soft: "bg-[#7C3AED]/10", bar: "bg-[#7C3AED]",
    subs: [
      { href: "/market", label: "Katalog" }, { href: "/market/mening-kurslarim", label: "Mening kurslarim" },
      { href: "/market/xaridlar", label: "Xaridlar" }, { href: "/market/muallif", label: "Muallif kabineti" },
    ] },
  { key: "sinf", href: "/sinf", name: "SINF ANALITIKA", short: "Sinf natijalari", icon: BarChart3, hex: "#E11D48",
    bg: "bg-[#E11D48]", text: "text-[#E11D48]", soft: "bg-[#E11D48]/10", bar: "bg-[#E11D48]",
    subs: [
      { href: "/sinf", label: "Sinflar" }, { href: "/sinf/natijalar", label: "Natijalar" },
      { href: "/sinf/tahlil", label: "Tahlil" }, { href: "/sinf/topshiriqlar", label: "Individual topshiriqlar" },
    ] },
  { key: "bilimxona", href: "/bilimxona", name: "BILIMXONA", short: "Kutubxona va AI suhbat", icon: Library, hex: "#4F46E5",
    bg: "bg-[#4F46E5]", text: "text-[#4F46E5]", soft: "bg-[#4F46E5]/10", bar: "bg-[#4F46E5]",
    subs: [
      { href: "/bilimxona", label: "Kutubxona" }, { href: "/bilimxona/yuklash", label: "Fayl yuklash" },
      { href: "/bilimxona/suhbat", label: "Hujjat bilan suhbat" },
    ] },
  { key: "bepul", href: "/bepul-ai", name: "BEPUL AI", short: "Bepul va o'z obunangiz", icon: Bot, hex: "#059669",
    bg: "bg-[#059669]", text: "text-[#047857]", soft: "bg-[#059669]/10", bar: "bg-[#059669]",
    subs: [{ href: "/bepul-ai", label: "Bepul suhbat" }, { href: "/bepul-ai/obunalarim", label: "Mening AI obunalarim" }] },
];

export const findModule = (path: string) => modules.find((m) => path === m.href || path.startsWith(m.href + "/"));

import { ShieldCheck } from "lucide-react";
export const adminModule: Module = {
  key: "admin", href: "/admin", name: "Admin panel", short: "Boshqaruv", icon: ShieldCheck, hex: "#122B49",
  bg: "bg-[#122B49]", text: "text-[#122B49] dark:text-[#9DB8DA]", soft: "bg-[#122B49]/10", bar: "bg-[#122B49]",
  subs: [
    { href: "/admin", label: "Dashboard" }, { href: "/admin/foydalanuvchilar", label: "Foydalanuvchilar" },
    { href: "/admin/savollar", label: "Savollar banki" }, { href: "/admin/kurslar", label: "Kurslar" },
    { href: "/admin/tolovlar", label: "To'lovlar" }, { href: "/admin/hisobotlar", label: "Hisobotlar" },
    { href: "/admin/sozlamalar", label: "Sozlamalar" },
  ],
};
export const allModules = [...modules, adminModule];
export const findAny = (path: string) => allModules.find((m) => path === m.href || path.startsWith(m.href + "/"));

export const searchIndex: { label: string; href: string; group: string }[] = [
  { label: "Bosh sahifa", href: "/dashboard", group: "Umumiy" },
  { label: "Barcha xizmatlar", href: "/xizmatlar", group: "Umumiy" },
  { label: "Profil", href: "/profil", group: "Hisob" },
  { label: "Obuna va to'lovlar", href: "/obuna", group: "Hisob" },
  { label: "Holatlar namunasi (loading, empty, error)", href: "/holatlar", group: "Hisob" },
  ...allModules.flatMap((m) => m.subs.map((s) => ({ label: `${m.name}: ${s.label}`, href: s.href, group: m.name }))),
];
