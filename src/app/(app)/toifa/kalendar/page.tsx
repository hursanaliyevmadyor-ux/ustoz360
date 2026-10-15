"use client";
import * as React from "react";
import { events } from "@/lib/demo";
import { modules } from "@/lib/modules";
import { PageHeader } from "@/components/layout/page";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export default function Page() {
  const [sel, setSel] = React.useState<number | null>(14);
  const days = Array.from({ length: 31 }, (_, i) => i + 1);
  const ev = (d: number) => events.filter((e) => e.d === d);
  return (
    <>
      <PageHeader module={modules[2]} title="Tayyorgarlik kalendari" description="Namunaviy oy (sanalar taxminiy emas, faqat misol)" demo />
      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        <Card className="p-4">
          <div className="mb-2 grid grid-cols-7 gap-1 text-center text-xs font-bold text-muted-foreground">{["Du", "Se", "Ch", "Pa", "Ju", "Sh", "Ya"].map((d) => <span key={d}>{d}</span>)}</div>
          <div className="grid grid-cols-7 gap-1">
            {days.map((d) => (
              <button key={d} onClick={() => setSel(d)} aria-pressed={sel === d} aria-label={`${d}-kun${ev(d).length ? `, ${ev(d).length} ta voqea` : ""}`}
                className={cn("flex aspect-square flex-col items-center justify-center rounded-xl text-sm font-semibold hover:bg-muted", sel === d && "bg-teal text-white hover:bg-teal")}>
                {d}{ev(d).length > 0 && <span className={cn("mt-0.5 h-1.5 w-1.5 rounded-full", sel === d ? "bg-white" : "bg-teal")} />}
              </button>))}
          </div>
        </Card>
        <Card className="p-5"><p className="font-extrabold">{sel}-kun</p>
          {sel && ev(sel).length ? <ul className="mt-3 space-y-2">{ev(sel).map((e) => <li key={e.t} className="rounded-xl bg-teal/10 p-3 text-sm font-semibold text-teal">{e.t}</li>)}</ul>
            : <p className="mt-3 text-sm text-muted-foreground">Bu kunga vazifa yo'q.</p>}
        </Card>
      </div>
    </>
  );
}
