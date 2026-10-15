import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold", {
  variants: {
    variant: {
      neutral: "bg-muted text-muted-foreground",
      blue: "bg-primary/10 text-primary",
      teal: "bg-teal/10 text-teal",
      amber: "bg-amber/15 text-amber",
      success: "bg-success/10 text-success",
      danger: "bg-danger/10 text-danger",
      navy: "bg-navy text-background",
    },
  },
  defaultVariants: { variant: "neutral" },
});
export function Badge({ className, variant, ...p }: React.HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ variant }), className)} {...p} />;
}

/** "Demo" belgisi ko'rsatilmaydi (egasining qarori). Komponent saqlab qolindi, shunda uni qaytarish bir joyda qilinadi. */
export function DemoBadge(_props: { className?: string }) {
  return null;
}
