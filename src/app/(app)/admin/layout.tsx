import { ModuleLayout } from "@/components/layout/module-layout";
import { SubNav } from "@/components/layout/sub-nav";
import { AdminGate } from "@/components/admin/admin-gate";
// Admin panelida o'nta bo'lim bor va umumiy sahifa ularning hammasiga o'tkazmaydi, shuning uchun faqat shu yerda tab qatori saqlangan.
export default function Layout({ children }: { children: React.ReactNode }) { return <ModuleLayout><SubNav /><AdminGate>{children}</AdminGate></ModuleLayout>; }
