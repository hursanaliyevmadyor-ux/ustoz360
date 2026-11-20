"use client";
import * as React from "react";
import { ArrowUpRight, Check, ChevronLeft, ChevronRight, ChevronsUpDown, Circle, Download, Eraser, Highlighter, ImagePlus, Minus, MousePointer2, Palette, Pencil, Plus, Redo2, Square, Trash2, Type, Undo2, X } from "lucide-react";
import {
  BGS, BG_NAMES, BOARD_X, BOARD_Y, BoardStore, COLORS, COLOR_NAMES, FONT_SIZES, KIND, MAX_TEXT, WIDTHS, WIDTH_NAMES, bgStyle, constrainShape, isShape,
  type Bg, type BoardMsg, type Stroke,
} from "@/lib/board";
import { cn } from "@/lib/utils";

const W = 1600;
const H = 900;
type Tool = "pen" | "hl" | "eraser" | "line" | "arrow" | "rect" | "ellipse" | "text" | "laser";
const KIND_OF: Record<Exclude<Tool, "laser">, number> = { pen: KIND.pen, hl: KIND.hl, eraser: KIND.eraser, line: KIND.line, arrow: KIND.arrow, rect: KIND.rect, ellipse: KIND.ellipse, text: KIND.text };
const TOOLS: { id: Tool; label: string; key: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: "pen", label: "Qalam", key: "P", icon: Pencil },
  { id: "hl", label: "Marker", key: "M", icon: Highlighter },
  { id: "eraser", label: "O'chirg'ich", key: "E", icon: Eraser },
  { id: "line", label: "Chiziq", key: "L", icon: Minus },
  { id: "arrow", label: "Strelka", key: "A", icon: ArrowUpRight },
  { id: "rect", label: "To'rtburchak", key: "R", icon: Square },
  { id: "ellipse", label: "Ellips", key: "O", icon: Circle },
  { id: "text", label: "Matn", key: "T", icon: Type },
  { id: "laser", label: "Lazer ko'rsatkich", key: "K", icon: MousePointer2 },
];

const px = (v: number) => (v / BOARD_X) * W;
const py = (v: number) => (v / BOARD_Y) * H;

/** Chiziqlarni chizadi (ekranda ham, rasmga saqlashda ham bir xil). */
export function drawStrokes(ctx: CanvasRenderingContext2D, strokes: readonly Stroke[]) {
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  for (const s of strokes) {
    const n = s.p.length / 2;
    if (n === 0) continue;
    const eraser = s.k === KIND.eraser;
    ctx.globalCompositeOperation = eraser ? "destination-out" : "source-over";
    ctx.globalAlpha = s.k === KIND.hl ? 0.35 : 1;
    const color = eraser ? "#000" : COLORS[s.c] ?? COLORS[0];
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    const base = WIDTHS[s.w] ?? WIDTHS[1];
    ctx.lineWidth = s.k === KIND.hl ? base * 3.5 : eraser ? base * 4 : base;
    if (s.k === KIND.text) {
      const size = FONT_SIZES[s.w] ?? FONT_SIZES[1];
      ctx.font = `700 ${size}px ui-sans-serif, system-ui, "Segoe UI", Roboto, sans-serif`;
      ctx.textBaseline = "top";
      (s.s ?? "").split("\n").forEach((line, i) => ctx.fillText(line, px(s.p[0]!), py(s.p[1]!) + i * size * 1.2));
      continue;
    }
    if (isShape(s.k)) {
      const x1 = px(s.p[0]!), y1 = py(s.p[1]!), x2 = px(s.p[2]!), y2 = py(s.p[3]!);
      ctx.beginPath();
      if (s.k === KIND.rect) ctx.rect(Math.min(x1, x2), Math.min(y1, y2), Math.abs(x2 - x1), Math.abs(y2 - y1));
      else if (s.k === KIND.ellipse) ctx.ellipse((x1 + x2) / 2, (y1 + y2) / 2, Math.abs(x2 - x1) / 2, Math.abs(y2 - y1) / 2, 0, 0, Math.PI * 2);
      else {
        ctx.moveTo(x1, y1); ctx.lineTo(x2, y2);
        if (s.k === KIND.arrow) {
          const a = Math.atan2(y2 - y1, x2 - x1), len = Math.max(18, base * 4.5);
          ctx.moveTo(x2, y2); ctx.lineTo(x2 - len * Math.cos(a - 0.45), y2 - len * Math.sin(a - 0.45));
          ctx.moveTo(x2, y2); ctx.lineTo(x2 - len * Math.cos(a + 0.45), y2 - len * Math.sin(a + 0.45));
        }
      }
      ctx.stroke();
      continue;
    }
    if (n === 1) { ctx.beginPath(); ctx.arc(px(s.p[0]!), py(s.p[1]!), ctx.lineWidth / 2, 0, Math.PI * 2); ctx.fill(); continue; }
    ctx.beginPath();
    ctx.moveTo(px(s.p[0]!), py(s.p[1]!));
    // o'rta nuqtalar orqali silliq egri chiziq
    for (let i = 1; i < n - 1; i++) {
      const x = px(s.p[i * 2]!), y = py(s.p[i * 2 + 1]!), nx = px(s.p[i * 2 + 2]!), ny = py(s.p[i * 2 + 3]!);
      ctx.quadraticCurveTo(x, y, (x + nx) / 2, (y + ny) / 2);
    }
    ctx.lineTo(px(s.p[n * 2 - 2]!), py(s.p[n * 2 - 1]!));
    ctx.stroke();
  }
  ctx.globalCompositeOperation = "source-over";
  ctx.globalAlpha = 1;
}

