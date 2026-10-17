"use client";
import * as React from "react";

export type Me = { id: string; name: string | null; email: string | null; roles: string[]; onboarded: boolean; plan: string } | null;
export type PublicSettings = { siteName: string; supportContact: string; modules: Record<string, boolean>; paymentsMode: "off" | "manual" | "provider"; aiDisclaimer: string };
type Ctx = { me: Me; ready: boolean; pub: PublicSettings | null; isAdmin: boolean };

const ShellCtx = React.createContext<Ctx>({ me: null, ready: false, pub: null, isAdmin: false });
export const useShell = () => React.useContext(ShellCtx);

/** Foydalanuvchi va ochiq sozlamalar bir marta yuklanadi (yon menyu, yuqori panel va bildirishnomalar umumiy foydalanadi). */
export function ShellProvider({ children, onLoaded }: { children: React.ReactNode; onLoaded?: (me: Me) => void }) {
  const [state, setState] = React.useState<Ctx>({ me: null, ready: false, pub: null, isAdmin: false });
  React.useEffect(() => {
    let live = true;
    Promise.all([
      fetch("/api/me").then((r) => r.json()).then((d) => (d.user ?? null) as Me).catch(() => null),
      fetch("/api/settings/public").then((r) => (r.ok ? r.json() : null)).catch(() => null) as Promise<PublicSettings | null>,
    ]).then(([me, pub]) => {
      if (!live) return;
      setState({ me, pub, ready: true, isAdmin: !!me?.roles.some((r) => r === "ADMIN" || r === "SUPERADMIN") });
      onLoaded?.(me);
    });
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return <ShellCtx.Provider value={state}>{children}</ShellCtx.Provider>;
}
