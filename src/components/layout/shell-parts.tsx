"use client";
import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell, BookOpen, Moon, Sun } from "lucide-react";
import * as DM from "@radix-ui/react-dropdown-menu";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useShell } from "./shell-context";

/** Ikkala qobiq (ustoz va admin) uchun umumiy qismlar. */

/** Sayt nomi sozlamalardan keladi (standart «USTOZ 360»): oxirgi so'z urg'u rangida. */
export function Logo({ className, dark, href = "/dashboard", suffix }: { className?: string; dark?: boolean; href?: string; suffix?: string }) {
  const { pub } = useShell();
  const name = (pub?.siteName || "USTOZ 360").trim();
  const parts = name.split(/\s+/);
  const head = parts.length > 1 ? parts.slice(0, -1).join(" ") : name;
  const tail = parts.length > 1 ? parts[parts.length - 1] : "";
  return (
    <Link href={href} className={cn("flex shrink-0 items-center gap-2.5 whitespace-nowrap", className)} aria-label={`${name}${suffix ? ` ${suffix}` : ""} bosh sahifa`}>
      <BookOpen className={cn("h-8 w-8", dark ? "text-[#7FA2FF]" : "text-primary")} strokeWidth={2.2} aria-hidden />
      <span className={cn("text-lg font-black tracking-tight min-[380px]:text-xl", dark ? "text-white" : "text-foreground")}>{head}{tail && <> <span className={dark ? "text-[#7FA2FF]" : "text-primary"}>{tail}</span></>}</span>
      {suffix && <span className={cn("rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider", dark ? "bg-white/15 text-white" : "bg-primary/10 text-primary")}>{suffix}</span>}
    </Link>
  );
}

export const initialsOf = (label: string) => label.split(" ").filter(Boolean).map((w) => w[0]).join("").slice(0, 2).toUpperCase() || "?";

type Notif = { id: string; kind: string; title: string; text: string; href: string | null; unread: boolean; createdAt: string };
function ago(iso: string) {
  const m = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (m < 1) return "hozir";
  if (m < 60) return `${m} daqiqa oldin`;
  if (m < 1440) return `${Math.round(m / 60)} soat oldin`;
  return `${Math.round(m / 1440)} kun oldin`;
}

/** Haqiqiy bildirishnomalar (bazadan). Kirmagan foydalanuvchida qo'ng'iroq ko'rinmaydi. */
export function Notifications() {
  const { me } = useShell();
  const router = useRouter();
  const [items, setItems] = React.useState<Notif[]>([]); const [state, setState] = React.useState<"idle" | "loading" | "error">("idle");
  const load = React.useCallback(() => {
    setState("loading");
    fetch("/api/notifications").then(async (r) => { if (!r.ok) throw new Error(); const d = await r.json(); setItems(d.items); setState("idle"); }).catch(() => setState("error"));
  }, []);
  React.useEffect(() => { if (me) load(); }, [me, load]);
  if (!me) return null;
  const unread = items.filter((i) => i.unread).length;
  const read = (ids?: string[]) => {
    setItems((s) => s.map((i) => (!ids || ids.includes(i.id) ? { ...i, unread: false } : i)));
    void fetch("/api/notifications", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(ids ? { ids } : {}) }).catch(() => {});
  };
  return (
    <DM.Root onOpenChange={(o) => { if (o) load(); }}>
      <DM.Trigger asChild>
        <Button variant="ghost" size="icon" aria-label={`Bildirishnomalar${unread ? `, ${unread} ta yangi` : ""}`} className="relative">
          <Bell className="h-5 w-5" aria-hidden />
          {unread > 0 && <span className="absolute right-1.5 top-1.5 h-2.5 w-2.5 rounded-full bg-danger ring-2 ring-card" />}
        </Button>
      </DM.Trigger>
      <DM.Portal>
        <DM.Content align="end" sideOffset={8} className="z-50 max-h-[70vh] w-[min(360px,calc(100vw-24px))] overflow-y-auto rounded-2xl border border-border bg-card p-2 shadow-pop">
          <div className="flex items-center justify-between px-3 py-2">
            <p className="font-bold">Bildirishnomalar</p>
            {unread > 0 && <button className="min-h-9 text-xs font-semibold text-primary" onClick={() => read()}>Hammasini o'qildi qilish</button>}
          </div>
          {state === "loading" && items.length === 0 && <p className="px-3 py-6 text-center text-sm text-muted-foreground">Yuklanmoqda...</p>}
          {state === "error" && <p className="px-3 py-6 text-center text-sm text-danger">Yuklab bo'lmadi. Keyinroq urinib ko'ring.</p>}
          {state === "idle" && items.length === 0 && <p className="px-3 py-6 text-center text-sm text-muted-foreground">Hozircha yangilik yo'q.</p>}
          {items.map((n) => (
            <DM.Item key={n.id} onSelect={() => { if (n.unread) read([n.id]); if (n.href) router.push(n.href); }}
              className="flex min-h-11 cursor-pointer gap-3 rounded-xl px-3 py-2.5 outline-none data-[highlighted]:bg-muted">
              <span className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", n.unread ? "bg-primary" : "bg-transparent")} />
              <div><p className="text-sm font-semibold">{n.title}</p><p className="text-sm text-muted-foreground">{n.text}</p><p className="mt-0.5 text-xs text-muted-foreground">{ago(n.createdAt)}</p></div>
            </DM.Item>
          ))}
        </DM.Content>
      </DM.Portal>
    </DM.Root>
  );
}

export function ThemeToggle() {
  const [dark, setDark] = React.useState(false);
  React.useEffect(() => { try { setDark(localStorage.getItem("u360-theme") === "dark"); } catch {} }, []);
  React.useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    try { localStorage.setItem("u360-theme", dark ? "dark" : "light"); } catch {}
  }, [dark]);
  return <Button variant="ghost" size="icon" onClick={() => setDark((d) => !d)} aria-label={dark ? "Yorug' rejim" : "Qorong'u rejim"}>{dark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}</Button>;
}

export async function signOut() {
  await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
  try { localStorage.removeItem("u360-admin-hint"); } catch { /* */ }
  window.location.href = "/kirish";
}
