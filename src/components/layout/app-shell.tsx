"use client";
import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Brain, CalendarDays, ChevronRight, GraduationCap, Grid2x2, Home, Search, Sparkles, Trophy, User, CreditCard, LogOut, LogIn, ShieldCheck,
} from "lucide-react";
import * as DM from "@radix-ui/react-dropdown-menu";
import { allModules, dashboardItem, modules, findAny, resolveSub, searchIndex, adminModule } from "@/lib/modules";
import { cn } from "@/lib/utils";
import { AdminBar } from "@/components/admin/admin-bar";
import { AdminShell } from "@/components/admin/admin-shell";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/form";
import { ToastProvider } from "@/components/ui/toast";
import { Avatar } from "@/components/avatar";
import { Logo, Notifications, ThemeToggle, signOut } from "./shell-parts";
import { ShellProvider, useShell } from "./shell-context";

function NavLink({ href, icon: Icon, label, active }: { href: string; icon: React.ElementType; label: string; active: boolean }) {
  return (
    <Link href={href} aria-current={active ? "page" : undefined}
      className={cn("flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors",
        active ? "bg-primary text-white shadow-soft" : "text-white/75 hover:bg-white/10 hover:text-white")}>
      <Icon className="h-[18px] w-[18px] shrink-0" aria-hidden />
      <span className="truncate">{label}</span>
    </Link>
  );
}

function SideProfile() {
  const { me, ready } = useShell();
  if (!ready) return <div className="mt-3 flex items-center gap-3 p-2" aria-hidden><span className="skeleton h-10 w-10 rounded-full" /><span className="skeleton h-8 flex-1 rounded-lg" /></div>;
  if (!me) return (
    <Link href="/kirish" className="mt-3 flex items-center gap-3 rounded-xl p-2 text-white hover:bg-white/10">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white/15"><LogIn className="h-5 w-5" aria-hidden /></span>
      <span className="text-sm font-bold">Kirish</span>
    </Link>
  );
  // Asosiy ko'rinishda foydalanuvchining o'zi tanlagan nik (katta, maxsus shrift), ism familiya esa pastda kichikroq
  const label = me.nickname || me.name || me.email || "Foydalanuvchi";
  return (
    <Link href="/profil" className="mt-3 flex items-center gap-3 rounded-xl p-2 text-white hover:bg-white/10" aria-label="Profil">
      <Avatar src={me.avatar} name={label} size={40} tone="dark" />
      <span className="min-w-0 leading-tight"><span className={me.nickname ? "block truncate font-display text-base font-extrabold tracking-tight" : "block truncate text-sm font-bold"}>{label}</span><span className="block truncate text-xs text-white/60">{me.nickname ? me.name || `${me.plan} tarif` : `${me.plan} tarif`}</span></span>
    </Link>
  );
}

/** O'chirilgan modullar menyuda ko'rinmaydi (admin «Modullar»). Sozlama yuklanmaguncha hammasi ko'rinadi. */
function useVisibleModules() {
  const { pub } = useShell();
  return React.useMemo(() => modules.filter((m) => pub?.modules?.[m.key] !== false), [pub]);
}

function Sidebar() {
  const path = usePathname();
  const cur = findAny(path)?.key;
  const { isAdmin } = useShell();
  const visible = useVisibleModules();
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col bg-side p-4 text-white lg:flex">
      <Logo dark className="px-2 pb-6 pt-1" />
      <nav aria-label="Asosiy menyu" className="flex-1 space-y-1 overflow-y-auto">
        <NavLink href={dashboardItem.href} icon={dashboardItem.icon} label={dashboardItem.name} active={path === "/dashboard"} />
        {/* Diagnostika, testlar, natijalar va AI suhbat bitta umumiy USTOZ AI bo'limi ichida; imtihon simulyatori va reyting mustaqil bo'limlar. */}
        {visible.some((m) => m.key === "ai") && <NavLink href="/ustoz-ai" icon={Brain} label="USTOZ AI" active={cur === "ai"} />}
        <NavLink href="/imtihon" icon={GraduationCap} label="Imtihon simulyatori" active={path === "/imtihon" || path.startsWith("/imtihon/")} />
        <NavLink href="/reyting" icon={Trophy} label="Ustozlar reytingi" active={path === "/reyting" || path.startsWith("/reyting/")} />
        <NavLink href="/seminarlar" icon={CalendarDays} label="Seminarlar" active={path === "/seminarlar"} />
        <p className="px-3 pb-1 pt-4 text-[11px] font-bold uppercase tracking-wider text-white/40">Modullar</p>
        {visible.filter((m) => m.key !== "ai").map((m) => <NavLink key={m.key} href={m.href} icon={m.icon} label={m.name} active={cur === m.key} />)}
        <p className="px-3 pb-1 pt-4 text-[11px] font-bold uppercase tracking-wider text-white/40">Hisob</p>
        {isAdmin && <NavLink href="/admin" icon={adminModule.icon} label="Admin saytiga qaytish" active={false} />}
        <NavLink href="/obuna" icon={CreditCard} label="Obuna" active={path === "/obuna"} />
      </nav>
      <SideProfile />
    </aside>
  );
}

