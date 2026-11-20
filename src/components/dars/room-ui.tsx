"use client";
import * as React from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const initial = (n: string) => (n.trim()[0] ?? "?").toUpperCase();
const hue = (s: string) => { let h = 0; for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) % 360; return h; };

/** Ismning bosh harfi, ismga qarab rangli doira; gapirayotganda yashil halqa. */
export function Avatar({ name, speaking, size = 40, className }: { name: string; speaking?: boolean; size?: number; className?: string }) {
  const h = hue(name);
  return (
    <span aria-hidden className={cn("grid shrink-0 place-items-center rounded-full font-extrabold transition-shadow", speaking && "ring-4 ring-success/70", className)}
      style={{ width: size, height: size, fontSize: size * 0.42, backgroundColor: `hsl(${h} 70% 50% / 0.16)`, color: `hsl(${h} 60% 38%)` }}>
      {initial(name)}
    </span>
  );
}

/** Dars boshlanganidan beri o'tgan vaqt (00:12:30). Faqat shu qism har soniya yangilanadi. */
export function ElapsedChip({ since }: { since: number }) {
  const [now, setNow] = React.useState(since);
  React.useEffect(() => { setNow(Date.now()); const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  const s = Math.max(0, Math.floor((now - since) / 1000));
  const p = (n: number) => String(n).padStart(2, "0");
  return <span className="tabular-nums" title="Siz xonada bo'lgan vaqt">{p(Math.floor(s / 3600))}:{p(Math.floor((s % 3600) / 60))}:{p(s % 60)}</span>;
}

export type DockTone = "default" | "on" | "primary" | "danger" | "amber";
const TONES: Record<DockTone, string> = {
  default: "bg-muted text-foreground hover:bg-border",
  on: "bg-success text-white hover:bg-success/90",
  primary: "bg-primary text-white hover:bg-primary/90",
  danger: "bg-danger text-white hover:bg-danger/90",
  amber: "bg-amber text-white hover:bg-amber/90",
};

/** Pastki paneldagi aylana tugma: yuqorida belgi, pastida qisqa yozuv. */
export function DockButton({ icon, label, aria, tone = "default", pressed, loading, disabled, pulse, badge, hero, onClick }: {
  icon: React.ReactNode; label: string; aria?: string; tone?: DockTone; pressed?: boolean; loading?: boolean; disabled?: boolean; pulse?: boolean; badge?: number; hero?: boolean; onClick: () => void;
}) {
  return (
    <button type="button" aria-label={aria ?? label} aria-pressed={pressed} aria-busy={loading || undefined} disabled={disabled || loading} onClick={onClick}
      className="group flex w-[3.6rem] shrink-0 flex-col items-center gap-1 rounded-2xl px-0 py-1 text-[10px] font-bold leading-tight disabled:opacity-50 sm:w-[4.75rem] sm:px-0.5 sm:text-[11px]">
      <span className={cn("relative grid place-items-center rounded-full shadow-sm transition group-active:scale-95", hero ? "h-[3.25rem] w-[3.25rem] sm:h-14 sm:w-14" : "h-11 w-11 sm:h-12 sm:w-12", TONES[tone], hero && tone === "on" && "shadow-[0_0_0_5px_rgba(22,129,93,0.22)]", hero && tone === "primary" && "shadow-[0_6px_18px_rgba(56,103,244,0.45)]", pulse && "animate-pulse")}>
        {loading ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> : icon}
        {!!badge && <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-danger px-1 text-[11px] font-extrabold text-white ring-2 ring-card">{badge}</span>}
      </span>
      <span className="max-w-full truncate">{label}</span>
    </button>
  );
}
