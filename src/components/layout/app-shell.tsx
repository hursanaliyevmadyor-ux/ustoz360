"use client";
import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Bell, ChevronRight, Grid2x2, Home, LayoutDashboard, Menu, Moon, Search, Sparkles, Sun, User, CreditCard, LogOut, ArrowRight, Check,
} from "lucide-react";
import * as DM from "@radix-ui/react-dropdown-menu";
import { allModules, dashboardItem, modules, findAny, searchIndex, adminModule } from "@/lib/modules";
import { notifications as demoNotifs, user } from "@/lib/demo";
import { cn } from "@/lib/utils";
import { Badge, DemoBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/form";
import { ToastProvider } from "@/components/ui/toast";

function Logo({ className }: { className?: string }) {
  return (
    <Link href="/dashboard" className={cn("flex shrink-0 items-center gap-2.5 whitespace-nowrap", className)} aria-label="USTOZ 360 bosh sahifa">
      <span className="grid h-9 w-9 place-items-center rounded-xl bg-primary text-sm font-extrabold text-white">U</span>
      <span className="text-lg font-extrabold tracking-tight">USTOZ <span className="text-primary">360</span></span>
    </Link>
  );
}

function NavLink({ href, icon: Icon, label, active, accent }: { href: string; icon: React.ElementType; label: string; active: boolean; accent?: { bg: string; soft: string; text: string } }) {
  return (
    <Link href={href} aria-current={active ? "page" : undefined}
      className={cn("flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors",
        active ? "bg-primary text-white shadow-soft" : "text-muted-foreground hover:bg-muted hover:text-foreground")}>
      <span className={cn("grid h-7 w-7 place-items-center rounded-lg", active ? "bg-white/20" : accent?.soft ?? "bg-muted", !active && accent?.text)}>
        <Icon className="h-4 w-4" aria-hidden />
      </span>
      {label}
    </Link>
  );
}

function Sidebar() {
  const path = usePathname();
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-border bg-card p-4 lg:flex">
      <Logo className="px-2 pb-5 pt-1" />
      <nav aria-label="Asosiy menyu" className="flex-1 space-y-1 overflow-y-auto">
        <NavLink href={dashboardItem.href} icon={dashboardItem.icon} label={dashboardItem.name} active={path === "/dashboard"} />
        <NavLink href="/ai" icon={Sparkles} label="AI chat" active={false} />
        <p className="px-3 pb-1 pt-4 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Modullar</p>
        {modules.map((m) => <NavLink key={m.key} href={m.href} icon={m.icon} label={m.name} accent={m} active={findAny(path)?.key === m.key} />)}
        <p className="px-3 pb-1 pt-4 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Boshqaruv</p>
        <NavLink href="/admin" icon={adminModule.icon} label="Admin panel" accent={adminModule} active={findAny(path)?.key === "admin"} />
      </nav>
      <Link href="/obuna" className="mt-3 block rounded-2xl bg-navy p-4 text-background">
        <div className="flex items-center justify-between"><Badge variant="amber">FREE</Badge><ArrowRight className="h-4 w-4" aria-hidden /></div>
        <p className="mt-2 text-sm font-bold">Obuna holati</p>
        <p className="text-xs opacity-75">To'lov hali ulanmagan</p>
      </Link>
    </aside>
  );
}

