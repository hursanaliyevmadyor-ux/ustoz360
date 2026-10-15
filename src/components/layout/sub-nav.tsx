"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { findAny } from "@/lib/modules";

export function SubNav() {
  const path = usePathname();
  const mod = findAny(path);
  if (!mod) return null;
  const active = [...mod.subs].reverse().find((s) => path === s.href || path.startsWith(s.href + "/"))?.href;
  return (
    <nav aria-label={`${mod.name} bo'limlari`} className="-mx-1 mb-6 overflow-x-auto px-1">
      <ul className="inline-flex gap-1 rounded-xl bg-muted p-1">
        {mod.subs.map((s) => (
          <li key={s.href}>
            <Link href={s.href} aria-current={active === s.href ? "page" : undefined}
              className={cn("block whitespace-nowrap rounded-lg px-3.5 py-1.5 text-sm font-semibold", active === s.href ? "bg-card text-foreground shadow-soft" : "text-muted-foreground hover:text-foreground")}>
              {s.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

