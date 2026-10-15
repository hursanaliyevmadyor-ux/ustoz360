"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { BarChart3, BookOpenCheck, Eye, EyeOff, Sparkles } from "lucide-react";
import { Field, Input } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

const ERRORS: Record<string, string> = {
  google: "Google orqali kirib bo'lmadi. Qayta urinib ko'ring.",
  google_yoq: "Google orqali kirish hali sozlanmagan.",
  yandex: "Yandex orqali kirib bo'lmadi. Qayta urinib ko'ring.",
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

function TelegramIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden>
      <circle cx="12" cy="12" r="12" fill="#27A7E7" />
      <path fill="#fff" d="M5.4 11.8l11.5-4.4c.5-.2 1 .1.8.9l-2 9.1c-.1.7-.6.8-1.1.5l-3-2.2-1.4 1.4c-.2.2-.3.3-.6.3l.2-3.1 5.6-5c.2-.2 0-.3-.4-.1L8.5 13.4l-3-.9c-.7-.2-.7-.7.1-.7z" />
    </svg>
  );
}

function Brand({ light }: { light?: boolean }) {
  return (
    <div className="flex items-center gap-2.5" aria-label="USTOZ 360">
      <span className={cn("grid h-10 w-10 place-items-center rounded-xl text-base font-extrabold", light ? "bg-white text-navy" : "bg-primary text-white")}>U</span>
      <span className={cn("text-xl font-extrabold tracking-tight", light && "text-white")}>USTOZ <span className={light ? "text-teal" : "text-primary"}>360</span></span>
    </div>
  );
}

function Showcase() {
  const items = [
    { icon: BookOpenCheck, title: "Diagnostika", text: "Bilim darajangizni aniqlang", delay: "0s" },
    { icon: BarChart3, title: "Bilim xaritasi", text: "Kuchli va zaif mavzular", delay: "-2s" },
    { icon: Sparkles, title: "AI yordamchi", text: "Dars va test g'oyalari", delay: "-4s" },
  ];
  return (
    <aside className="relative hidden overflow-hidden bg-navy p-12 text-white lg:flex lg:flex-col lg:justify-between" aria-hidden>
      <style>{`@keyframes u360-float{0%,100%{transform:translateY(0)}50%{transform:translateY(-10px)}}@media (prefers-reduced-motion:reduce){.u360-float{animation:none!important}}`}</style>
      <div className="pointer-events-none absolute -left-24 -top-24 h-80 w-80 rounded-full bg-primary/40 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-32 right-0 h-96 w-96 rounded-full bg-teal/25 blur-3xl" />
      <div className="relative"><Brand light /></div>
      <div className="relative space-y-8">
        <div>
          <h2 className="text-4xl font-extrabold leading-tight tracking-tight">Har bir dars —<br />aniq natija.</h2>
          <p className="mt-3 max-w-sm text-base text-white/70">O'qituvchi uchun yagona AI ta'lim platformasi: tayyorgarlik, tahlil va rivojlanish bir joyda.</p>
        </div>
        <ul className="space-y-3">
          {items.map((it) => (
            <li key={it.title} className="u360-float flex max-w-sm items-center gap-4 rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur"
              style={{ animation: "u360-float 6s ease-in-out infinite", animationDelay: it.delay }}>
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-white/15"><it.icon className="h-5 w-5" /></span>
              <span><b className="block text-sm">{it.title}</b><span className="text-sm text-white/65">{it.text}</span></span>
            </li>
          ))}
        </ul>
      </div>
      <p className="relative text-xs text-white/50">© USTOZ 360</p>
    </aside>
  );
}

type Mode = "login" | "register" | "verify" | "forgot" | "reset";

const TITLES: Record<Mode, { h: string; p: string }> = {
  login: { h: "Xush kelibsiz!", p: "Google, Telegram yoki email va parol bilan kiring." },
  register: { h: "Akkaunt yarating", p: "Emailingizni yozing va parol o'ylab toping. Tasdiqlash kodi emailingizga yuboriladi." },
  verify: { h: "Emailni tasdiqlang", p: "" },
  forgot: { h: "Parolni tiklash", p: "Emailingizni yozing, biz unga 6 xonali kod yuboramiz." },
  reset: { h: "Yangi parol", p: "" },
};

