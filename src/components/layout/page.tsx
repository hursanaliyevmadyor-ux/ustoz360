import { cn } from "@/lib/utils";
import type { Module } from "@/lib/modules";
import { Card } from "@/components/ui/card";
import { TrendingUp, TrendingDown } from "lucide-react";
import { DemoBadge } from "@/components/ui/badge";

export function PageHeader({ title, description, actions, module, demo }: { title: string; description?: string; actions?: React.ReactNode; module?: Module; demo?: boolean }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="flex items-center gap-3.5">
        {module && <span className={cn("grid h-12 w-12 shrink-0 place-items-center rounded-2xl text-white", module.bg)}><module.icon className="h-6 w-6" aria-hidden /></span>}
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight sm:text-[1.75rem]">{title}{demo && <DemoBadge className="ml-2 align-middle" />}</h1>
          {description && <p className="mt-0.5 text-muted-foreground">{description}</p>}
        </div>
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function StatCard({ label, value, delta, icon: Icon, tone = "blue" }: { label: string; value: string; delta?: string; icon: React.ElementType; tone?: "blue" | "teal" | "amber" | "violet" | "rose" }) {
  const tones = { blue: "bg-primary/10 text-primary", teal: "bg-teal/10 text-teal", amber: "bg-amber/15 text-amber", violet: "bg-[#7C3AED]/10 text-[#7C3AED]", rose: "bg-[#E11D48]/10 text-[#E11D48]" };
  const down = delta?.startsWith("-");
  return (
    <Card className="p-5">
      <div className="flex items-center gap-3">
        <span className={cn("grid h-11 w-11 place-items-center rounded-xl", tones[tone])}><Icon className="h-5 w-5" aria-hidden /></span>
        <p className="text-sm text-muted-foreground">{label}</p>
      </div>
      <p className="mt-3 break-words text-xl font-extrabold leading-tight tracking-tight sm:text-2xl">{value}</p>
      {delta && <p className={cn("mt-1 flex items-center gap-1 text-xs font-semibold", down ? "text-danger" : "text-success")}>{down ? <TrendingDown className="h-3.5 w-3.5" /> : <TrendingUp className="h-3.5 w-3.5" />}{delta}</p>}
    </Card>
  );
}
