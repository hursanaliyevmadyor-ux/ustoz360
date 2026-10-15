"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/layout/page";
import { Card, CardContent } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

type Mode = "login" | "register";

const ERRORS: Record<string, string> = {
  google: "Google orqali kirib bo'lmadi. Qayta urinib ko'ring yoki email va parol bilan kiring.",
  google_yoq: "Google orqali kirish hali sozlanmagan.",
  yandex: "Yandex orqali kirib bo'lmadi. Qayta urinib ko'ring yoki email va parol bilan kiring.",
  yandex_yoq: "Yandex orqali kirish hali sozlanmagan.",
  telegram: "Telegram orqali kirib bo'lmadi. Qayta urinib ko'ring.",
};

function GoogleIcon() {
  return (
    <svg viewBox="0 0 48 48" className="h-5 w-5" aria-hidden>
      <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.6 5.9c4.4-4.1 7-10.1 7-17.6z" />
      <path fill="#FBBC05" d="M10.5 28.7a14.5 14.5 0 0 1 0-9.4l-7.9-6.1a24 24 0 0 0 0 21.6l7.9-6.1z" />
      <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.6-5.9c-2.1 1.4-4.9 2.3-8.3 2.3-6.3 0-11.6-4.1-13.5-9.8l-7.9 6.1C6.5 42.6 14.6 48 24 48z" />
    </svg>
  );
}

/** Telegram Login Widget: rasmiy skript tugmani o'zi chizadi, ma'lumotni serverga GET bilan yuboradi. */
function TelegramButton({ bot }: { bot: string }) {
  const ref = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    const host = ref.current; if (!host) return;
    host.innerHTML = "";
    const s = document.createElement("script");
    s.src = "https://telegram.org/js/telegram-widget.js?22"; s.async = true;
    s.setAttribute("data-telegram-login", bot); s.setAttribute("data-size", "large"); s.setAttribute("data-radius", "12");
    s.setAttribute("data-auth-url", `${location.origin}/api/auth/telegram/callback`); s.setAttribute("data-request-access", "write");
    host.appendChild(s);
  }, [bot]);
  return <div ref={ref} className="flex min-h-[40px] justify-center" aria-label="Telegram orqali kirish" />;
}

export default function Page() {
  const router = useRouter(); const toast = useToast();
  const [mode, setMode] = React.useState<Mode>("login");
  const [name, setName] = React.useState(""); const [email, setEmail] = React.useState(""); const [password, setPassword] = React.useState("");
  const [busy, setBusy] = React.useState(false); const [err, setErr] = React.useState("");
  const [who, setWho] = React.useState<{ name: string | null; email: string | null } | null>(null);
  React.useEffect(() => { fetch("/api/me").then((r) => r.json()).then((d) => setWho(d.user)).catch(() => {}); }, []);
  const [providers, setProviders] = React.useState<{ google: boolean; yandex: boolean; telegram: string | null }>({ google: false, yandex: false, telegram: null });
  React.useEffect(() => {
    fetch("/api/auth/providers").then((r) => r.json()).then(setProviders).catch(() => {});
    const x = new URLSearchParams(location.search).get("xato"); if (x && ERRORS[x]) setErr(ERRORS[x]);
  }, []);
  const logout = async () => { await fetch("/api/auth/logout", { method: "POST" }); setWho(null); toast("success", "Tizimdan chiqdingiz."); router.refresh(); };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setErr("");
    try {
      const r = await fetch(`/api/auth/${mode}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(mode === "register" ? { email, password, name: name || undefined } : { email, password }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setErr(d.error ?? "Server bilan aloqa yo'q (backend ulanmagan bo'lishi mumkin)."); return; }
      toast("success", mode === "register" ? "Akkaunt yaratildi. Xush kelibsiz!" : "Xush kelibsiz!");
      router.push("/dashboard"); router.refresh();
    } catch { setErr("Server bilan aloqa yo'q."); } finally { setBusy(false); }
  };

  return (
    <>
      <PageHeader title="Kirish / Ro'yxatdan o'tish" description="Google, Yandex, Telegram yoki email va parol orqali" />
      <Card className="max-w-md"><CardContent>
        {who ? (
          <div className="space-y-4"><p className="text-sm">Siz tizimdasiz: <b>{who.name ?? who.email}</b></p>
            <Button className="w-full" onClick={() => router.push("/dashboard")}>Bosh sahifaga</Button><Button variant="outline" className="w-full" onClick={logout}>Chiqish</Button></div>
        ) : (
          <>
            <div role="tablist" aria-label="Kirish turi" className="mb-5 grid grid-cols-2 gap-1 rounded-xl bg-muted p-1">
              {(["login", "register"] as const).map((m) => (
                <button key={m} role="tab" aria-selected={mode === m} type="button" onClick={() => { setMode(m); setErr(""); }}
                  className={cn("rounded-lg px-3 py-2 text-sm font-semibold", mode === m ? "bg-card shadow-soft" : "text-muted-foreground")}>{m === "login" ? "Kirish" : "Ro'yxatdan o'tish"}</button>))}
            </div>
            {(providers.google || providers.yandex || providers.telegram) && (
              <div className="mb-5 space-y-3">
                {providers.google && (
                  <Button asChild variant="outline" className="w-full"><a href="/api/auth/google/start"><GoogleIcon />Google (Gmail) bilan kirish</a></Button>
                )}
                {providers.yandex && (
                  <Button asChild variant="outline" className="w-full"><a href="/api/auth/yandex/start"><span aria-hidden className="mr-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-[#FC3F1D] text-xs font-bold text-white">Я</span>Yandex bilan kirish</a></Button>
                )}
                {providers.telegram && <TelegramButton bot={providers.telegram} />}
                <p className="flex items-center gap-3 pt-1 text-xs text-muted-foreground"><span className="h-px flex-1 bg-border" />yoki email bilan<span className="h-px flex-1 bg-border" /></p>
              </div>
            )}
            <form onSubmit={submit} className="space-y-4">
              {mode === "register" && <Field label="Ism familiya (ixtiyoriy)"><Input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" maxLength={80} /></Field>}
              <Field label="Email"><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required maxLength={254} /></Field>
              <Field label="Parol" hint={mode === "register" ? "Kamida 8 belgi" : undefined} error={err}>
                <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={mode === "register" ? "new-password" : "current-password"} required minLength={mode === "register" ? 8 : 1} maxLength={128} /></Field>
              <Button type="submit" loading={busy} className="w-full">{mode === "login" ? "Kirish" : "Akkaunt yaratish"}</Button>
            </form>
          </>
        )}
      </CardContent></Card>
    </>
  );
}