export default function Page() {
  const router = useRouter(); const toast = useToast();
  const [mode, setMode] = React.useState<Mode>("login");
  const [email, setEmail] = React.useState(""); const [password, setPassword] = React.useState(""); const [code, setCode] = React.useState("");
  const [show, setShow] = React.useState(false);
  const [busy, setBusy] = React.useState(false); const [err, setErr] = React.useState("");
  const [cooldown, setCooldown] = React.useState(0);
  const [who, setWho] = React.useState<{ name: string | null; email: string | null } | null>(null);
  React.useEffect(() => { fetch("/api/me").then((r) => r.json()).then((d) => { if (d.user && d.user.onboarded === false) { router.replace("/royxat"); return; } setWho(d.user); }).catch(() => {}); }, [router]);
  const [providers, setProviders] = React.useState<{ google: boolean; yandex: boolean; telegram: string | null }>({ google: false, yandex: false, telegram: null });
  React.useEffect(() => {
    fetch("/api/auth/providers").then((r) => r.json()).then(setProviders).catch(() => {});
    const x = new URLSearchParams(location.search).get("xato"); if (x && ERRORS[x]) setErr(ERRORS[x]);
  }, []);
  React.useEffect(() => { if (cooldown <= 0) return; const t = setTimeout(() => setCooldown((c) => c - 1), 1000); return () => clearTimeout(t); }, [cooldown]);
  const logout = async () => { await fetch("/api/auth/logout", { method: "POST" }); setWho(null); toast("success", "Tizimdan chiqdingiz."); router.refresh(); };

  const go = (m: Mode) => { setMode(m); setErr(""); setCode(""); if (m === "login" || m === "register") setShow(false); };
  const post = async (url: string, body: unknown) => {
    const r = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    const d = await r.json().catch(() => ({}));
    return { ok: r.ok, d } as { ok: boolean; d: { error?: string; code?: string; verify?: boolean; url?: string; pollKey?: string; status?: string; next?: string } };
  };
  const NET = "Server bilan aloqa yo'q. Internetni tekshirib, qayta urinib ko'ring.";

  // Telegram bot orqali kirish: havola ochiladi, foydalanuvchi botda Start bosadi, shu orada sahifa har 2 soniyada tekshiradi.
  const [tg, setTg] = React.useState<{ url: string; key: string } | null>(null);
  const [tgBusy, setTgBusy] = React.useState(false);
  const tgStart = async () => {
    if (tgBusy) return; setTgBusy(true); setErr("");
    const w = window.open("", "_blank"); // bosish paytida ochamiz, shunda brauzer oynani bloklamaydi
    try {
      const { ok, d } = await post("/api/auth/telegram/start", {});
      if (!ok || !d.url || !d.pollKey) { w?.close(); setErr(d.error ?? NET); return; }
      if (w) w.location.href = d.url;
      setTg({ url: d.url, key: d.pollKey });
    } catch { w?.close(); setErr(NET); } finally { setTgBusy(false); }
  };
  React.useEffect(() => {
    if (!tg) return;
    let alive = true;
    const iv = setInterval(async () => {
      try {
        const { d } = await post("/api/auth/telegram/poll", { pollKey: tg.key });
        if (!alive) return;
        if (d.status === "ok") { alive = false; clearInterval(iv); toast("success", "Xush kelibsiz!"); router.push(d.next ?? "/dashboard"); router.refresh(); }
        else if (d.status === "expired") { alive = false; clearInterval(iv); setTg(null); setErr("Telegram orqali kirish vaqti tugadi. Qayta urinib ko'ring."); }
      } catch { /* tarmoq vaqtincha uzilsa, keyingi urinish davom etadi */ }
    }, 2000);
    return () => { alive = false; clearInterval(iv); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tg]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setErr("");
    try {
      if (mode === "login") {
        const { ok, d } = await post("/api/auth/login", { email, password });
        if (!ok) { if (d.code === "unverified") { setMode("verify"); setErr(d.error ?? ""); } else setErr(d.error ?? NET); return; }
        toast("success", "Xush kelibsiz!"); router.push("/dashboard"); router.refresh();
      } else if (mode === "register") {
        const { ok, d } = await post("/api/auth/register", { email, password });
        if (!ok) { setErr(d.error ?? NET); return; }
        if (d.verify) { setMode("verify"); setCode(""); setCooldown(60); toast("success", "Kod emailingizga yuborildi."); }
        else { toast("success", "Akkaunt yaratildi!"); router.push("/royxat"); router.refresh(); }
      } else if (mode === "verify") {
        const { ok, d } = await post("/api/auth/verify-email", { email, code });
        if (!ok) { setErr(d.error ?? NET); return; }
        toast("success", "Email tasdiqlandi!"); router.push("/royxat"); router.refresh();
      } else if (mode === "forgot") {
        const { ok, d } = await post("/api/auth/forgot", { email });
        if (!ok) { setErr(d.error ?? NET); return; }
        setMode("reset"); setCode(""); setPassword(""); setCooldown(60); toast("success", "Agar bu email ro'yxatdan o'tgan bo'lsa, kod yuborildi.");
      } else {
        const { ok, d } = await post("/api/auth/reset", { email, code, password });
        if (!ok) { setErr(d.error ?? NET); return; }
        toast("success", "Parol yangilandi. Endi kiring."); setPassword(""); go("login");
      }
    } catch { setErr(NET); } finally { setBusy(false); }
  };

  /** Kodni qayta yuborish (60 soniyada bir marta). */
  const resend = async () => {
    if (cooldown > 0 || busy) return; setBusy(true); setErr("");
    try {
      const { ok, d } = mode === "reset" ? await post("/api/auth/forgot", { email }) : await post("/api/auth/register", { email, password });
      if (!ok) { setErr(d.error ?? NET); return; }
      setCooldown(60); toast("success", "Kod qayta yuborildi.");
    } catch { setErr(NET); } finally { setBusy(false); }
  };

  const social = providers.google || providers.telegram || providers.yandex;
  const socialBtn = "h-11 w-full";
  const showSocial = social && (mode === "login" || mode === "register");
  const t = TITLES[mode];
  const pwInput = (autoComplete: string, minLength?: number) => (
    <span className="relative block">
      <Input type={show ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} className="pr-11" autoComplete={autoComplete} required minLength={minLength} maxLength={128} />
      <button type="button" onClick={() => setShow((s) => !s)} aria-label={show ? "Parolni yashirish" : "Parolni ko'rsatish"}
        className="absolute inset-y-0 right-0 grid w-11 place-items-center text-muted-foreground hover:text-foreground">
        {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </span>
  );
  const linkBtn = "font-semibold text-primary hover:underline disabled:opacity-50 disabled:no-underline";

  return (
    <div className="grid min-h-screen bg-background lg:grid-cols-[1.05fr_1fr]">
      <Showcase />
      <main className="relative flex flex-col justify-center px-5 py-10 sm:px-10">
        <div className="mx-auto w-full max-w-md">
          <div className="mb-8 lg:hidden"><Brand /></div>

          {who ? (
            <div className="space-y-5">
              <div><h1 className="text-2xl font-extrabold tracking-tight">Siz tizimdasiz</h1><p className="mt-1 text-sm text-muted-foreground">{who.name ?? who.email}</p></div>
              <Button className="w-full" size="lg" onClick={() => router.push("/dashboard")}>Bosh sahifaga o'tish</Button>
              <Button variant="outline" className="w-full" onClick={logout}>Chiqish</Button>
            </div>
          ) : tg ? (
            <div className="space-y-5 text-center" aria-live="polite">
              <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-[#27A7E7]/10"><TelegramIcon /></span>
              <h1 className="text-2xl font-extrabold tracking-tight">Telegramda «Start» ni bosing</h1>
              <ol className="mx-auto max-w-xs space-y-2 text-left text-sm text-muted-foreground">
                <li>1. Ochilgan Telegram botda <b className="text-foreground">Start</b> tugmasini bosing.</li>
                <li>2. Bot sizni ro'yxatdan o'tkazadi.</li>
                <li>3. Shu sahifaga qaytsangiz, o'zi ochiladi.</li>
              </ol>
              <p className="flex items-center justify-center gap-2 text-sm text-muted-foreground"><span className="h-2 w-2 animate-pulse rounded-full bg-primary" />Tasdiqlash kutilmoqda...</p>
              <Button asChild size="lg" className="w-full"><a href={tg.url} target="_blank" rel="noopener noreferrer">Telegramni ochish</a></Button>
              <button type="button" className="text-sm font-semibold text-primary hover:underline" onClick={() => setTg(null)}>Bekor qilish</button>
            </div>
          ) : (
            <>
              <div>
                <h1 className="text-3xl font-extrabold tracking-tight">{t.h}</h1>
                <p className="mt-2 text-sm text-muted-foreground">
                  {mode === "verify" ? <>Kod <b className="text-foreground">{email || "emailingizga"}</b> manziliga yuborildi. Xat kelmasa, «Spam» papkasini ham tekshiring.</>
                    : mode === "reset" ? <>Kod <b className="text-foreground">{email}</b> manziliga yuborildi (agar u ro'yxatdan o'tgan bo'lsa). Kodni va yangi parolni kiriting.</>
                    : t.p}
                </p>
              </div>

              {showSocial && (
                <div className="mt-7">
                  <div className={cn("grid gap-3", "min-[420px]:grid-cols-2")}>
                    {providers.google && (
                      <Button asChild variant="outline" className={socialBtn}><a href="/api/auth/google/start"><GoogleIcon />Google</a></Button>
                    )}
                    {providers.telegram && (
                      <Button type="button" variant="outline" loading={tgBusy} onClick={tgStart} className={cn(socialBtn, !providers.google && "min-[420px]:col-span-2")}><TelegramIcon />Telegram</Button>
                    )}
                    {providers.yandex && (
                      <Button asChild variant="outline" className={cn(socialBtn, "min-[420px]:col-span-2")}><a href="/api/auth/yandex/start"><span aria-hidden className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-[#FC3F1D] text-xs font-bold text-white">Я</span>Yandex</a></Button>
                    )}
                  </div>
                  <p className="mt-6 flex items-center gap-3 text-xs text-muted-foreground"><span className="h-px flex-1 bg-border" />yoki email bilan<span className="h-px flex-1 bg-border" /></p>
                </div>
              )}

              <form onSubmit={submit} className={cn("space-y-4", showSocial ? "mt-6" : "mt-7")}>
                {(mode === "login" || mode === "register" || mode === "forgot") && (
                  <Field label="Email"><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" placeholder="ism@gmail.com" required maxLength={254} /></Field>
                )}
                {(mode === "verify" || mode === "reset") && (
                  <Field label="Emailga kelgan 6 xonali kod">
                    <Input value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" placeholder="000000" required minLength={6} maxLength={6} className="text-center text-xl font-bold tracking-[0.5em]" />
                  </Field>
                )}
                {mode === "login" && <Field label="Parol">{pwInput("current-password")}</Field>}
                {mode === "register" && <Field label="Parol" hint="Kamida 8 belgi">{pwInput("new-password", 8)}</Field>}
                {mode === "reset" && <Field label="Yangi parol" hint="Kamida 8 belgi">{pwInput("new-password", 8)}</Field>}

                {err && <p role="alert" className="rounded-xl bg-danger/10 p-3 text-sm text-danger">{err}</p>}

                <Button type="submit" size="lg" loading={busy} className="w-full">
                  {mode === "login" ? "Kirish" : mode === "register" ? "Kod yuborish" : mode === "verify" ? "Tasdiqlash" : mode === "forgot" ? "Kod yuborish" : "Parolni yangilash"}
                </Button>
              </form>

              <div className="mt-6 space-y-2 text-center text-sm text-muted-foreground">
                {mode === "login" && (<>
                  <p><button type="button" className={linkBtn} onClick={() => go("forgot")}>Parolni unutdingizmi?</button></p>
                  <p>Akkauntingiz yo'qmi? <button type="button" className={linkBtn} onClick={() => go("register")}>Ro'yxatdan o'tish</button></p>
                </>)}
                {mode === "register" && <p>Akkauntingiz bormi? <button type="button" className={linkBtn} onClick={() => go("login")}>Kirish</button></p>}
                {(mode === "verify" || mode === "reset") && (<>
                  <p><button type="button" className={linkBtn} disabled={cooldown > 0 || busy} onClick={resend}>{cooldown > 0 ? `Kodni qayta yuborish (${cooldown} s)` : "Kodni qayta yuborish"}</button></p>
                  <p><button type="button" className={linkBtn} onClick={() => go(mode === "verify" ? "register" : "forgot")}>Emailni o'zgartirish</button></p>
                </>)}
                {mode === "forgot" && <p><button type="button" className={linkBtn} onClick={() => go("login")}>Kirishga qaytish</button></p>}
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}