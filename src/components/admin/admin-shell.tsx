"use client";
import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ChevronRight, GraduationCap, LogOut, Menu, UserCog } from "lucide-react";
import * as DM from "@radix-ui/react-dropdown-menu";
import { ADMIN_NAV, adminItemFor } from "@/lib/admin-nav";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { ToastProvider } from "@/components/ui/toast";
import { Logo, Notifications, ThemeToggle, initialsOf, signOut } from "@/components/layout/shell-parts";
import { useShell } from "@/components/layout/shell-context";

/**
 * Admin sayti: ustoz qobig'idan butunlay alohida (o'z menyusi va yuqori paneli). Ustoz bo'limlari bu yerda ko'rinmaydi;
 * ustoz saytini ko'rish uchun «Ustoz ko'rinishi» tugmasi bor.
 */
function NavList({ onNavigate, dark }: { onNavigate?: () => void; dark?: boolean }) {
  const path = usePathname();
  const cur = adminItemFor(path)?.href;
  return (
    <nav aria-label="Admin menyusi" className="space-y-4">
      {ADMIN_NAV.map((g) => (
        <div key={g.title}>
          <p className={cn("px-3 pb-1 text-[11px] font-bold uppercase tracking-wider", dark ? "text-white/40" : "text-muted-foreground")}>{g.title}</p>
          <ul className="space-y-0.5">{g.items.map((i) => {
            const on = cur === i.href;
            return (
              <li key={i.href}>
                <Link href={i.href} onClick={onNavigate} aria-current={on ? "page" : undefined}
                  className={cn("flex min-h-11 items-center gap-3 rounded-xl px-3 py-2 text-sm font-semibold transition-colors",
                    dark ? (on ? "bg-primary text-white shadow-soft" : "text-white/75 hover:bg-white/10 hover:text-white") : (on ? "bg-primary text-white" : "hover:bg-muted"))}>
                  <i.icon className="h-[18px] w-[18px] shrink-0" aria-hidden /><span className="truncate">{i.label}</span>
                </Link>
              </li>);
          })}</ul>
        </div>))}
    </nav>
  );
}

function Breadcrumb() {
  const path = usePathname();
  const item = adminItemFor(path);
  return (
    <ol className="flex min-w-0 items-center gap-1 text-xs uppercase tracking-wide" aria-label="Breadcrumb">
      <li className="text-muted-foreground">Admin</li>
      {item && item.href !== "/admin" && <><li aria-hidden><ChevronRight className="h-3.5 w-3.5 text-muted-foreground" /></li><li className="truncate font-bold text-foreground" aria-current="page">{item.label}</li></>}
      {(!item || item.href === "/admin") && <><li aria-hidden><ChevronRight className="h-3.5 w-3.5 text-muted-foreground" /></li><li className="font-bold text-foreground" aria-current="page">Dashboard</li></>}
    </ol>
  );
}

function AdminMenu() {
  const { me, setView } = useShell();
  const router = useRouter();
  const label = me?.name ?? me?.email ?? "Administrator";
  const item = "flex min-h-11 cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2 text-sm outline-none data-[highlighted]:bg-muted";
  return (
    <DM.Root>
      <DM.Trigger asChild>
        <button className="flex items-center gap-2.5 rounded-xl p-1 pr-2 hover:bg-muted" aria-label="Admin menyusi">
          <span className="grid h-9 w-9 place-items-center rounded-full bg-primary/10 text-sm font-bold text-primary">{initialsOf(label)}</span>
          <span className="hidden text-left leading-tight md:block"><span className="block max-w-[160px] truncate text-sm font-bold">{label}</span><span className="block text-xs text-muted-foreground">{me?.roles.includes("SUPERADMIN") ? "Bosh administrator" : "Administrator"}</span></span>
        </button>
      </DM.Trigger>
      <DM.Portal>
        <DM.Content align="end" sideOffset={8} className="z-50 w-60 rounded-2xl border border-border bg-card p-1.5 shadow-pop">
          <DM.Item onSelect={() => { setView("teacher"); router.push("/dashboard"); }} className={item}><GraduationCap className="h-4 w-4" />Ustoz ko'rinishi</DM.Item>
          <DM.Separator className="my-1 h-px bg-border" />
          <DM.Item onSelect={signOut} className={item}><LogOut className="h-4 w-4" />Chiqish</DM.Item>
        </DM.Content>
      </DM.Portal>
    </DM.Root>
  );
}

export function AdminShell({ children }: { children: React.ReactNode }) {
  const [menu, setMenu] = React.useState(false);
  const { setView } = useShell();
  const router = useRouter();
  const toTeacher = () => { setView("teacher"); router.push("/dashboard"); };
  return (
    <ToastProvider>
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[70] focus:rounded-lg focus:bg-primary focus:px-3 focus:py-2 focus:text-white">Asosiy kontentga o'tish</a>
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col bg-side p-4 text-white lg:flex">
        <Logo dark href="/admin" suffix="Admin" className="px-2 pb-6 pt-1" />
        <div className="flex-1 overflow-y-auto"><NavList dark /></div>
        <Button variant="secondary" className="mt-3 w-full justify-start bg-white/10 text-white hover:bg-white/20" onClick={toTeacher}><GraduationCap className="h-4 w-4" />Ustoz ko'rinishi</Button>
      </aside>
      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-2 border-b border-border bg-background/90 px-3 backdrop-blur min-[380px]:px-4 sm:gap-3 lg:px-8">
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setMenu(true)} aria-label="Menyuni ochish"><Menu className="h-5 w-5" /></Button>
          <Logo href="/admin" suffix="Admin" className="lg:hidden [&>span:first-of-type]:hidden min-[420px]:[&>span:first-of-type]:inline" />
          <div className="hidden min-w-0 flex-1 lg:block"><Breadcrumb /></div>
          <div className="flex-1 lg:hidden" />
          <Button variant="outline" size="sm" className="hidden sm:inline-flex" onClick={toTeacher}><UserCog className="h-4 w-4" />Ustoz ko'rinishi</Button>
          <ThemeToggle />
          <Notifications />
          <AdminMenu />
        </header>
        <div className="border-b border-border bg-background px-4 py-2 lg:hidden"><Breadcrumb /></div>
        <main id="main" className="mx-auto w-full max-w-[1280px] px-4 pb-16 pt-6 lg:px-8">{children}</main>
      </div>
      <Dialog open={menu} onOpenChange={setMenu}>
        <DialogContent title="Admin menyusi" description="Barcha boshqaruv bo'limlari" className="max-h-[85vh] overflow-y-auto">
          <NavList onNavigate={() => setMenu(false)} />
          <Button variant="outline" className="mt-4 w-full" onClick={() => { setMenu(false); toTeacher(); }}><GraduationCap className="h-4 w-4" />Ustoz ko'rinishi</Button>
        </DialogContent>
      </Dialog>
    </ToastProvider>
  );
}
