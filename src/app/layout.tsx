import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "USTOZ 360 — o'qituvchi uchun yagona AI ta'lim platformasi",
  description: "USTOZ 360: o'qituvchi uchun diagnostika, bilim xaritasi, xatolar daftari va AI yordamchi.",
};
export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#122B49" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="uz" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: `try{if(localStorage.getItem("u360-theme")==="dark")document.documentElement.classList.add("dark")}catch(e){}` }} />
      </head>
      <body className="font-sans">{children}</body>
    </html>
  );
}
