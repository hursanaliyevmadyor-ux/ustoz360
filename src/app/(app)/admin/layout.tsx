import { AdminGate } from "@/components/admin/admin-gate";

// Admin sayti o'z qobig'iga (menyu va yuqori panel) ega: AppShell admin akkauntda AdminShell'ni tanlaydi. Bu yerda faqat kirish tekshiruvi.
export default function Layout({ children }: { children: React.ReactNode }) { return <AdminGate>{children}</AdminGate>; }
