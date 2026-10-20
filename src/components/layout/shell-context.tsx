"use client";
import * as React from "react";

export type Me = { id: string; name: string | null; email: string | null; roles: string[]; onboarded: boolean; plan: string; nickname?: string | null; avatar?: string | null } | null;
export type PublicSettings = { siteName: string; supportContact: string; modules: Record<string, boolean>; paymentsMode: "off" | "manual" | "provider"; aiDisclaimer: string };
/** "admin": admin sayti (alohida qobiq). "teacher": admin ustoz bo'limini ko'rmoqda (yuqorida admin paneli bilan). */
export type ViewMode = "admin" | "teacher";
type Ctx = { me: Me; ready: boolean; pub: PublicSettings | null; isAdmin: boolean; view: ViewMode; setView: (v: ViewMode) => void; adminMode: boolean };

const ShellCtx = React.createContext<Ctx>({ me: null, ready: false, pub: null, isAdmin: false, view: "admin", setView: () => {}, adminMode: false });
export const useShell = () => React.useContext(ShellCtx);

const VIEW_KEY = "u360-view", HINT_KEY = "u360-admin-hint";
const read = (k: string) => { try { return localStorage.getItem(k); } catch { return null; } };
const write = (k: string, v: string | null) => { try { if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch { /* maxfiy rejim */ } };

/**
 * Foydalanuvchi va ochiq sozlamalar bir marta yuklanadi (yon menyu, yuqori panel va bildirishnomalar umumiy foydalanadi).
 * Admin bo'lsa standart ko'rinish: admin sayti. «Ustoz ko'rinishi» tanlovi brauzerda eslab qolinadi (xavfsizlikka aloqasi yo'q:
 * haqiqiy huquq doim serverda tekshiriladi). Yuklanish tugamaguncha oxirgi ma'lum holat (hint) bo'yicha qobiq tanlanadi.
 */
export function ShellProvider({ children, onLoaded }: { children: React.ReactNode; onLoaded?: (me: Me) => void }) {
  const [state, setState] = React.useState<{ me: Me; ready: boolean; pub: PublicSettings | null; isAdmin: boolean }>({ me: null, ready: false, pub: null, isAdmin: false });
  const [view, setViewState] = React.useState<ViewMode>("admin");
  const [hint, setHint] = React.useState(false);
  React.useEffect(() => {
    setViewState(read(VIEW_KEY) === "teacher" ? "teacher" : "admin");
    setHint(read(HINT_KEY) === "1");
    let live = true;
    Promise.all([
      fetch("/api/me").then((r) => r.json()).then((d) => (d.user ?? null) as Me).catch(() => null),
      fetch("/api/settings/public").then((r) => (r.ok ? r.json() : null)).catch(() => null) as Promise<PublicSettings | null>,
    ]).then(([me, pub]) => {
      if (!live) return;
      const isAdmin = !!me?.roles.some((r) => r === "ADMIN" || r === "SUPERADMIN");
      write(HINT_KEY, isAdmin ? "1" : null);
      setState({ me, pub, ready: true, isAdmin });
      onLoaded?.(me);
    });
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // Profil (rasm, nik) o'zgarganda yon menyu va yuqori paneldagi avatar yangilanadi.
  React.useEffect(() => {
    const refresh = () => { fetch("/api/me").then((r) => r.json()).then((d) => { if (d.user) setState((s) => ({ ...s, me: d.user as Me })); }).catch(() => {}); };
    window.addEventListener("u360-profile-updated", refresh);
    return () => window.removeEventListener("u360-profile-updated", refresh);
  }, []);
  const setView = React.useCallback((v: ViewMode) => { write(VIEW_KEY, v); setViewState(v); }, []);
  const adminMode = (state.ready ? state.isAdmin : hint) && view === "admin";
  return <ShellCtx.Provider value={{ ...state, view, setView, adminMode }}>{children}</ShellCtx.Provider>;
}
