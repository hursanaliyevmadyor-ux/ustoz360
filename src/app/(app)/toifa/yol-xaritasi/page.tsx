import { Check } from "lucide-react";
import { roadmapSteps } from "@/lib/demo";
import { modules } from "@/lib/modules";
import { PageHeader } from "@/components/layout/page";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export default function Page() {
  return (
    <>
      <PageHeader module={modules[2]} title="Yo'l xaritasi" description="Imtihongacha bosqichlar (namunaviy)" demo />
      <Card className="max-w-2xl p-6"><ol className="space-y-0">
        {roadmapSteps.map((s, i) => (
          <li key={s.t} className="relative flex gap-4 pb-6 last:pb-0">
            {i < roadmapSteps.length - 1 && <span className="absolute left-[15px] top-8 h-full w-0.5 bg-border" aria-hidden />}
            <span className={cn("z-10 grid h-8 w-8 shrink-0 place-items-center rounded-full text-sm font-bold", s.done ? "bg-teal text-white" : "bg-muted text-muted-foreground")}>{s.done ? <Check className="h-4 w-4" aria-label="Bajarildi" /> : i + 1}</span>
            <div><p className="font-bold">{s.t}</p><p className="text-sm text-muted-foreground">{s.d}</p></div>
          </li>))}
      </ol></Card>
    </>
  );
}
