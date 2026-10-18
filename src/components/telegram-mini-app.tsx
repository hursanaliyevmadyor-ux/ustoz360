"use client";
import * as React from "react";
import { usePathname } from "next/navigation";

/**
 * Telegram Mini App: sayt bot ichida ochilganda (Telegram initData bergan bo'lsa) foydalanuvchi o'zi kiradi, ilova to'liq ekranga
 * kengayadi va Telegram "Orqaga" tugmasi sahifalar bo'ylab ishlaydi. Oddiy brauzerda hech narsa qilmaydi.
 */
type TgWebApp = {
  initData: string;
  colorScheme?: "light" | "dark";
  ready(): void; expand(): void; close(): void;
  disableVerticalSwipes?(): void; setHeaderColor?(c: string): void;
  BackButton?: { show(): void; hide(): void; onClick(cb: () => void): void; offClick(cb: () => void): void };
};
declare global { interface Window { Telegram?: { WebApp?: TgWebApp } } }

const getTg = (): TgWebApp | null => (typeof window !== "undefined" && window.Telegram?.WebApp?.initData ? window.Telegram.WebApp : null);
const ROOTS = new Set(["/", "/dashboard", "/kirish", "/admin"]);

export function TelegramMiniApp() {
  const path = usePathname();
  const [state, setState] = React.useState<{ s: "idle" | "auth" | "error"; msg?: string }>({ s: "idle" });
  const started = React.useRef(false);

  const login = React.useCallback(async (tg: TgWebApp) => {
    setState({ s: "auth" });
    try {
      const r = await fetch("/api/auth/telegram/webapp", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ initData: tg.initData }) });
      const d = (await r.json().catch(() => ({}))) as { error?: string; already?: boolean; next?: string | null };
      if (!r.ok) { setState({ s: "error", msg: d.error || "Kirib bo'lmadi. Ilovani botdan qayta oching." }); return; }
      if (d.already) { setState({ s: "idle" }); return; }
      // Yangi sessiya ochildi: sahifa qayta yuklanadi (kirish/bosh sahifada bo'lsa, ro'yxatdan o'tish holatiga mos sahifaga o'tadi).
      const here = window.location.pathname;
      window.location.replace(here === "/" || here === "/kirish" ? d.next ?? "/dashboard" : here + window.location.search);
    } catch { setState({ s: "error", msg: "Ulanishda xato. Internetni tekshirib, qayta urinib ko'ring." }); }
  }, []);

  React.useEffect(() => {
    const start = () => {
      const tg = getTg();
      if (!tg || started.current) return;
      started.current = true;
      document.documentElement.classList.add("tg-app");
      try { tg.ready(); tg.expand(); tg.disableVerticalSwipes?.(); tg.setHeaderColor?.("#122B49"); } catch { /* eski Telegram versiyasi */ }
      // Foydalanuvchi mavzuni o'zi tanlamagan bo'lsa, Telegram'ning qorong'u rejimiga moslanadi.
      try { if (tg.colorScheme === "dark" && !localStorage.getItem("u360-theme")) document.documentElement.classList.add("dark"); } catch { /* */ }
      void login(tg);
    };
    start();
    // Telegram skripti keyinroq yuklanishi mumkin: yuklagich shu hodisani yuboradi.
    window.addEventListener("u360-tg-ready", start);
    return () => window.removeEventListener("u360-tg-ready", start);
  }, [login]);

  // Telegram'ning "Orqaga" tugmasi: bosh sahifadan boshqa joyda ko'rinadi.
  React.useEffect(() => {
    const bb = getTg()?.BackButton;
    if (!bb) return;
    if (ROOTS.has(path)) { bb.hide(); return; }
    const back = () => window.history.back();
    bb.show(); bb.onClick(back);
    return () => bb.offClick(back);
  }, [path]);

  if (state.s === "idle") return null;
  return (
    <div role={state.s === "error" ? "alert" : "status"} className="fixed inset-0 z-[100] grid place-items-center bg-background p-6 text-center">
      {state.s === "auth" ? (
        <div className="space-y-3">
          <div className="mx-auto h-9 w-9 animate-spin rounded-full border-4 border-primary/20 border-t-primary" aria-hidden />
          <p className="font-bold">USTOZ 360</p>
          <p className="text-sm text-muted-foreground">Kirilmoqda…</p>
        </div>
      ) : (
        <div className="max-w-xs space-y-4">
          <p className="text-lg font-extrabold">Kirib bo'lmadi</p>
          <p className="text-sm text-muted-foreground">{state.msg}</p>
          <div className="flex flex-col gap-2">
            <button className="min-h-11 rounded-xl bg-primary px-4 font-semibold text-white" onClick={() => { const tg = getTg(); if (tg) void login(tg); }}>Qayta urinish</button>
            <button className="min-h-11 rounded-xl border border-border px-4 font-semibold" onClick={() => getTg()?.close()}>Botga qaytish</button>
          </div>
        </div>
      )}
    </div>
  );
}
