"use client";
import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowUp, BarChart3, BookOpen, Check, ClipboardList, Copy, FileText, GraduationCap, Home, Lightbulb, Mail, Menu, MessageSquare, Plus, Sparkles, Trash2, X, Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Role = "user" | "assistant";
type Msg = { role: Role; content: string; error?: boolean };
type Chat = { id: string; title: string; model: string };
type ModelKey = "free" | "claude";
type Status = { configured: boolean; remaining: number; limit: number; free: { configured: boolean; remaining: number; limit: number } };
type Me = { id: string; name: string | null; email: string | null } | null;

const TOOLS = [
  { icon: GraduationCap, label: "Dars rejasi", prompt: "___ sinf, ___ fanidan «___» mavzusi bo'yicha 45 daqiqalik dars rejasi tuzib ber. Maqsad, bosqichlar, vaqt taqsimoti va uy vazifasi bo'lsin." },
  { icon: ClipboardList, label: "Test savollari", prompt: "___ sinf, «___» mavzusi bo'yicha 10 ta test savoli tuz. Har biriga 4 ta variant, to'g'ri javob va qisqa izoh yoz. Qiyinlik: oson, o'rta, qiyin aralash." },
  { icon: Lightbulb, label: "Mavzuni tushuntirish", prompt: "«___» mavzusini ___ sinf o'quvchisiga tushunarli tilda, hayotiy misollar bilan tushuntirib ber." },
  { icon: FileText, label: "Baholash mezoni", prompt: "«___» topshirig'i uchun 4 darajali (rubrika) baholash mezoni tuz: mezon, ball va tavsif jadvali ko'rinishida." },
  { icon: Mail, label: "Ota-onaga xabar", prompt: "Ota-onalarga ___ haqida qisqa, hurmatli va aniq xabar matnini yoz." },
];
const LINKS = [
  { icon: BookOpen, label: "Diagnostika", href: "/ustoz-ai/diagnostika" },
  { icon: BarChart3, label: "Bilim xaritasi", href: "/ustoz-ai/bilim-xaritasi" },
  { icon: ClipboardList, label: "Xatolar daftari", href: "/ustoz-ai/xatolar" },
];
const SUGGEST = [
  { t: "Dars rejasi", d: "5-sinf, Kasrlar mavzusi, 45 daqiqa", p: "5-sinf matematika, «Oddiy kasrlar» mavzusi bo'yicha 45 daqiqalik dars rejasi tuzib ber." },
  { t: "Test savollari", d: "10 ta savol, javoblari bilan", p: "7-sinf fizika, «Bosim» mavzusi bo'yicha 10 ta test savoli tuz, javoblari va izohi bilan." },
  { t: "Mavzuni soddalashtirish", d: "O'quvchi tushunadigan tilda", p: "Fotosintez jarayonini 6-sinf o'quvchisiga oddiy tilda, misollar bilan tushuntirib ber." },
  { t: "Faol o'qitish usullari", d: "Darsni qiziqarli qilish", p: "Dars jarayonini qiziqarli qiladigan 5 ta faol o'qitish usulini misollar bilan ayt." },
];

