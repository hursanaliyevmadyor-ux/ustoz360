"use client";
import * as T from "@radix-ui/react-tabs";
import { cn } from "@/lib/utils";

export const Tabs = T.Root;
export const TabsList = ({ className, ...p }: T.TabsListProps) => (
  <T.List className={cn("inline-flex max-w-full gap-1 overflow-x-auto rounded-xl bg-muted p-1", className)} {...p} />
);
export const TabsTrigger = ({ className, ...p }: T.TabsTriggerProps) => (
  <T.Trigger className={cn("whitespace-nowrap rounded-lg px-3.5 py-1.5 text-sm font-semibold text-muted-foreground data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-soft", className)} {...p} />
);
export const TabsContent = ({ className, ...p }: T.TabsContentProps) => <T.Content className={cn("mt-4", className)} {...p} />;