/** Orqa fonni rasmga saqlash uchun chizadi (ekranda CSS bilan ko'rsatiladi). */
function drawBg(ctx: CanvasRenderingContext2D, bg: Bg) {
  ctx.fillStyle = bg === "dark" ? "#1f3a2f" : "#ffffff";
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = "rgba(148,163,184,0.55)";
  ctx.lineWidth = 1;
  const grid = (ox: number, oy: number) => {
    ctx.beginPath();
    for (let x = ox; x <= W; x += 50) { ctx.moveTo(x + 0.5, 0); ctx.lineTo(x + 0.5, H); }
    for (let y = oy; y <= H; y += 50) { ctx.moveTo(0, y + 0.5); ctx.lineTo(W, y + 0.5); }
    ctx.stroke();
  };
  if (bg === "grid") grid(0, 0);
  else if (bg === "lines") { ctx.beginPath(); for (let y = 75; y <= H; y += 75) { ctx.moveTo(0, y + 0.5); ctx.lineTo(W, y + 0.5); } ctx.stroke(); }
  else if (bg === "dots") { ctx.fillStyle = "rgba(100,116,139,0.8)"; for (let x = 25; x < W; x += 50) for (let y = 25; y < H; y += 50) { ctx.beginPath(); ctx.arc(x, y, 1.6, 0, Math.PI * 2); ctx.fill(); } }
  else if (bg === "axes") { grid(0, 0); ctx.strokeStyle = "#0f172a"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(W / 2, 0); ctx.lineTo(W / 2, H); ctx.moveTo(0, H / 2); ctx.lineTo(W, H / 2); ctx.stroke(); }
}

type Laser = { x: number; y: number; t: number };

/**
 * Doska. Ustoz (va ustoz chaqirgan o'quvchi, canDraw) qalam, marker, o'chirg'ich, shakllar, matn va lazer bilan chizadi;
 * ustoz sahifalarni boshqaradi, fonni almashtiradi, rasm qo'yadi. Hamma ko'radi va rasmga (PNG) saqlab oladi.
 * Chiziqlar `store` da turadi va `net` orqali hammaga yuboriladi.
 */