function BottomNav() {
  const path = usePathname();
  const items = [
    { href: "/dashboard", label: "Bosh", icon: Home, on: path === "/dashboard" },
    { href: "/ustoz-ai", label: "O'rganish", icon: modules[0].icon, on: path.startsWith("/ustoz-ai") },
    { href: "/imtihon", label: "Imtihon", icon: GraduationCap, on: path === "/imtihon" || path.startsWith("/imtihon/") },
    { href: "/reyting", label: "Reyting", icon: Trophy, on: path === "/reyting" || path.startsWith("/reyting/") },
    { href: "/profil", label: "Profil", icon: User, on: path.startsWith("/profil") },
  ];
  return (
    <nav aria-label="Mobil menyu" className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
      <ul className="grid grid-cols-5">
        {items.map((i) => (
          <li key={i.label}>
            <Link href={i.href} aria-current={i.on ? "page" : undefined} className={cn("flex min-h-[56px] flex-col items-center justify-center gap-0.5 text-[11px] font-semibold", i.on ? "text-primary" : "text-muted-foreground")}>
              <i.icon className="h-5 w-5" aria-hidden />{i.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

function AllServices({ open, setOpen }: { open: boolean; setOpen: (v: boolean) => void }) {
  const { isAdmin } = useShell();
  const visible = useVisibleModules();
  const list = [...visible, ...(isAdmin ? [adminModule] : [])];
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent title="Barcha xizmatlar" description="Modullar va boshqaruv" className="max-h-[85vh] overflow-y-auto">
        <ul className="grid grid-cols-2 gap-3">
          {/* Pastki menyuda joy yo'q: AI yordamchi va oddiy bo'limlar shu yerda ham turadi (320 px ekranda ham). */}
          <li>
            <Link href="/ai" onClick={() => setOpen(false)} className="flex h-full flex-col gap-2 rounded-2xl border border-border p-3.5 hover:bg-muted">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-primary text-white"><Sparkles className="h-5 w-5" aria-hidden /></span>
              <b className="text-sm">AI yordamchi</b><span className="text-xs text-muted-foreground">Erkin savol va suhbat</span>
            </Link>
          </li>
          <li>
            <Link href="/seminarlar" onClick={() => setOpen(false)} className="flex h-full flex-col gap-2 rounded-2xl border border-border p-3.5 hover:bg-muted">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-teal text-white"><CalendarDays className="h-5 w-5" aria-hidden /></span>
              <b className="text-sm">Seminarlar</b><span className="text-xs text-muted-foreground">Yaqin tadbirlar</span>
            </Link>
          </li>
          {list.map((m) => (
            <li key={m.key}>
              <Link href={m.href} onClick={() => setOpen(false)} className="flex h-full flex-col gap-2 rounded-2xl border border-border p-3.5 hover:bg-muted">
                <span className={cn("grid h-10 w-10 place-items-center rounded-xl text-white", m.bg)}><m.icon className="h-5 w-5" aria-hidden /></span>
                <b className="text-sm">{m.name}</b><span className="text-xs text-muted-foreground">{m.short}</span>
              </Link>
            </li>
          ))}
        </ul>
      </DialogContent>
    </Dialog>
  );
}

function Breadcrumb() {
  const path = usePathname();
  const mod = findAny(path);
  const crumbs: { label: string; href?: string }[] = [{ label: "Bosh sahifa", href: "/dashboard" }];
  if (path === "/dashboard") crumbs.length = 0, crumbs.push({ label: "Bosh sahifa" });
  else if (mod) {
    const { sub, group } = resolveSub(mod, path);
    crumbs.push({ label: mod.name, href: sub && sub.href !== mod.href ? mod.href : undefined });
    if (group && group.href !== mod.href) crumbs.push({ label: group.label, href: group.href });
    if (sub && sub.href !== mod.href) crumbs.push({ label: sub.label });
  } else {
    const map: Record<string, string> = { "/profil": "Profil", "/obuna": "Obuna", "/xizmatlar": "Barcha xizmatlar", "/imtihon": "Imtihon simulyatori", "/reyting": "Ustozlar reytingi", "/seminarlar": "Seminarlar" };
    crumbs.push({ label: map[path] ?? "Sahifa" });
  }
  return (
    <ol className="flex min-w-0 items-center gap-1 text-xs uppercase tracking-wide" aria-label="Breadcrumb">
      {crumbs.map((c, i) => (
        <li key={c.label} className="flex min-w-0 items-center gap-1">
          {i > 0 && <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />}
          {c.href ? <Link href={c.href} className="truncate text-muted-foreground hover:text-foreground">{c.label}</Link> : <span className="truncate font-bold text-foreground" aria-current="page">{c.label}</span>}
        </li>
      ))}
    </ol>
  );
}

function SearchDialog({ open, setOpen }: { open: boolean; setOpen: (v: boolean) => void }) {
  const [q, setQ] = React.useState("");
  const router = useRouter();
  const { isAdmin } = useShell();
  const pool = searchIndex.filter((s) => isAdmin || !s.href.startsWith("/admin"));
  const res = pool.filter((s) => s.label.toLowerCase().includes(q.toLowerCase())).slice(0, 8);
  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setQ(""); }}>
      <DialogContent title="Qidirish" description="Sahifa va bo'limlar bo'yicha qidirish.">
        <Input autoFocus placeholder="Masalan: xatolar, kalendar, kurs..." value={q} onChange={(e) => setQ(e.target.value)} aria-label="Qidiruv so'rovi" />
        <ul className="mt-3 max-h-72 space-y-1 overflow-y-auto">
          {res.map((r) => (
            <li key={r.href + r.label}>
              <button className="flex min-h-11 w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm hover:bg-muted" onClick={() => { setOpen(false); router.push(r.href); }}>
                <span>{r.label}</span><span className="text-xs text-muted-foreground">{r.group}</span>
              </button>
            </li>
          ))}
          {res.length === 0 && <li className="px-3 py-6 text-center text-sm text-muted-foreground">Hech narsa topilmadi.</li>}
        </ul>
      </DialogContent>
    </Dialog>
  );
}

function ProfileMenu() {
  const { me, ready, isAdmin } = useShell();
  const item = "flex min-h-11 cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2 text-sm outline-none data-[highlighted]:bg-muted";
  if (!ready) return <span className="skeleton h-9 w-9 rounded-full" aria-hidden />;
  if (!me) return <Button asChild size="sm"><Link href="/kirish"><LogIn className="h-4 w-4" />Kirish</Link></Button>;
  const label = me.nickname || me.name || me.email || "Foydalanuvchi";
  return (
    <DM.Root>
      <DM.Trigger asChild>
        <button className="flex items-center gap-2.5 rounded-xl p-1 pr-2 hover:bg-muted" aria-label="Profil menyusi">
          <Avatar src={me.avatar} name={label} size={36} />
          <span className="hidden text-left leading-tight md:block"><span className={me.nickname ? "block max-w-[140px] truncate font-display text-base font-extrabold tracking-tight" : "block max-w-[140px] truncate text-sm font-bold"}>{label}</span><span className="block max-w-[140px] truncate text-xs text-muted-foreground">{me.nickname && me.name ? me.name : `${me.plan} tarif`}</span></span>
        </button>
      </DM.Trigger>
      <DM.Portal>
        <DM.Content align="end" sideOffset={8} className="z-50 w-56 rounded-2xl border border-border bg-card p-1.5 shadow-pop">
          <DM.Item asChild><Link href="/profil" className={item}><User className="h-4 w-4" />Profil</Link></DM.Item>
          <DM.Item asChild><Link href="/obuna" className={item}><CreditCard className="h-4 w-4" />Obuna va to'lovlar</Link></DM.Item>
          {isAdmin && <DM.Item asChild><Link href="/admin" className={item}><ShieldCheck className="h-4 w-4" />Admin saytiga qaytish</Link></DM.Item>}
          <DM.Separator className="my-1 h-px bg-border" />
          <DM.Item onSelect={signOut} className={item}><LogOut className="h-4 w-4" />Chiqish</DM.Item>
        </DM.Content>
      </DM.Portal>
    </DM.Root>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  const [more, setMore] = React.useState(false);
  const [search, setSearch] = React.useState(false);
  React.useEffect(() => {
    const h = (e: KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setSearch(true); } };
    window.addEventListener("keydown", h); return () => window.removeEventListener("keydown", h);
  }, []);
  return (
    <>
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[70] focus:rounded-lg focus:bg-primary focus:px-3 focus:py-2 focus:text-white">Asosiy kontentga o'tish</a>
      <Sidebar />
      <div className="lg:pl-64">
        <AdminBar />
        <header className="sticky top-0 z-20 flex h-16 items-center gap-1.5 border-b border-border bg-background/90 px-3 backdrop-blur min-[380px]:gap-2 min-[380px]:px-4 sm:gap-3 lg:px-8">
          <Logo className="lg:hidden" />
          <div className="hidden min-w-0 flex-1 lg:block"><Breadcrumb /></div>
          <div className="flex-1 lg:hidden" />
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setMore(true)} aria-label="Barcha xizmatlar"><Grid2x2 className="h-5 w-5" /></Button>
          <button onClick={() => setSearch(true)} className="hidden h-10 w-64 items-center gap-2 rounded-xl border border-border bg-card px-3 text-sm text-muted-foreground hover:bg-muted md:flex" aria-label="Global qidiruv">
            <Search className="h-4 w-4" aria-hidden />Qidirish...<kbd className="ml-auto rounded bg-muted px-1.5 text-[11px]">Ctrl K</kbd>
          </button>
          <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setSearch(true)} aria-label="Qidirish"><Search className="h-5 w-5" /></Button>
          <Button asChild variant="outline" size="sm" className="hidden sm:inline-flex"><Link href="/ai"><Sparkles className="h-4 w-4 text-primary" aria-hidden />AI yordamchi</Link></Button>
          {/* Juda tor ekranda (320px) joy yetmaydi: AI pastki menyuda ham bor. */}
          <Button asChild variant="ghost" size="icon" className="sm:hidden max-[379px]:hidden"><Link href="/ai" aria-label="AI yordamchi"><Sparkles className="h-5 w-5 text-primary" /></Link></Button>
          <ThemeToggle />
          <Notifications />
          <ProfileMenu />
        </header>
        <div className="border-b border-border bg-background px-4 py-2 lg:hidden"><Breadcrumb /></div>
        <main id="main" className="mx-auto w-full max-w-[1280px] px-4 pb-28 pt-6 lg:px-8 lg:pb-12">{children}</main>
      </div>
      <BottomNav />
      <AllServices open={more} setOpen={setMore} />
      <SearchDialog open={search} setOpen={setSearch} />
    </>
  );
}

