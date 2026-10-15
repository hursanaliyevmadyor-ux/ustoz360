import { ToastProvider } from "@/components/ui/toast";

export const metadata = { title: "Kirish — USTOZ 360" };

export default function Layout({ children }: { children: React.ReactNode }) {
  return <ToastProvider>{children}</ToastProvider>;
}
