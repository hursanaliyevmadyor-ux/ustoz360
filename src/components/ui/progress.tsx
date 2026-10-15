import { cn } from "@/lib/utils";
export function Progress({ value, className, barClass, label }: { value: number; className?: string; barClass?: string; label?: string }) {
  const v = Math.max(0, Math.min(100, value));
  return (
    <div role="progressbar" aria-valuenow={v} aria-valuemin={0} aria-valuemax={100} aria-label={label} className={cn("h-2 w-full overflow-hidden rounded-full bg-muted", className)}>
      <div className={cn("h-full rounded-full bg-primary transition-all", barClass)} style={{ width: `${v}%` }} />
    </div>
  );
}
