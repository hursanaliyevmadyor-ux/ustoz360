"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { BarChart3, BookOpenCheck, Eye, EyeOff, Sparkles } from "lucide-react";
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
  return <div ref={ref} className="flex h-11 items-center justify-center overflow-hidden" aria-label="Telegram orqali kirish" />;
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

export default function Page() {
  const router = useRouter(); const toast = useToast();
  const [mode, setMode] = React.useState<Mode>("login");
  const [name, setName] = React.useState(""); const [email, setEmail] = React.useState(""); const [password, setPassword] = React.useState("");
  const [show, setShow] = React.useState(false);
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

  const social = providers.google || providers.telegram || providers.yandex;
  const socialBtn = "h-11 w-full";

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
          ) : (
            <>
              <div>
                <h1 className="text-3xl font-extrabold tracking-tight">{mode === "login" ? "Qaytganingiz bilan!" : "Akkaunt yarating"}</h1>
                <p className="mt-2 text-sm text-muted-foreground">{mode === "login" ? "Hisobingizga kirib, o'qishni davom ettiring." : "Bir daqiqada boshlang, kartasiz."}</p>
              </div>

              {social && (
                <div className="mt-7">
                  <div className={cn("grid gap-3", "min-[420px]:grid-cols-2")}>
                    {providers.google && (
                      <Button asChild variant="outline" className={socialBtn}><a href="/api/auth/google/start"><GoogleIcon />Google</a></Button>
                    )}
                    {providers.telegram && <div className={cn("overflow-hidden rounded-xl", !providers.google && "min-[420px]:col-span-2")}><TelegramButton bot={providers.telegram} /></div>}
                    {providers.yandex && (
                      <Button asChild variant="outline" className={cn(socialBtn, "min-[420px]:col-span-2")}><a href="/api/auth/yandex/start"><span aria-hidden className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-[#FC3F1D] text-xs font-bold text-white">Я</span>Yandex</a></Button>
                    )}
                  </div>
                  <p className="mt-6 flex items-center gap-3 text-xs text-muted-foreground"><span className="h-px flex-1 bg-border" />yoki login va parol<span className="h-px flex-1 bg-border" /></p>
                </div>
              )}

              <form onSubmit={submit} className={cn("space-y-4", social ? "mt-6" : "mt-7")}>
                {mode === "register" && <Field label="Ism familiya (ixtiyoriy)"><Input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" maxLength={80} /></Field>}
                <Field label="Email"><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" placeholder="ism@pochta.uz" required maxLength={254} /></Field>
                <Field label="Parol" hint={mode === "register" ? "Kamida 8 belgi" : undefined} error={err}>
                  <span className="relative block">
                    <Input type={show ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} className="pr-11"
                      autoComplete={mode === "register" ? "new-password" : "current-password"} required minLength={mode === "register" ? 8 : 1} maxLength={128} />
                    <button type="button" onClick={() => setShow((s) => !s)} aria-label={show ? "Parolni yashirish" : "Parolni ko'rsatish"}
                      className="absolute inset-y-0 right-0 grid w-11 place-items-center text-muted-foreground hover:text-foreground">
                      {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </span>
                </Field>
                <Button type="submit" size="lg" loading={busy} className="w-full">{mode === "login" ? "Kirish" : "Akkaunt yaratish"}</Button>
              </form>

              <p className="mt-6 text-center text-sm text-muted-foreground">
                {mode === "login" ? "Akkauntingiz yo'qmi?" : "Akkauntingiz bormi?"}{" "}
                <button type="button" className="font-semibold text-primary hover:underline" onClick={() => { setMode(mode === "login" ? "register" : "login"); setErr(""); }}>
                  {mode === "login" ? "Ro'yxatdan o'tish" : "Kirish"}
                </button>
              </p>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