/**
 * Qobiq tanlash: admin akkaunt kirsa admin sayti (alohida qobiq), «Ustoz ko'rinishi» tanlansa ustoz sayti va tepada admin paneli.
 * Admin uchun ustoz sahifalariga to'g'ridan-to'g'ri kirilsa, admin saytiga qaytariladi.
 */
function Frame({ children }: { children: React.ReactNode }) {
  const { ready, isAdmin, me, view, setView, adminMode } = useShell();
  const path = usePathname(); const router = useRouter();
  const prevPath = React.useRef<string | null>(null);
  React.useEffect(() => {
    if (!ready) return;
    // Admin /admin sahifasiga kirsa admin sayti tiklanadi. Faqat YO'L o'zgarganda: «Ustoz ko'rinishi» bosilganda
    // (ko'rinish o'zgaradi, yo'l hali /admin) qayta o'zgarib ketmasligi uchun.
    const changed = prevPath.current !== path; prevPath.current = path;
    if (changed && isAdmin && view === "teacher" && path.startsWith("/admin")) setView("admin");
    else if (isAdmin && view === "admin" && !path.startsWith("/admin") && path !== "/kirish") router.replace("/admin");
    // Ism-familiya va yashash joyi to'ldirilmagan ustoz avval ro'yxatdan o'tishni yakunlaydi (adminga bu shart emas).
    else if (me && !isAdmin && me.onboarded === false) router.replace("/royxat");
  }, [ready, isAdmin, view, path, me, router, setView]);
  if (adminMode) return <AdminShell>{children}</AdminShell>;
  return <ToastProvider><Shell>{children}</Shell></ToastProvider>;
}

export function AppShell({ children }: { children: React.ReactNode }) {
  return <ShellProvider><Frame>{children}</Frame></ShellProvider>;
}
