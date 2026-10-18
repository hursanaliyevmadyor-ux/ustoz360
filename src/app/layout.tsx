import type { Metadata, Viewport } from "next";
import "./globals.css";
import { TelegramMiniApp } from "@/components/telegram-mini-app";

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
        {/* Telegram Mini App skripti faqat Telegram ichida yuklanadi (manzilda tgWebAppData yoki oldingi sessiya ma'lumoti bo'lsa). */}
        <script dangerouslySetInnerHTML={{ __html: `try{if(location.hash.indexOf("tgWebAppData")>=0||sessionStorage.getItem("__telegram__initParams")){var s=document.createElement("script");s.src="https://telegram.org/js/telegram-web-app.js";s.onload=function(){window.dispatchEvent(new Event("u360-tg-ready"))};document.head.appendChild(s)}}catch(e){}` }} />
      </head>
      <body className="font-sans"><TelegramMiniApp />{children}</body>
    </html>
  );
}