export function Whiteboard({ store, version, bg, canDraw, isHost, net, onChange, onBg, imageUrl, onPickImage, onClearImage }: {
  store: BoardStore; version: number; bg: Bg; canDraw: boolean; isHost: boolean; net: (m: BoardMsg) => void; onChange: () => void;
  onBg?: (b: Bg) => void; imageUrl?: string | null; onPickImage?: (f: File) => void; onClearImage?: () => void;
}) {
  const ref = React.useRef<HTMLCanvasElement>(null);
  const laserRef = React.useRef<HTMLCanvasElement>(null);
  const boxRef = React.useRef<HTMLDivElement>(null);
  const fileRef = React.useRef<HTMLInputElement>(null);
  const [tool, setTool] = React.useState<Tool>("pen");
  const [color, setColor] = React.useState(0);
  const [width, setWidth] = React.useState(1);
  const [hint, setHint] = React.useState("");
  const [open, setOpen] = React.useState(true);
  const [bgOpen, setBgOpen] = React.useState(false);
  const [text, setText] = React.useState<{ x: number; y: number; v: string } | null>(null);
  const [redoN, setRedoN] = React.useState(0);
  const redo = React.useRef<Stroke[]>([]);
  const cur = React.useRef<{ id: number; kind: number; buf: number[]; lx: number; ly: number; x0: number; y0: number; ex: number; ey: number; dirty: boolean; timer: number } | null>(null);
  const laser = React.useRef<{ pts: Laser[]; on: boolean; raf: number; last: number }>({ pts: [], on: false, raf: 0, last: 0 });
  const st = React.useRef({ tool, color, width });
  st.current = { tool, color, width };

  // Telefonda asboblar qatori dastlab yig'iq (doskaning ustini yopmasligi uchun)
  React.useEffect(() => { setOpen(window.matchMedia("(min-width: 640px)").matches || !isHost); }, [isHost]); // doskaga chaqirilgan o'quvchida asboblar ochiq turadi
  // Qora doskada qora qalam ko'rinmaydi: rang avtomatik almashadi
  React.useEffect(() => { setColor((c) => (bg === "dark" && c === 0 ? 1 : bg !== "dark" && c === 1 ? 0 : c)); }, [bg]);

  React.useEffect(() => {
    const ctx = ref.current?.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, W, H);
    drawStrokes(ctx, store.strokes);
  }, [store, version]);

  // ---- Lazer ko'rsatkich (hamma ko'radi, saqlanmaydi)
  const paintLaser = React.useCallback(() => {
    const c = laserRef.current, L = laser.current;
    const ctx = c?.getContext("2d");
    if (!c || !ctx) return;
    const now = performance.now();
    L.pts = L.pts.filter((p) => now - p.t < 700);
    ctx.clearRect(0, 0, W, H);
    L.pts.forEach((p, i) => {
      const a = 1 - (now - p.t) / 700;
      ctx.fillStyle = `rgba(239,68,68,${a * 0.35})`;
      ctx.beginPath(); ctx.arc(px(p.x), py(p.y), 10 + i * 0.2, 0, Math.PI * 2); ctx.fill();
    });
    const last = L.pts[L.pts.length - 1];
    if (last && L.on) {
      ctx.fillStyle = "rgba(239,68,68,0.25)"; ctx.beginPath(); ctx.arc(px(last.x), py(last.y), 30, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#ef4444"; ctx.beginPath(); ctx.arc(px(last.x), py(last.y), 13, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = "#fff"; ctx.lineWidth = 3; ctx.stroke();
    }
    L.raf = L.pts.length || L.on ? requestAnimationFrame(paintLaser) : 0;
  }, []);
  const pushLaser = React.useCallback((m: { x: number; y: number } | null) => {
    const L = laser.current;
    if (m) { L.on = true; L.pts.push({ x: m.x, y: m.y, t: performance.now() }); if (L.pts.length > 40) L.pts.shift(); } else L.on = false;
    if (!L.raf) L.raf = requestAnimationFrame(paintLaser);
  }, [paintLaser]);
  React.useEffect(() => {
    const off = store.onLaser(pushLaser);
    const L = laser.current;
    return () => { off(); cancelAnimationFrame(L.raf); L.raf = 0; };
  }, [store, pushLaser]);

  // ---- Chizish
  const kindMsg = (c: NonNullable<typeof cur.current>, p: number[], replace = false): BoardMsg => ({ t: "b", id: c.id, k: c.kind, c: st.current.color, w: st.current.width, p, ...(replace && { r: 1 as const }) });
  const flush = React.useCallback(() => {
    const c = cur.current;
    if (!c) return;
    if (isShape(c.kind)) {
      if (c.dirty) { c.dirty = false; net(kindMsg(c, [c.x0, c.y0, c.ex, c.ey], true)); }
      return;
    }
    if (c.buf.length === 0) return;
    const buf = c.buf.splice(0, c.buf.length);
    for (let i = 0; i < buf.length; i += 400) net(kindMsg(c, buf.slice(i, i + 400)));
  }, [net]);
  const end = React.useCallback(() => {
    const c = cur.current;
    if (!c) return;
    window.clearInterval(c.timer);
    if (isShape(c.kind)) c.dirty = true;
    flush();
    cur.current = null;
    redo.current = []; setRedoN(0);
  }, [flush]);
  React.useEffect(() => end, [end]);

  function at(e: { clientX: number; clientY: number }) {
    const r = ref.current!.getBoundingClientRect();
    return [Math.max(0, Math.min(BOARD_X, Math.round(((e.clientX - r.left) / r.width) * BOARD_X))), Math.max(0, Math.min(BOARD_Y, Math.round(((e.clientY - r.top) / r.height) * BOARD_Y)))] as const;
  }
  function add(x: number, y: number) {
    const c = cur.current;
    if (!c) return;
    if (store.apply(kindMsg(c, [x, y]))) { c.buf.push(x, y); onChange(); }
  }
  const laserMove = React.useRef(0);
  const pendingText = React.useRef<readonly [number, number] | null>(null);
  function sendLaser(x: number, y: number) {
    const now = performance.now();
    if (now - laserMove.current < 35) return;
    laserMove.current = now;
    pushLaser({ x, y });
    net({ t: "l", x, y });
  }
  function down(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!canDraw || (e.pointerType === "mouse" && e.button > 0)) return;
    const t = st.current.tool;
    const [x, y] = at(e);
    if (t === "laser") { e.currentTarget.setPointerCapture(e.pointerId); sendLaser(x, y); return; }
    if (t === "text") { pendingText.current = [x, y]; return; } // matn maydoni qo'yib yuborilganda ochiladi (fokus bosish bilan yo'qolmasligi uchun)
    if (store.full) { setHint("Doska to'ldi. Sahifani tozalang yoki yangi sahifa oching."); return; }
    setHint("");
    e.currentTarget.setPointerCapture(e.pointerId);
    const kind = KIND_OF[t];
    cur.current = { id: Math.floor(Math.random() * 2 ** 31), kind, buf: [], lx: x, ly: y, x0: x, y0: y, ex: x, ey: y, dirty: false, timer: window.setInterval(flush, 50) };
    if (isShape(kind)) { store.apply(kindMsg(cur.current, [x, y, x, y], true)); onChange(); } else add(x, y);
  }
  function move(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!canDraw) return;
    if (st.current.tool === "laser") {
      if (e.pointerType === "mouse" || e.buttons) { const [x, y] = at(e); sendLaser(x, y); }
      return;
    }
    const c = cur.current;
    if (!c) return;
    if (isShape(c.kind)) {
      let [x, y] = at(e);
      if (e.shiftKey) [x, y] = constrainShape(c.kind, c.x0, c.y0, x, y);
      if (x === c.ex && y === c.ey) return;
      c.ex = x; c.ey = y; c.dirty = true;
      store.apply(kindMsg(c, [c.x0, c.y0, x, y], true)); onChange();
      return;
    }
    const evs = (e.nativeEvent as PointerEvent).getCoalescedEvents?.() ?? [];
    for (const ev of evs.length ? evs : [e.nativeEvent]) {
      const [x, y] = at(ev);
      if (Math.abs(x - c.lx) + Math.abs(y - c.ly) < 12) continue; // juda yaqin nuqtalar kerak emas
      c.lx = x; c.ly = y;
      add(x, y);
    }
  }
  function up() {
    if (st.current.tool === "text") {
      const pt = pendingText.current;
      pendingText.current = null;
      if (pt && canDraw) setText({ x: pt[0], y: pt[1], v: "" });
      return;
    }
    if (st.current.tool === "laser") { net({ t: "l" }); pushLaser(null); return; }
    end();
  }
  function leave() { if (st.current.tool === "laser" && canDraw) { net({ t: "l" }); pushLaser(null); } }

  const undo = React.useCallback(() => {
    const s = store.strokes[store.strokes.length - 1];
    if (!s || !store.apply({ t: "u" })) return;
    redo.current.push({ ...s, p: [...s.p] }); setRedoN(redo.current.length);
    net({ t: "u" }); onChange();
  }, [store, net, onChange]);
  const redoIt = React.useCallback(() => {
    const s = redo.current.pop();
    setRedoN(redo.current.length);
    if (!s) return;
    for (const m of BoardStore.strokeMsgs(s)) { store.apply(m); net(m); }
    onChange();
  }, [store, net, onChange]);
  function clear() {
    if (store.strokes.length === 0) return;
    if (!window.confirm("Sahifa tozalansinmi?")) return;
    store.apply({ t: "x" }); net({ t: "x" }); redo.current = []; setRedoN(0); onChange();
  }
  const page = React.useCallback((m: BoardMsg) => { if (store.apply(m)) { net(m); redo.current = []; setRedoN(0); onChange(); } }, [store, net, onChange]);

  function commitText() {
    const t = text;
    setText(null);
    if (!t || !t.v.trim()) return;
    const m: BoardMsg = { t: "b", id: Math.floor(Math.random() * 2 ** 31), k: KIND.text, c: st.current.color, w: st.current.width, p: [t.x, t.y], s: t.v.slice(0, MAX_TEXT) };
    if (store.apply(m)) { net(m); redo.current = []; setRedoN(0); onChange(); }
  }

  // Tezkor tugmalar (faqat chizish huquqi bor bo'lsa, matn yozilayotganda emas)
  React.useEffect(() => {
    if (!canDraw) return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable)) return;
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === "z") { e.preventDefault(); if (e.shiftKey) redoIt(); else if (isHost) undo(); return; }
      if (mod && e.key.toLowerCase() === "y") { e.preventDefault(); redoIt(); return; }
      if (mod || e.altKey) return;
      const k = e.key.toUpperCase();
      const found = TOOLS.find((x) => x.key === k);
      if (found) setTool(found.id);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [canDraw, isHost, undo, redoIt]);

  async function savePng() {
    const c = document.createElement("canvas");
    c.width = W; c.height = H;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    drawBg(ctx, bg);
    if (imageUrl) {
      try {
        const img = new Image();
        img.src = imageUrl;
        await img.decode();
        const k = Math.min(W / img.width, H / img.height);
        ctx.drawImage(img, (W - img.width * k) / 2, (H - img.height * k) / 2, img.width * k, img.height * k);
      } catch { /* rasm ochilmasa, uni qo'ymasdan saqlaymiz */ }
    }
    const layer = document.createElement("canvas");
    layer.width = W; layer.height = H;
    const lctx = layer.getContext("2d");
    if (lctx) { drawStrokes(lctx, store.strokes); ctx.drawImage(layer, 0, 0); }
    c.toBlob((b) => {
      if (!b) return;
      const url = URL.createObjectURL(b);
      const a = document.createElement("a");
      a.href = url; a.download = `doska-${store.cur + 1}.png`; a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }, "image/png");
  }

  const cursor = !canDraw ? "cursor-default" : tool === "text" ? "cursor-text" : tool === "laser" ? "cursor-none" : "cursor-crosshair";
  const multi = store.pages.length > 1;
  const showStyle = tool !== "laser";
  const fontPx = `calc(${FONT_SIZES[width]} / ${W} * 100cqw)`;
  const bs = bgStyle(bg);
  const btn = (on: boolean) => cn("grid h-7 w-7 shrink-0 place-items-center rounded-lg transition-colors sm:h-8 sm:w-8", on ? "bg-white text-slate-900" : "bg-white/10 text-white hover:bg-white/20");

  return (
    <div ref={boxRef} className="relative h-full w-full select-none overflow-hidden" style={{ ...bs, containerType: "inline-size" }}>
      {imageUrl && /* eslint-disable-next-line @next/next/no-img-element */ <img src={imageUrl} alt="Doskadagi rasm" className="pointer-events-none absolute inset-0 h-full w-full object-contain" draggable={false} />}
      <canvas ref={ref} width={W} height={H} className={cn("absolute inset-0 h-full w-full touch-none", cursor)} aria-label="Doska"
        onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} onPointerLeave={leave} onLostPointerCapture={() => { if (st.current.tool !== "laser") end(); }} />
      <canvas ref={laserRef} width={W} height={H} className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden />

      {!canDraw && store.strokes.length === 0 && !imageUrl && <p className={cn("pointer-events-none absolute inset-0 grid place-items-center px-4 text-center text-sm font-semibold", bg === "dark" ? "text-white/50" : "text-slate-400")}>Doska bo&apos;sh. Ustoz yozishni boshlaganda shu yerda ko&apos;rinadi.</p>}
      {hint && <p role="status" className="absolute left-1/2 top-12 -translate-x-1/2 rounded-lg bg-amber px-2.5 py-1 text-xs font-bold text-white">{hint}</p>}

      {text && (
        <div className="absolute z-10" style={{ left: `${(text.x / BOARD_X) * 100}%`, top: `${(text.y / BOARD_Y) * 100}%` }}>
          <textarea autoFocus value={text.v} onChange={(e) => setText({ ...text, v: e.target.value })} onBlur={commitText} maxLength={MAX_TEXT} rows={2} aria-label="Doskaga matn"
            onKeyDown={(e) => { if (e.key === "Escape") { e.preventDefault(); setText(null); } else if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); commitText(); } }}
            placeholder="Matn yozing..." style={{ fontSize: fontPx, lineHeight: 1.2, color: COLORS[color] }}
            className="min-w-48 resize-none rounded border-2 border-dashed border-primary bg-white/70 px-1 font-bold outline-none placeholder:text-slate-400" />
          <div className="mt-1 flex gap-1.5 text-[11px] font-semibold text-slate-700">
            <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={commitText} className="inline-flex items-center gap-1 rounded-md bg-primary px-2 py-1 text-white"><Check className="h-3.5 w-3.5" aria-hidden />Qo&apos;yish</button>
            <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => setText(null)} className="inline-flex items-center gap-1 rounded-md bg-white/90 px-2 py-1"><X className="h-3.5 w-3.5" aria-hidden />Bekor</button>
          </div>
        </div>
      )}

      {/* Yuqori chap: sahifalar */}
      {(isHost || multi) && (
        <div className="absolute left-2 top-2 flex items-center gap-1 rounded-xl bg-slate-900/80 p-1 text-white backdrop-blur" role="group" aria-label="Sahifalar">
          {isHost && <button type="button" className={btn(false)} onClick={() => page({ t: "pg", i: store.cur - 1 })} disabled={store.cur === 0} aria-label="Oldingi sahifa"><ChevronLeft className="h-4 w-4" aria-hidden /></button>}
          <span className="min-w-12 px-1 text-center text-xs font-bold tabular-nums" aria-live="polite" aria-label="Joriy sahifa">{store.cur + 1} / {store.pages.length}</span>
          {isHost && <button type="button" className={btn(false)} onClick={() => page({ t: "pg", i: store.cur + 1 })} disabled={store.cur >= store.pages.length - 1} aria-label="Keyingi sahifa"><ChevronRight className="h-4 w-4" aria-hidden /></button>}
          {isHost && <button type="button" className={btn(false)} onClick={() => page({ t: "pa" })} aria-label="Yangi sahifa qo'shish" title="Yangi sahifa"><Plus className="h-4 w-4" aria-hidden /></button>}
          {isHost && multi && <button type="button" className={btn(false)} onClick={() => { if (store.strokes.length === 0 || window.confirm("Bu sahifa o'chirilsinmi?")) page({ t: "pd" }); }} aria-label="Sahifani o'chirish" title="Sahifani o'chirish"><Trash2 className="h-4 w-4" aria-hidden /></button>}
        </div>
      )}

      {/* Yuqori o'ng: fon, rasm, saqlash (to'liq ekran tugmasi uchun joy qoldirilgan) */}
      <div className="absolute right-14 top-2 flex items-center gap-1 rounded-xl bg-slate-900/80 p-1 text-white backdrop-blur">
        {isHost && onBg && (
          <div className="relative">
            <button type="button" className={btn(bgOpen)} onClick={() => setBgOpen((v) => !v)} aria-label="Doska foni" aria-expanded={bgOpen} title="Doska foni"><Palette className="h-4 w-4" aria-hidden /></button>
            {bgOpen && (
              <div className="absolute right-0 top-10 z-20 w-44 rounded-xl bg-slate-900/95 p-1.5 shadow-lg" role="menu" aria-label="Doska foni">
                {BGS.map((b) => (
                  <button key={b} type="button" role="menuitemradio" aria-checked={bg === b} onClick={() => { onBg(b); setBgOpen(false); }} className={cn("flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs font-semibold", bg === b ? "bg-white text-slate-900" : "text-white hover:bg-white/10")}>
                    <span className="h-5 w-7 shrink-0 rounded border border-white/30" style={{ ...bgStyle(b), backgroundSize: b === "grid" || b === "dots" || b === "axes" ? "25% 33%" : bgStyle(b).backgroundSize }} />{BG_NAMES[b]}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
        {isHost && onPickImage && (
          <>
            <button type="button" className={btn(!!imageUrl)} onClick={() => (imageUrl && onClearImage ? onClearImage() : fileRef.current?.click())} aria-label={imageUrl ? "Rasmni olib tashlash" : "Rasm qo'yish"} title={imageUrl ? "Rasmni olib tashlash" : "Rasm qo'yish (varaq, kitob sahifasi)"}>
              {imageUrl ? <X className="h-4 w-4" aria-hidden /> : <ImagePlus className="h-4 w-4" aria-hidden />}
            </button>
            <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" aria-label="Rasm tanlash" tabIndex={-1} onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) onPickImage(f); }} />
          </>
        )}
        <button type="button" className={btn(false)} onClick={() => void savePng()} aria-label="Doskani rasmga saqlash" title="Rasmga saqlash (PNG)"><Download className="h-4 w-4" aria-hidden /></button>
      </div>

      {/* Pastki: asboblar (faqat chizish huquqi bor ishtirokchiga) */}
      {canDraw && (
        <div className="absolute inset-x-0 bottom-0 flex flex-col items-center gap-1 p-1.5">
          {open && (
            <div className="flex max-w-full flex-col gap-1 rounded-2xl bg-slate-900/85 p-1.5 text-white shadow-lg backdrop-blur sm:items-center sm:gap-1.5" role="toolbar" aria-label="Doska asboblari">
              <div className="flex max-w-full items-center gap-1 overflow-x-auto sm:flex-wrap sm:justify-center sm:overflow-visible">
                {TOOLS.map((t) => (
                  <button key={t.id} type="button" className={btn(tool === t.id)} onClick={() => setTool(t.id)} aria-label={t.label} aria-pressed={tool === t.id} title={`${t.label} (${t.key})`}><t.icon className="h-4 w-4" aria-hidden /></button>
                ))}
                {isHost && (
                  <>
                    <span className="mx-0.5 h-5 w-px bg-white/30" aria-hidden />
                    <button type="button" className={btn(false)} onClick={undo} aria-label="Oxirgi chiziqni bekor qilish" title="Bekor qilish (Ctrl+Z)"><Undo2 className="h-4 w-4" aria-hidden /></button>
                    <button type="button" className={cn(btn(false), redoN === 0 && "opacity-40")} onClick={redoIt} disabled={redoN === 0} aria-label="Qaytarish" title="Qaytarish (Ctrl+Y)"><Redo2 className="h-4 w-4" aria-hidden /></button>
                    <button type="button" className={btn(false)} onClick={clear} aria-label="Sahifani tozalash" title="Sahifani tozalash"><Trash2 className="h-4 w-4" aria-hidden /></button>
                  </>
                )}
              </div>
              {showStyle && (
                <div className="flex max-w-full items-center gap-1 overflow-x-auto sm:flex-wrap sm:justify-center sm:overflow-visible">
                  {tool !== "eraser" && COLORS.map((c, i) => (
                    <button key={c} type="button" onClick={() => setColor(i)} aria-label={COLOR_NAMES[i]} aria-pressed={color === i}
                      className={cn("h-6 w-6 shrink-0 rounded-full border-2 sm:h-7 sm:w-7", color === i ? "border-sky-300 ring-2 ring-white" : "border-white/40")} style={{ backgroundColor: c }} />
                  ))}
                  {tool !== "eraser" && <span className="mx-0.5 h-5 w-px bg-white/30" aria-hidden />}
                  {WIDTHS.map((w, i) => (
                    <button key={w} type="button" className={btn(width === i)} onClick={() => setWidth(i)} aria-label={tool === "text" ? `Matn o'lchami ${i + 1}` : tool === "eraser" ? `O'chirg'ich ${WIDTH_NAMES[i]}` : WIDTH_NAMES[i]} aria-pressed={width === i}>
                      {tool === "text" ? <span className="font-extrabold" style={{ fontSize: 9 + i * 3 }}>A</span> : <span className={cn("rounded-full", width === i ? "bg-slate-900" : "bg-white")} style={{ width: 3 + i * 3 + (tool === "eraser" ? 4 : 0), height: 3 + i * 3 + (tool === "eraser" ? 4 : 0) }} />}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          <button type="button" onClick={() => setOpen((v) => !v)} className="inline-flex items-center gap-1 rounded-full bg-slate-900/80 px-2.5 py-1 text-[11px] font-bold text-white backdrop-blur" aria-expanded={open} aria-label={open ? "Asboblarni yig'ish" : "Asboblarni ochish"}>
            <ChevronsUpDown className="h-3 w-3" aria-hidden />{open ? "Yig'ish" : "Asboblar"}
          </button>
        </div>
      )}
    </div>
  );
}