/** Kichik, xavfsiz markdown ko'rsatuvchi: kod bloklari, sarlavha, ro'yxat, **qalin**, `kod`. HTML kiritilmaydi. */
function Inline({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return <>{parts.map((p, i) => p.startsWith("**") && p.endsWith("**") && p.length > 4 ? <b key={i}>{p.slice(2, -2)}</b> : p.startsWith("`") && p.endsWith("`") && p.length > 2 ? <code key={i} className="rounded bg-muted px-1.5 py-0.5 text-[0.9em]">{p.slice(1, -1)}</code> : <React.Fragment key={i}>{p}</React.Fragment>)}</>;
}
function Rich({ text }: { text: string }) {
  const blocks = text.split(/```/g);
  return (
    <div className="space-y-3 text-[15px] leading-7">
      {blocks.map((b, i) => {
        if (i % 2 === 1) return <pre key={i} className="overflow-x-auto rounded-xl bg-navy p-4 text-sm leading-6 text-white"><code>{b.replace(/^\w*\n/, "")}</code></pre>;
        const lines = b.split("\n"); const out: React.ReactNode[] = []; let list: string[] = []; let ordered = false;
        const flush = () => { if (!list.length) return; const L = ordered ? "ol" : "ul"; out.push(React.createElement(L, { key: `l${out.length}`, className: cn("space-y-1 pl-6", ordered ? "list-decimal" : "list-disc") }, list.map((x, k) => <li key={k}><Inline text={x} /></li>))); list = []; };
        lines.forEach((ln, k) => {
          const ul = ln.match(/^\s*[-*•]\s+(.*)/); const ol = ln.match(/^\s*\d+[.)]\s+(.*)/); const h = ln.match(/^#{1,4}\s+(.*)/);
          if (ul) { if (ordered) flush(); ordered = false; list.push(ul[1]); return; }
          if (ol) { if (!ordered) flush(); ordered = true; list.push(ol[1]); return; }
          flush();
          if (h) out.push(<p key={`h${k}`} className="pt-1 text-base font-bold"><Inline text={h[1]} /></p>);
          else if (ln.trim()) out.push(<p key={`p${k}`}><Inline text={ln} /></p>);
        });
        flush();
        return <React.Fragment key={i}>{out}</React.Fragment>;
      })}
    </div>
  );
}

function CopyBtn({ text }: { text: string }) {
  const [ok, setOk] = React.useState(false);
  return (
    <button type="button" aria-label="Nusxalash" className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
      onClick={() => { navigator.clipboard?.writeText(text).then(() => { setOk(true); setTimeout(() => setOk(false), 1500); }).catch(() => {}); }}>
      {ok ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
    </button>
  );
}

export default function Page() {
  const router = useRouter();
  const [me, setMe] = React.useState<Me>(null);
  const [anon, setAnon] = React.useState(false);
  const [status, setStatus] = React.useState<Status | null>(null);
  const [chats, setChats] = React.useState<Chat[]>([]);
  const [activeId, setActiveId] = React.useState<string | null>(null);
  const [model, setModel] = React.useState<ModelKey>("free");
  const [input, setInput] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [drawer, setDrawer] = React.useState(false);
  const [messages, setMessages] = React.useState<Msg[]>([]);
  const [saveOk, setSaveOk] = React.useState(true);
  const endRef = React.useRef<HTMLDivElement>(null);
  const taRef = React.useRef<HTMLTextAreaElement>(null);

  const loadStatus = React.useCallback(() => {
    fetch("/api/ai/status").then(async (r) => { if (r.status === 401) { setAnon(true); return; } if (r.ok) setStatus(await r.json()); }).catch(() => {});
  }, []);
  React.useEffect(() => {
    fetch("/api/me").then((r) => r.json()).then((d) => { if (d.user && d.user.onboarded === false) { router.replace("/royxat"); return; } setMe(d.user); if (!d.user) setAnon(true); }).catch(() => {});
    loadStatus();
  }, [loadStatus, router]);

  const loadChats = React.useCallback(() => {
    fetch("/api/ai/chats").then((r) => (r.ok ? r.json() : null)).then((d) => { if (d) { setChats(d.chats); setSaveOk(d.available); } }).catch(() => {});
  }, []);
  React.useEffect(() => { if (me) loadChats(); }, [me, loadChats]);

  React.useEffect(() => {
    if (!status) return;
    if (!status.free.configured && status.configured) setModel("claude");
  }, [status]);
  React.useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [messages, busy]);
  React.useEffect(() => {
    const ta = taRef.current; if (!ta) return; ta.style.height = "auto"; ta.style.height = Math.min(ta.scrollHeight, 200) + "px";
  }, [input]);

  const active = chats.find((c) => c.id === activeId) ?? null;
  const modelOk = (m: ModelKey) => (m === "free" ? !!status?.free.configured : !!status?.configured);
  const remaining = status ? (model === "free" ? status.free.remaining : status.remaining) : null;
  const limit = status ? (model === "free" ? status.free.limit : status.limit) : null;

  const newChat = () => { setActiveId(null); setMessages([]); setInput(""); setDrawer(false); taRef.current?.focus(); };
  const openChat = async (c: Chat) => {
    setDrawer(false);
    try {
      const r = await fetch(`/api/ai/chats/${c.id}`); if (!r.ok) return;
      const d = await r.json();
      setMessages(d.messages as Msg[]); setActiveId(c.id); setModel(d.model === "claude" ? "claude" : "free");
    } catch {}
  };
  const removeChat = async (id: string) => {
    try { const r = await fetch(`/api/ai/chats/${id}`, { method: "DELETE" }); if (!r.ok) return; } catch { return; }
    setChats((s) => s.filter((c) => c.id !== id));
    if (activeId === id) { setActiveId(null); setMessages([]); }
  };
  const useTemplate = (p: string) => { setActiveId(null); setMessages([]); setInput(p); setDrawer(false); setTimeout(() => taRef.current?.focus(), 0); };

  const send = async (text: string) => {
    const t = text.trim(); if (!t || busy) return;
    const history: Msg[] = [...messages.filter((m) => !m.error), { role: "user", content: t }];
    setMessages(history); setInput(""); setBusy(true);
    const append = (m: Msg) => setMessages((s) => [...s, m]);
    try {
      const r = await fetch(model === "free" ? "/api/ai/free-chat" : "/api/ai/chat", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ messages: history.slice(-20).map((m) => ({ role: m.role, content: m.content.slice(0, 4000) })), save: true, chatId: activeId ?? undefined }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) append({ role: "assistant", error: true, content: r.status === 401 ? "Davom etish uchun tizimga kiring." : d.error ?? "Xatolik yuz berdi. Qayta urinib ko'ring." });
      else { append({ role: "assistant", content: d.reply }); if (d.chatId) { setActiveId(d.chatId); loadChats(); } }
    } catch { append({ role: "assistant", error: true, content: "Server bilan aloqa yo'q. Internetni tekshirib, qayta urinib ko'ring." }); }
    setBusy(false); loadStatus();
  };

  const name = me?.name?.split(" ")[0] ?? me?.email?.split("@")[0] ?? "";
  const initials = (me?.name ?? me?.email ?? "?").split(/[\s@]/).filter(Boolean).map((w) => w[0]).join("").slice(0, 2).toUpperCase();
  const sec = "px-3 pb-1.5 pt-5 text-xs font-semibold text-muted-foreground";
  const row = "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-foreground/90 hover:bg-muted";

  const sidebar = (
    <div className="flex h-full flex-col bg-card">
      <div className="flex items-center justify-between gap-2 p-4 pb-2">
        <Link href="/dashboard" className="flex items-center gap-2.5" aria-label="USTOZ 360">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-primary text-sm font-extrabold text-white">U</span>
          <span className="text-base font-extrabold tracking-tight">USTOZ <span className="text-primary">360</span></span>
        </Link>
        <button className="grid h-9 w-9 place-items-center rounded-lg hover:bg-muted lg:hidden" onClick={() => setDrawer(false)} aria-label="Yopish"><X className="h-5 w-5" /></button>
      </div>
      <div className="px-3 pt-2">
        <button onClick={newChat} className={cn(row, "bg-muted font-semibold")}><span className="grid h-7 w-7 place-items-center rounded-lg bg-card"><Plus className="h-4 w-4" /></span>Yangi chat</button>
      </div>
      <nav className="min-h-0 flex-1 overflow-y-auto px-3 pb-3" aria-label="AI bo'limlari">
        <p className={sec}>Mening chatlarim</p>
        {chats.length === 0 && <p className="px-3 py-2 text-sm text-muted-foreground">Hali chat yo'q. Birinchi savolingizni bering.</p>}
        {!saveOk && <p className="mx-3 mb-1 rounded-lg bg-amber/15 p-2 text-xs">Chatlarni saqlash hozircha o'chiq (baza yangilanmagan). Javoblar ishlaydi, lekin tarix saqlanmaydi.</p>}
        <ul className="space-y-0.5">
          {chats.map((c) => (
            <li key={c.id} className="group relative">
              <button onClick={() => openChat(c)} className={cn(row, "pr-10", c.id === activeId && "bg-muted")}>
                <MessageSquare className="h-4 w-4 shrink-0 text-muted-foreground" /><span className="truncate">{c.title}</span>
              </button>
              <button onClick={() => removeChat(c.id)} aria-label="Chatni o'chirish" className="absolute right-1.5 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-lg text-muted-foreground opacity-0 hover:bg-card hover:text-danger focus:opacity-100 group-hover:opacity-100"><Trash2 className="h-4 w-4" /></button>
            </li>
          ))}
        </ul>
        <p className={sec}>Asboblar</p>
        <ul className="space-y-0.5">
          {TOOLS.map((t) => (
            <li key={t.label}><button onClick={() => useTemplate(t.prompt)} className={row}><span className="grid h-7 w-7 place-items-center rounded-lg bg-muted"><t.icon className="h-4 w-4" /></span>{t.label}</button></li>
          ))}
        </ul>
        <p className={sec}>Rivojlanish</p>
        <ul className="space-y-0.5">
          {LINKS.map((t) => (
            <li key={t.label}><Link href={t.href} className={row}><span className="grid h-7 w-7 place-items-center rounded-lg bg-muted"><t.icon className="h-4 w-4" /></span>{t.label}</Link></li>
          ))}
          <li><Link href="/dashboard" className={row}><span className="grid h-7 w-7 place-items-center rounded-lg bg-muted"><Home className="h-4 w-4" /></span>Platformaga qaytish</Link></li>
        </ul>
      </nav>
      <div className="border-t border-border p-3">
        {me ? (
          <div className="flex items-center gap-3 rounded-xl bg-muted p-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary/15 text-sm font-bold text-primary">{initials}</span>
            <span className="min-w-0 leading-tight"><b className="block truncate text-sm">{me.name ?? name}</b><span className="block truncate text-xs text-muted-foreground">{me.email}</span></span>
          </div>
        ) : (
          <Button asChild className="w-full"><Link href="/kirish">Kirish</Link></Button>
        )}
        <div className="mt-3 flex items-center justify-between px-1 text-sm">
          <span className="flex items-center gap-2 font-semibold"><Zap className="h-4 w-4" />AI limiti</span>
          <span className="text-muted-foreground">{remaining === null ? "…" : `${remaining} / ${limit}`}</span>
        </div>
        {remaining !== null && limit !== null && (
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden><div className="h-full rounded-full bg-primary transition-all" style={{ width: `${Math.max(0, Math.min(100, (remaining / limit) * 100))}%` }} /></div>
        )}
      </div>
    </div>
  );

  return (
    <div className="flex h-[100dvh] bg-background">
      <aside className="hidden w-72 shrink-0 border-r border-border lg:block">{sidebar}</aside>
      {drawer && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button className="absolute inset-0 bg-black/40" aria-label="Yopish" onClick={() => setDrawer(false)} />
          <aside className="absolute inset-y-0 left-0 w-[min(320px,88vw)] shadow-pop">{sidebar}</aside>
        </div>
      )}

      <main className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border px-3 lg:px-6">
          <button className="grid h-10 w-10 place-items-center rounded-lg hover:bg-muted lg:hidden" onClick={() => setDrawer(true)} aria-label="Menyu"><Menu className="h-5 w-5" /></button>
          <h1 className="truncate text-sm font-semibold">{active?.title ?? "Yangi chat"}</h1>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {anon ? (
            <div className="mx-auto flex h-full max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
              <span className="grid h-14 w-14 place-items-center rounded-2xl bg-primary/10 text-primary"><Sparkles className="h-7 w-7" /></span>
              <h2 className="text-2xl font-extrabold tracking-tight">AI yordamchidan foydalanish uchun kiring</h2>
              <p className="text-sm text-muted-foreground">Google yoki Telegram orqali kiring: chatlaringiz va kunlik limitingiz akkauntga bog'lanadi.</p>
              <Button asChild size="lg"><Link href="/kirish">Kirish</Link></Button>
            </div>
          ) : messages.length === 0 ? (
            <div className="mx-auto flex min-h-full max-w-3xl flex-col justify-center px-5 py-10">
              <span className="mb-4 grid h-12 w-12 place-items-center rounded-2xl bg-primary text-white"><Sparkles className="h-6 w-6" /></span>
              <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl">{name ? `Salom, ${name}!` : "Salom!"}</h2>
              <p className="mt-2 text-lg text-muted-foreground">Bugun qanday yordam bera olaman?</p>
              <ul className="mt-8 grid gap-3 sm:grid-cols-2">
                {SUGGEST.map((s) => (
                  <li key={s.t}>
                    <button onClick={() => send(s.p)} disabled={busy || !status || !modelOk(model)} className="h-full w-full rounded-2xl border border-border bg-card p-4 text-left shadow-soft transition hover:border-primary disabled:opacity-60">
                      <b className="block text-sm">{s.t}</b><span className="mt-1 block text-sm text-muted-foreground">{s.d}</span>
                    </button>
                  </li>
                ))}
              </ul>
              {status && !modelOk(model) && !status.free.configured && !status.configured && (
                <p className="mt-6 rounded-xl bg-amber/15 p-3 text-sm">AI xizmati hali serverga ulanmagan, shuning uchun javob berilmaydi. Administrator kalitni qo'yishi kerak.</p>
              )}
            </div>
          ) : (
            <div className="mx-auto max-w-3xl space-y-6 px-4 py-6 sm:px-6">
              {messages.map((m, i) => (
                <div key={i} className={cn("flex gap-3", m.role === "user" && "justify-end")}>
                  {m.role === "assistant" && <span className="mt-1 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-primary text-white"><Sparkles className="h-4 w-4" /></span>}
                  <div className={cn("min-w-0", m.role === "user" ? "max-w-[85%] whitespace-pre-wrap rounded-2xl bg-muted px-4 py-2.5 text-[15px] leading-7" : "flex-1")}>
                    {m.role === "user" ? m.content : m.error ? <p className="rounded-xl bg-danger/10 p-3 text-sm text-danger" role="alert">{m.content}</p> : (<><Rich text={m.content} /><div className="mt-1"><CopyBtn text={m.content} /></div></>)}
                  </div>
                </div>
              ))}
              {busy && (
                <div className="flex gap-3"><span className="mt-1 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-primary text-white"><Sparkles className="h-4 w-4" /></span>
                  <p className="pt-1.5 text-sm text-muted-foreground" aria-live="polite">AI o'ylamoqda<span className="animate-pulse">...</span></p></div>
              )}
              <div ref={endRef} />
            </div>
          )}
        </div>

        {!anon && (
          <div className="shrink-0 px-3 pb-4 pt-2 sm:px-6">
            <form className="mx-auto max-w-3xl rounded-3xl border border-border bg-card p-3 shadow-pop" onSubmit={(e) => { e.preventDefault(); send(input); }}>
              <label htmlFor="ai-input" className="sr-only">Savolingiz</label>
              <textarea id="ai-input" ref={taRef} rows={1} value={input} onChange={(e) => setInput(e.target.value)} maxLength={4000} placeholder="Savolingizni yozing..."
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); send(input); } }}
                className="max-h-[200px] w-full resize-none bg-transparent px-2 py-1.5 text-[15px] leading-6 placeholder:text-muted-foreground focus:outline-none" />
              <div className="mt-2 flex items-center justify-between gap-2">
                <div role="group" aria-label="AI modeli" className="flex gap-1 rounded-xl bg-muted p-1">
                  {(["free", "claude"] as const).map((k) => (
                    <button key={k} type="button" disabled={!modelOk(k)} aria-pressed={model === k} onClick={() => setModel(k)} title={modelOk(k) ? undefined : "Hali sozlanmagan"}
                      className={cn("rounded-lg px-3 py-1.5 text-xs font-semibold disabled:opacity-40", model === k ? "bg-card shadow-soft" : "text-muted-foreground")}>{k === "free" ? "Bepul AI" : "Claude"}</button>
                  ))}
                </div>
                <div className="flex items-center gap-3">
                  <span className="hidden items-center gap-1 text-xs text-muted-foreground sm:flex"><Zap className="h-3.5 w-3.5" />{remaining === null ? "…" : remaining}</span>
                  <button type="submit" disabled={busy || !input.trim() || !modelOk(model)} aria-label="Yuborish" className="grid h-10 w-10 place-items-center rounded-full bg-primary text-white transition disabled:bg-muted disabled:text-muted-foreground"><ArrowUp className="h-5 w-5" /></button>
                </div>
              </div>
            </form>
            <p className="mx-auto mt-2 max-w-3xl text-center text-xs text-muted-foreground">AI xato qilishi mumkin. Muhim ma'lumotlarni tekshirib oling.</p>
          </div>
        )}
      </main>
    </div>
  );
}