function BottomNav() {
  const path = usePathname();
  const items = [
    { href: "/dashboard", label: "Bosh", icon: Home, on: path === "/dashboard" },
    { href: "/ustoz-ai/diagnostika", label: "O'rganish", icon: modules[0].icon, on: path.startsWith("/ustoz-ai") },
    { href: "/ai", label: "AI", icon: Sparkles, on: false },
    { href: "/bilimxona", label: "Materiallar", icon: modules[5].icon, on: path === "/bilimxona" || path.startsWith("/bilimxona/kutubxona") || path.startsWith("/bilimxona/yuklash") },
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
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent title="Barcha xizmatlar" description="Oltita modul va boshqaruv" className="max-h-[85vh] overflow-y-auto">
        <ul className="grid grid-cols-2 gap-3">
          {allModules.map((m) => (
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
    const sub = [...mod.subs].reverse().find((s) => path === s.href || path.startsWith(s.href + "/"));
    crumbs.push({ label: mod.name, href: sub && sub.href !== mod.href ? mod.href : undefined });
    if (sub && sub.href !== mod.href) crumbs.push({ label: sub.label });
  } else {
    const map: Record<string, string> = { "/profil": "Profil", "/obuna": "Obuna", "/xizmatlar": "Barcha xizmatlar", "/holatlar": "Holatlar namunasi" };
    crumbs.push({ label: map[path] ?? "Sahifa" });
  }
  return (
    <ol className="flex min-w-0 items-center gap-1 text-sm" aria-label="Breadcrumb">
      {crumbs.map((c, i) => (
        <li key={c.label} className="flex min-w-0 items-center gap-1">
          {i > 0 && <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />}
          {c.href ? <Link href={c.href} className="truncate text-muted-foreground hover:text-foreground">{c.label}</Link> : <span className="truncate font-semibold" aria-current="page">{c.label}</span>}
        </li>
      ))}
    </ol>
  );
}

function SearchDialog({ open, setOpen }: { open: boolean; setOpen: (v: boolean) => void }) {
  const [q, setQ] = React.useState("");
  const router = useRouter();
  const res = searchIndex.filter((s) => s.label.toLowerCase().includes(q.toLowerCase())).slice(0, 8);
  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setQ(""); }}>
      <DialogContent title="Qidirish" description="Sahifa va bo'limlar bo'yicha. Kontent (test, material) qidiruvi backend ulangach ishlaydi.">
        <Input autoFocus placeholder="Masalan: xatolar, kalendar, kurs..." value={q} onChange={(e) => setQ(e.target.value)} aria-label="Qidiruv so'rovi" />
        <ul className="mt-3 max-h-72 space-y-1 overflow-y-auto">
          {res.map((r) => (
            <li key={r.href + r.label}>
              <button className="flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm hover:bg-muted" onClick={() => { setOpen(false); router.push(r.href); }}>
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

function Notifications() {
  const [items, setItems] = React.useState(demoNotifs);
  const unread = items.filter((i) => i.unread).length;
  return (
    <DM.Root>
      <DM.Trigger asChild>
        <Button variant="ghost" size="icon" aria-label={`Bildirishnomalar${unread ? `, ${unread} ta yangi` : ""}`} className="relative">
          <Bell className="h-5 w-5" aria-hidden />
          {unread > 0 && <span className="absolute right-1.5 top-1.5 h-2.5 w-2.5 rounded-full bg-danger ring-2 ring-card" />}
        </Button>
      </DM.Trigger>
      <DM.Portal>
        <DM.Content align="end" sideOffset={8} className="z-50 w-[min(360px,calc(100vw-24px))] rounded-2xl border border-border bg-card p-2 shadow-pop">
          <div className="flex items-center justify-between px-3 py-2">
            <p className="font-bold">Bildirishnomalar <DemoBadge className="ml-1" /></p>
            <button className="text-xs font-semibold text-primary" onClick={() => setItems((s) => s.map((i) => ({ ...i, unread: false })))}>Hammasini o'qildi qilish</button>
          </div>
          {items.map((n) => (
            <div key={n.id} className="flex gap-3 rounded-xl px-3 py-2.5 hover:bg-muted">
              <span className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", n.unread ? "bg-primary" : "bg-transparent")} />
              <div><p className="text-sm font-semibold">{n.title}</p><p className="text-sm text-muted-foreground">{n.text}</p><p className="mt-0.5 text-xs text-muted-foreground">{n.time}</p></div>
            </div>
          ))}
        </DM.Content>
      </DM.Portal>
    </DM.Root>
  );
}

function ProfileMenu() {
  const [me, setMe] = React.useState<{ name: string | null; email: string | null } | null>(null);
  React.useEffect(() => { fetch("/api/me").then((r) => r.json()).then((d) => setMe(d.user ?? null)).catch(() => {}); }, []);
  const label = me ? (me.name ?? me.email ?? "?") : user.name;
  const initials = me ? (me.name ?? me.email ?? "?").split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase() : user.short;
  const item = "flex cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2 text-sm outline-none data-[highlighted]:bg-muted";
  return (
    <DM.Root>
      <DM.Trigger asChild>
        <button className="flex items-center gap-2.5 rounded-xl p-1 pr-2 hover:bg-muted" aria-label="Profil menyusi">
          <span className="grid h-9 w-9 place-items-center rounded-full bg-primary/10 text-sm font-bold text-primary">{initials}</span>
          <span className="hidden text-left leading-tight md:block"><span className="block text-sm font-bold">{label}</span><span className="block text-xs text-muted-foreground">{me ? "Akkaunt" : `${user.plan} tarif (demo)`}</span></span>
        </button>
      </DM.Trigger>
      <DM.Portal>
        <DM.Content align="end" sideOffset={8} className="z-50 w-56 rounded-2xl border border-border bg-card p-1.5 shadow-pop">
          <DM.Item asChild><Link href="/profil" className={item}><User className="h-4 w-4" />Profil</Link></DM.Item>
          <DM.Item asChild><Link href="/obuna" className={item}><CreditCard className="h-4 w-4" />Obuna va to'lovlar</Link></DM.Item>
          <DM.Separator className="my-1 h-px bg-border" />
          <DM.Item asChild><Link href="/holatlar" className={item}><Check className="h-4 w-4" />Holatlar namunasi</Link></DM.Item>
          <DM.Item asChild><Link href="/kirish" className={item}><LogOut className="h-4 w-4" />Kirish / Chiqish</Link></DM.Item>
        </DM.Content>
      </DM.Portal>
    </DM.Root>
  );
}

function ThemeToggle() {
  const [dark, setDark] = React.useState(false);
  React.useEffect(() => { try { setDark(localStorage.getItem("u360-theme") === "dark"); } catch {} }, []);
  React.useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    try { localStorage.setItem("u360-theme", dark ? "dark" : "light"); } catch {}
  }, [dark]);
  return <Button variant="ghost" size="icon" onClick={() => setDark((d) => !d)} aria-label={dark ? "Yorug' rejim" : "Qorong'u rejim"}>{dark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}</Button>;
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const [more, setMore] = React.useState(false);
  const [search, setSearch] = React.useState(false);
  React.useEffect(() => {
    const h = (e: KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setSearch(true); } };
    window.addEventListener("keydown", h); return () => window.removeEventListener("keydown", h);
  }, []);
  return (
    <ToastProvider>
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[70] focus:rounded-lg focus:bg-primary focus:px-3 focus:py-2 focus:text-white">Asosiy kontentga o'tish</a>
      <Sidebar />
      <div className="lg:pl-64">
        <div className="bg-amber/15 px-4 py-1.5 text-center text-xs font-semibold text-foreground">
          PROTOTIP: kirish, profil, dashboard, diagnostika, xatolar va bilim xaritasi haqiqiy backend bilan ishlaydi. AI yordamchi va dars ishlanmasi server kaliti ulangach ishlaydi. Qolgan bo'limlar namunaviy (demo); to'lov ulanmagan.
        </div>
        <header className="sticky top-0 z-20 flex h-16 items-center gap-2 border-b border-border bg-background/90 px-4 backdrop-blur sm:gap-3 lg:px-8">
          <Logo className="lg:hidden" />
          <div className="hidden min-w-0 flex-1 lg:block"><Breadcrumb /></div>
          <div className="flex-1 lg:hidden" />
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setMore(true)} aria-label="Barcha xizmatlar"><Grid2x2 className="h-5 w-5" /></Button>
          <button onClick={() => setSearch(true)} className="hidden h-10 w-64 items-center gap-2 rounded-xl border border-border bg-card px-3 text-sm text-muted-foreground hover:bg-muted md:flex" aria-label="Global qidiruv">
            <Search className="h-4 w-4" aria-hidden />Qidirish...<kbd className="ml-auto rounded bg-muted px-1.5 text-[11px]">Ctrl K</kbd>
          </button>
          <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setSearch(true)} aria-label="Qidirish"><Search className="h-5 w-5" /></Button>
          <Button asChild variant="outline" size="sm" className="hidden sm:inline-flex"><Link href="/ai"><Sparkles className="h-4 w-4 text-primary" aria-hidden />AI yordamchi</Link></Button>
          <Button asChild variant="ghost" size="icon" className="sm:hidden"><Link href="/ai" aria-label="AI yordamchi"><Sparkles className="h-5 w-5 text-primary" /></Link></Button>
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
    </ToastProvider>
  );
}
