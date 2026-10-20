"use client";
import * as React from "react";
import { cn } from "@/lib/utils";

const initialsOf = (label: string) => label.split(/[\s._-]+/).filter(Boolean).map((w) => w[0]).join("").slice(0, 2).toUpperCase() || "?";

/**
 * Yagona avatar komponenti (profil, yon menyu, reyting, podium): rasm bo'lsa dumaloq rasm, bo'lmasa yoki yuklanmasa bosh harflar.
 * `tone`: «dark» — to'q fonda (yon menyu), «primary» — oddiy, «soft» — kartalarda.
 */
export function Avatar({ src, name, size = 40, tone = "primary", className }: { src?: string | null; name: string; size?: number; tone?: "primary" | "dark" | "soft"; className?: string }) {
  const [failed, setFailed] = React.useState(false);
  React.useEffect(() => { setFailed(false); }, [src]);
  const style = { width: size, height: size, fontSize: Math.max(11, Math.round(size * 0.38)) };
  const base = "inline-grid shrink-0 place-items-center overflow-hidden rounded-full font-bold select-none";
  if (src && !failed) {
    return (
      // Himoyalangan rasm (kirish kerak): next/image sozlamalarisiz oddiy <img>.
      // eslint-disable-next-line @next/next/no-img-element
      <img src={src} alt="" width={size} height={size} loading="lazy" onError={() => setFailed(true)} style={style} className={cn(base, "object-cover", className)} />
    );
  }
  return (
    <span aria-hidden style={style} className={cn(base, tone === "dark" ? "bg-white/15 text-white" : tone === "soft" ? "bg-muted text-foreground" : "bg-primary/10 text-primary", className)}>{initialsOf(name)}</span>
  );
}
