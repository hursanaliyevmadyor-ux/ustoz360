"use client";
import * as React from "react";
import {
  ArrowLeftRight, ArrowUpRight, BoxSelect, Brush, Check, ChevronLeft, ChevronRight, Circle, Crosshair, Delete, Download, Eraser, Highlighter, ImagePlus, Lasso, LayoutTemplate, LineChart, Maximize2, Minimize2,
  Minus, MousePointer2, Palette, Pencil, Plus, Redo2, Shapes, Smile, Square, Trash2, Type, Undo2, X,
} from "lucide-react";
import {
  BGS, BG_NAMES, BOARD_X, BOARD_Y, BoardHistory, BoardStore, COLORS, COLOR_NAMES, ERASER_W, FONT_SIZES, KIND, MAX_TEXT, OPT_DASH, OPT_FILL, TEMPLATES, UNIT, WIDTHS, WIDTH_NAMES,
  bgStyle, bundle, constrainShape, hitTest, isClosed, isEraserKind, isShape, shapePoly, strokeBBox, templateMsgs, type Bg, type BoardMsg, type Stroke, type TemplateId,
} from "@/lib/board";
import { graphMsgs } from "@/lib/grapher";
import { SYMBOL_ORDER, SYMBOL_TABS, subjectOf, type SymbolGroup } from "@/lib/subjects";
import { cn } from "@/lib/utils";

const W = 1600;
const H = 900;
type Tool = "select" | "pen" | "hl" | "eraser" | "earea" | "elasso" | "oeraser" | "shape" | "text" | "sticker" | "laser" | "tpl";

const px = (v: number) => (v / BOARD_X) * W;
const py = (v: number) => (v / BOARD_Y) * H;

/** Chiziqlarni chizadi (ekranda ham, rasmga saqlashda ham bir xil). */
export function drawStrokes(ctx: CanvasRenderingContext2D, strokes: readonly Stroke[]) {
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  for (const s of strokes) {
    const n = s.p.length / 2;
    if (n === 0) continue;
    const eraser = isEraserKind(s.k);
    ctx.globalCompositeOperation = eraser ? "destination-out" : "source-over";
    ctx.globalAlpha = s.k === KIND.hl ? 0.35 : 1;
    const color = eraser ? "#000" : COLORS[s.c] ?? COLORS[0];
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    const base = WIDTHS[s.w] ?? WIDTHS[1];
    ctx.lineWidth = s.k === KIND.hl ? base * 3.5 : s.k === KIND.eraser ? ERASER_W[s.w] ?? ERASER_W[1] : base;
    ctx.setLineDash([]);
    if (s.k === KIND.area) { // to'rtburchak hudud: ichidagi hamma narsa o'chadi
      const x1 = px(s.p[0]!), y1 = py(s.p[1]!), x2 = px(s.p[2]!), y2 = py(s.p[3]!);
      ctx.fillRect(Math.min(x1, x2), Math.min(y1, y2), Math.abs(x2 - x1), Math.abs(y2 - y1));
      continue;
    }
    if (s.k === KIND.lasso) { // erkin hudud: yopiq chiziq ichi o'chadi
      ctx.beginPath();
      for (let i = 0; i < n; i++) (i === 0 ? ctx.moveTo(px(s.p[0]!), py(s.p[1]!)) : ctx.lineTo(px(s.p[i * 2]!), py(s.p[i * 2 + 1]!)));
      ctx.closePath(); ctx.fill();
      continue;
    }
    if (s.k === KIND.text) {
      const size = FONT_SIZES[s.w] ?? FONT_SIZES[1];
      ctx.font = `700 ${size}px ui-sans-serif, system-ui, "Segoe UI", "Apple Color Emoji", "Segoe UI Emoji", sans-serif`;
      ctx.textBaseline = "top";
      (s.s ?? "").split("\n").forEach((line, i) => ctx.fillText(line, px(s.p[0]!), py(s.p[1]!) + i * size * 1.2));
      continue;
    }
    if (isShape(s.k)) {
      const x1 = px(s.p[0]!), y1 = py(s.p[1]!), x2 = px(s.p[2]!), y2 = py(s.p[3]!);
      if ((s.o ?? 0) & OPT_DASH) ctx.setLineDash([base * 2.4, base * 2.4]);
      ctx.beginPath();
      const head = (ax: number, ay: number, bx: number, by: number) => {
        const a = Math.atan2(by - ay, bx - ax), len = Math.max(18, base * 4.5);
        ctx.moveTo(bx, by); ctx.lineTo(bx - len * Math.cos(a - 0.45), by - len * Math.sin(a - 0.45));
        ctx.moveTo(bx, by); ctx.lineTo(bx - len * Math.cos(a + 0.45), by - len * Math.sin(a + 0.45));
      };
      if (s.k === KIND.rect) ctx.rect(Math.min(x1, x2), Math.min(y1, y2), Math.abs(x2 - x1), Math.abs(y2 - y1));
      else if (s.k === KIND.ellipse) ctx.ellipse((x1 + x2) / 2, (y1 + y2) / 2, Math.abs(x2 - x1) / 2, Math.abs(y2 - y1) / 2, 0, 0, Math.PI * 2);
      else if (s.k === KIND.line || s.k === KIND.arrow || s.k === KIND.darrow) {
        ctx.moveTo(x1, y1); ctx.lineTo(x2, y2);
        if (s.k !== KIND.line) head(x1, y1, x2, y2);
        if (s.k === KIND.darrow) head(x2, y2, x1, y1);
      } else {
        const poly = shapePoly(s.k, x1, y1, x2, y2);
        poly.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
        ctx.closePath();
      }
      if (isClosed(s.k) && ((s.o ?? 0) & OPT_FILL)) { ctx.globalAlpha = 0.3; ctx.fill(); ctx.globalAlpha = 1; }
      ctx.stroke();
      ctx.setLineDash([]);
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
  ctx.setLineDash([]);
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

/** Shakl belgisi (qalin chiziqli kichik rasm): asboblar paneli va tanlash oynasi uchun. */
function ShapeIcon({ k, className }: { k: number; className?: string }) {
  const p = { fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" } as const;
  return (
    <svg viewBox="0 0 24 24" className={cn("h-5 w-5", className)} aria-hidden>
      {k === KIND.line && <path d="M4 19 20 5" {...p} />}
      {k === KIND.arrow && <path d="M4 19 20 5M11 5h9v9" {...p} />}
      {k === KIND.darrow && <path d="M5 19 19 5M5 12v7h7M12 5h7v7" {...p} />}
      {k === KIND.rect && <rect x="4" y="6" width="16" height="12" rx="1" {...p} />}
      {k === KIND.ellipse && <ellipse cx="12" cy="12" rx="8.5" ry="6.5" {...p} />}
      {k === KIND.triangle && <path d="M12 5 20 19H4Z" {...p} />}
      {k === KIND.rtri && <path d="M5 5v14h14Z" {...p} />}
      {k === KIND.diamond && <path d="M12 3.5 20.5 12 12 20.5 3.5 12Z" {...p} />}
      {k === KIND.star && <path d="m12 3.5 2.6 5.6 6.1.7-4.5 4.2 1.2 6L12 17l-5.4 3 1.2-6-4.5-4.2 6.1-.7Z" {...p} />}
    </svg>
  );
}
const SHAPES: { k: number; name: string }[] = [
  { k: KIND.line, name: "Chiziq" }, { k: KIND.arrow, name: "Strelka" }, { k: KIND.darrow, name: "Ikki tomonlama strelka" },
  { k: KIND.rect, name: "To'rtburchak" }, { k: KIND.ellipse, name: "Ellips" }, { k: KIND.triangle, name: "Uchburchak" },
  { k: KIND.rtri, name: "To'g'ri burchakli uchburchak" }, { k: KIND.diamond, name: "Romb" }, { k: KIND.star, name: "Yulduz" },
];
const STICKERS = ["✅", "❌", "⭐", "❤️", "👍", "👏", "😀", "🤔", "❗", "❓", "💡", "🎯", "🏆", "➕", "➖", "✖️", "➗", "🔥", "📌", "🎉", "😍", "👀", "🌟", "📚"];
const HINTS: Partial<Record<Tool, string>> = {
  select: "Chiziqni bosing va sudrab ko'chiring. Delete tugmasi uni o'chiradi.",
  oeraser: "Bosilgan chiziq butunlay o'chadi.",
  earea: "Joyni belgilab torting: ichidagi hammasi birdan o'chadi.",
  elasso: "Erkin chizing: yopiq hudud ichidagi hammasi o'chadi.",
  eraser: "Surtib o'chiring. Katta o'lcham tez o'chiradi.",
  laser: "Bosib turib ko'rsating: hamma qizil nuqtani ko'radi.",
  text: "Joyni bosing va yozing. Tugallash: boshqa joyni bosing.",
  sticker: "Stikerni qo'yish uchun doskani bosing.",
  tpl: "Joyni bosing: chizma shu yerga tushadi.",
};

type Laser = { x: number; y: number; t: number };
type Pop = { id: "shape" | "sticker" | "tpl" | "bg" | "eraser" | "graph"; x: number; y: number; w: number; h: number } | null;

/**
 * Doska. Doska maydoni (16:9) asboblardan ajratilgan: yuqorida sahifalar va amallar, chapda asboblar, pastda rang va qalinlik.
 * Ustoz (va ustoz chaqirgan o'quvchi, canDraw) chizadi; ustoz sahifalar, fon va rasmni boshqaradi, tanlab ko'chiradi va shablon qo'yadi.
 * Hamma ko'radi va rasmga (PNG) saqlab oladi. Chiziqlar `store` da turadi va `net` orqali hammaga yuboriladi.
 */
export function Whiteboard({ store, version, bg, canDraw, isHost, net, onChange, onBg, imageUrl, onPickImage, onClearImage, subject }: {
  store: BoardStore; version: number; bg: Bg; canDraw: boolean; isHost: boolean; net: (m: BoardMsg) => void; onChange: () => void;
  onBg?: (b: Bg) => void; imageUrl?: string | null; onPickImage?: (f: File) => void; onClearImage?: () => void; subject?: string | null;
}) {
  const subj = subjectOf(subject);
  const ref = React.useRef<HTMLCanvasElement>(null);
  const laserRef = React.useRef<HTMLCanvasElement>(null);
  const frameRef = React.useRef<HTMLDivElement>(null);
  const popRef = React.useRef<HTMLDivElement>(null);
  const fileRef = React.useRef<HTMLInputElement>(null);
  const taRef = React.useRef<HTMLTextAreaElement>(null);
  const [tool, setTool] = React.useState<Tool>("pen");
  const [eraserTool, setEraserTool] = React.useState<"earea" | "elasso" | "eraser" | "oeraser">("earea");
  const [symTab, setSymTab] = React.useState<SymbolGroup>(subj?.sym ?? "mat");
  const [area, setArea] = React.useState<{ x0: number; y0: number; x1: number; y1: number } | null>(null);
  const [lasso, setLasso] = React.useState<number[] | null>(null);
  const [expr, setExpr] = React.useState("");
  const [exprErr, setExprErr] = React.useState("");
  const drag = React.useRef<{ x0: number; y0: number; lx: number; ly: number; pts: number[] } | null>(null);
  const [shapeKind, setShapeKind] = React.useState<number>(KIND.rect);
  const [color, setColor] = React.useState(0);
  const [width, setWidth] = React.useState(1);
  const [ew, setEw] = React.useState(2); // o'chirg'ich o'lchami alohida: qalam yo'g'onlashib ketmasin
  const [fill, setFill] = React.useState(false);
  const [dash, setDash] = React.useState(false);
  const [sticker, setSticker] = React.useState("⭐");
  const [tpl, setTpl] = React.useState<TemplateId>("table");
  const [selected, setSelected] = React.useState<number | null>(null);
  const [hint, setHint] = React.useState("");
  const [open, setOpen] = React.useState(true);
  const [fs, setFs] = React.useState(false);
  const [pop, setPop] = React.useState<Pop>(null);
  const [text, setText] = React.useState<{ x: number; y: number; v: string } | null>(null);
  const [, setHv] = React.useState(0);
  const hist = React.useMemo(() => new BoardHistory(), []);
  const bumpH = React.useCallback(() => setHv((v) => v + 1), []);
  const cur = React.useRef<{ id: number; kind: number; buf: number[]; lx: number; ly: number; x0: number; y0: number; ex: number; ey: number; dirty: boolean; timer: number } | null>(null);
  const mv = React.useRef<{ id: number; lx: number; ly: number; tx: number; ty: number; px: number; py: number; timer: number } | null>(null);
  const oe = React.useRef<Stroke[] | null>(null);
  const laser = React.useRef<{ pts: Laser[]; on: boolean; raf: number }>({ pts: [], on: false, raf: 0 });
  const st = React.useRef({ tool, shapeKind, color, width, ew, fill, dash, sticker, tpl });
  st.current = { tool, shapeKind, color, width, ew, fill, dash, sticker, tpl };
  const pendingText = React.useRef<readonly [number, number] | null>(null);
  const laserMove = React.useRef(0);

  // Asboblar doska maydonidan tashqarida turadi, shuning uchun dastlab ochiq; telefonda yig'ib qo'yish mumkin
  React.useEffect(() => { setOpen(true); }, [isHost]);
  // Qora doskada qora qalam ko'rinmaydi: rang avtomatik almashadi
  React.useEffect(() => { setColor((c) => (bg === "dark" && c === 0 ? 1 : bg !== "dark" && c === 1 ? 0 : c)); }, [bg]);
  // Chizish huquqi olinsa, asboblar tozalanadi
  React.useEffect(() => { if (!canDraw) { setSelected(null); setPop(null); setText(null); } }, [canDraw]);
  // O'quvchi uchun tanlash, obyekt o'chirg'ich va shablon yo'q
  React.useEffect(() => { if (!isHost && (tool === "select" || tool === "oeraser" || tool === "tpl")) setTool("pen"); if (!isHost && eraserTool === "oeraser") setEraserTool("earea"); }, [isHost, tool, eraserTool]);
  React.useEffect(() => {
    const onFs = () => setFs(document.fullscreenElement === frameRef.current);
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  React.useEffect(() => {
    const ctx = ref.current?.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, W, H);
    drawStrokes(ctx, store.strokes);
  }, [store, version]);

  // Oynadan tashqariga bosilsa yoki Esc bosilsa, ochiq oyna yopiladi
  React.useEffect(() => {
    if (!pop) return;
    const down = (e: PointerEvent) => { if (!popRef.current?.contains(e.target as Node) && !(e.target as HTMLElement).closest("[data-pop-anchor]")) setPop(null); };
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") setPop(null); };
    document.addEventListener("pointerdown", down); document.addEventListener("keydown", key);
    return () => { document.removeEventListener("pointerdown", down); document.removeEventListener("keydown", key); };
  }, [pop]);

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

  // ---- Yordamchilar
  const rid = () => Math.floor(Math.random() * 2 ** 31);
  const copy = (s: Stroke): Stroke => ({ ...s, p: [...s.p] });
  const send = React.useCallback((msgs: BoardMsg[]) => { for (const m of bundle(msgs)) net(m); }, [net]);
  const optBits = () => { const t = st.current; return t.tool === "shape" ? ((isClosed(t.shapeKind) && t.fill ? OPT_FILL : 0) | (t.dash ? OPT_DASH : 0)) : 0; };
  const kindOfTool = (t: Tool) => (t === "pen" ? KIND.pen : t === "hl" ? KIND.hl : t === "eraser" ? KIND.eraser : st.current.shapeKind);
  const kindMsg = (c: NonNullable<typeof cur.current>, p: number[], replace = false): BoardMsg => {
    const o = optBits();
    return { t: "b", id: c.id, k: c.kind, c: st.current.color, w: c.kind === KIND.eraser ? st.current.ew : st.current.width, p, ...(replace && { r: 1 as const }), ...(o && { o }) };
  };

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [net]);
  const flushMove = React.useCallback(() => {
    const m = mv.current;
    if (!m || (m.px === 0 && m.py === 0)) return;
    net({ t: "mv", id: m.id, dx: m.px, dy: m.py });
    m.px = 0; m.py = 0;
  }, [net]);

  const finish = React.useCallback(() => {
    const c = cur.current;
    if (c) {
      window.clearInterval(c.timer);
      if (isShape(c.kind)) c.dirty = true;
      flush();
      if (isHost) { hist.record({ t: "add", ids: [c.id] }); bumpH(); }
      cur.current = null;
    }
    const m = mv.current;
    if (m) {
      window.clearInterval(m.timer);
      flushMove();
      if (m.tx !== 0 || m.ty !== 0) { hist.record({ t: "mv", id: m.id, dx: m.tx, dy: m.ty }); bumpH(); }
      mv.current = null;
    }
    const e = oe.current;
    if (e) {
      oe.current = null;
      if (e.length) { hist.record({ t: "rm", strokes: e }); bumpH(); }
    }
  }, [flush, flushMove, hist, bumpH, isHost]);
  React.useEffect(() => finish, [finish]);

  function at(e: { clientX: number; clientY: number }) {
    const r = ref.current!.getBoundingClientRect();
    return [Math.max(0, Math.min(BOARD_X, Math.round(((e.clientX - r.left) / r.width) * BOARD_X))), Math.max(0, Math.min(BOARD_Y, Math.round(((e.clientY - r.top) / r.height) * BOARD_Y)))] as const;
  }
  function add(x: number, y: number) {
    const c = cur.current;
    if (!c) return;
    if (store.apply(kindMsg(c, [x, y]))) { c.buf.push(x, y); onChange(); }
  }
  function sendLaser(x: number, y: number) {
    const now = performance.now();
    if (now - laserMove.current < 35) return;
    laserMove.current = now;
    pushLaser({ x, y });
    net({ t: "l", x, y });
  }
  function eraseAt(x: number, y: number) {
    const e = oe.current;
    if (!e) return;
    const hit = hitTest(store.strokes, x, y, 16 * UNIT);
    if (!hit) return;
    e.push(copy(hit));
    const m: BoardMsg = { t: "rm", id: hit.id };
    if (store.apply(m)) { net(m); if (selected === hit.id) setSelected(null); onChange(); }
  }
  /** Bitta chiziq qo'yadi (stiker yoki matn) va tarixga yozadi. */
  function stamp(msg: BoardMsg) {
    if (!store.apply(msg)) return;
    net(msg);
    if (isHost && msg.t === "b") { hist.record({ t: "add", ids: [msg.id] }); bumpH(); }
    onChange();
  }

  function down(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!canDraw || (e.pointerType === "mouse" && e.button > 0)) return;
    const t = st.current.tool;
    const [x, y] = at(e);
    setPop(null);
    if (t === "laser") { e.currentTarget.setPointerCapture(e.pointerId); sendLaser(x, y); return; }
    if (t === "text") { pendingText.current = [x, y]; return; } // matn maydoni qo'yib yuborilganda ochiladi (fokus bosish bilan yo'qolmasligi uchun)
    if (t === "select") {
      const hit = hitTest(store.strokes, x, y, 18 * UNIT);
      setSelected(hit ? hit.id : null);
      if (hit) { e.currentTarget.setPointerCapture(e.pointerId); mv.current = { id: hit.id, lx: x, ly: y, tx: 0, ty: 0, px: 0, py: 0, timer: window.setInterval(flushMove, 50) }; }
      return;
    }
    if (t === "oeraser") { e.currentTarget.setPointerCapture(e.pointerId); oe.current = []; eraseAt(x, y); return; }
    if (t === "earea" || t === "elasso") {
      e.currentTarget.setPointerCapture(e.pointerId);
      drag.current = { x0: x, y0: y, lx: x, ly: y, pts: [x, y] };
      if (t === "earea") setArea({ x0: x, y0: y, x1: x, y1: y }); else setLasso([x, y]);
      return;
    }
    if (t === "sticker") {
      const size = (FONT_SIZES[st.current.width] ?? FONT_SIZES[1]) * UNIT;
      stamp({ t: "b", id: rid(), k: KIND.text, c: st.current.color, w: st.current.width, p: [Math.max(0, Math.round(x - size * 0.5)), Math.max(0, Math.min(BOARD_Y, Math.round(y - size * 0.6)))], s: st.current.sticker });
      return;
    }
    if (t === "tpl") {
      const msgs = templateMsgs(st.current.tpl, x, y, st.current.color, st.current.width, rid);
      msgs.forEach((m) => store.apply(m));
      send(msgs);
      hist.record({ t: "add", ids: msgs.map((m) => (m as { id: number }).id) }); bumpH();
      onChange(); setTool("select");
      return;
    }
    if (store.full) { setHint("Doska to'ldi. Sahifani tozalang yoki yangi sahifa oching."); return; }
    setHint("");
    e.currentTarget.setPointerCapture(e.pointerId);
    const kind = kindOfTool(t);
    cur.current = { id: rid(), kind, buf: [], lx: x, ly: y, x0: x, y0: y, ex: x, ey: y, dirty: false, timer: window.setInterval(flush, 50) };
    if (isShape(kind)) { store.apply(kindMsg(cur.current, [x, y, x, y], true)); onChange(); } else add(x, y);
  }
  function move(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!canDraw) return;
    const t = st.current.tool;
    if (t === "laser") { if (e.pointerType === "mouse" || e.buttons) { const [x, y] = at(e); sendLaser(x, y); } return; }
    const m = mv.current;
    if (m) {
      const [x, y] = at(e);
      const s = store.find(m.id);
      if (!s) return;
      const bx = s.p[0]!, by = s.p[1]!;
      if (store.apply({ t: "mv", id: m.id, dx: x - m.lx, dy: y - m.ly })) {
        const dx = s.p[0]! - bx, dy = s.p[1]! - by; // chegarada siljish kamayishi mumkin: haqiqiy siljish yuboriladi
        m.tx += dx; m.ty += dy; m.px += dx; m.py += dy; onChange();
      }
      m.lx = x; m.ly = y;
      return;
    }
    if (oe.current) { const [x, y] = at(e); eraseAt(x, y); return; }
    const dg = drag.current;
    if (dg) {
      const [x, y] = at(e);
      dg.lx = x; dg.ly = y;
      if (st.current.tool === "earea") setArea({ x0: dg.x0, y0: dg.y0, x1: x, y1: y });
      else if (Math.abs(x - dg.pts[dg.pts.length - 2]!) + Math.abs(y - dg.pts[dg.pts.length - 1]!) >= 30) { dg.pts.push(x, y); setLasso([...dg.pts]); }
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
  /** Hudud o'chirg'ich tugadi: belgilangan joydagi hamma narsa o'chadi (bitta harakat, bekor qilish mumkin). */
  function finishErase() {
    const dg = drag.current;
    drag.current = null;
    setArea(null); setLasso(null);
    if (!dg) return;
    if (st.current.tool === "earea") {
      if (Math.abs(dg.lx - dg.x0) < 60 || Math.abs(dg.ly - dg.y0) < 60) return; // juda kichik: tasodifiy bosish
      stamp({ t: "b", id: rid(), k: KIND.area, c: 0, w: 0, p: [dg.x0, dg.y0, dg.lx, dg.ly], r: 1 });
      return;
    }
    if (dg.pts.length < 6) return;
    const step = Math.max(1, Math.ceil(dg.pts.length / 2 / 180)); // eng ko'pi bilan ~180 nuqta
    const p: number[] = [];
    for (let i = 0; i < dg.pts.length / 2; i += step) p.push(dg.pts[i * 2]!, dg.pts[i * 2 + 1]!);
    const msgs = BoardStore.strokeMsgs({ id: rid(), k: KIND.lasso, c: 0, w: 0, p });
    msgs.forEach((m) => store.apply(m));
    send(msgs);
    if (isHost) { hist.record({ t: "add", ids: [(msgs[0] as { id: number }).id] }); bumpH(); }
    onChange();
  }
  function up() {
    const t = st.current.tool;
    if (t === "earea" || t === "elasso") { finishErase(); return; }
    if (t === "text") {
      const pt = pendingText.current;
      pendingText.current = null;
      if (pt && canDraw) setText({ x: pt[0], y: pt[1], v: "" });
      return;
    }
    if (t === "laser") { net({ t: "l" }); pushLaser(null); return; }
    finish();
  }
  function leave() { if (st.current.tool === "laser" && canDraw) { net({ t: "l" }); pushLaser(null); } }

  // ---- Tarix (faqat ustozda)
  const undo = React.useCallback(() => { const msgs = hist.undo(store); if (msgs) { send(msgs); setSelected(null); onChange(); bumpH(); } }, [hist, store, send, onChange, bumpH]);
  const redo = React.useCallback(() => { const msgs = hist.redo(store); if (msgs) { send(msgs); onChange(); bumpH(); } }, [hist, store, send, onChange, bumpH]);
  function clearPage() {
    if (store.strokes.length === 0) return;
    if (!window.confirm("Sahifa tozalansinmi?")) return;
    const all = store.strokes.map(copy);
    store.apply({ t: "x" }); net({ t: "x" });
    hist.record({ t: "rm", strokes: all }); setSelected(null); bumpH(); onChange();
  }
  const removeSelected = React.useCallback(() => {
    const s = selected === null ? null : store.find(selected);
    if (!s) return;
    const m: BoardMsg = { t: "rm", id: s.id };
    const snap = copy(s);
    if (store.apply(m)) { net(m); hist.record({ t: "rm", strokes: [snap] }); setSelected(null); bumpH(); onChange(); }
  }, [selected, store, net, hist, bumpH, onChange]);
  const page = React.useCallback((m: BoardMsg) => { if (store.apply(m)) { net(m); hist.clear(); setSelected(null); bumpH(); onChange(); } }, [store, net, hist, bumpH, onChange]);

  function commitText() {
    const t = text;
    setText(null);
    if (!t || !t.v.trim()) return;
    stamp({ t: "b", id: rid(), k: KIND.text, c: st.current.color, w: st.current.width, p: [t.x, t.y], s: t.v.slice(0, MAX_TEXT) });
  }
  function insertSymbol(sym: string) {
    const ta = taRef.current;
    if (!ta || !text) return;
    const a = ta.selectionStart ?? text.v.length, b = ta.selectionEnd ?? a;
    const v = (text.v.slice(0, a) + sym + text.v.slice(b)).slice(0, MAX_TEXT);
    setText({ ...text, v });
    requestAnimationFrame(() => { ta.focus(); ta.setSelectionRange(a + sym.length, a + sym.length); });
  }

  /** Formula bo'yicha grafikni doskaga chizadi (koordinata fonida); bitta harakat sifatida bekor qilinadi. */
  function plotGraph() {
    const c = st.current.color === 1 && bg !== "dark" ? 3 : st.current.color;
    const msgs = graphMsgs(expr, c, st.current.width, rid);
    if (msgs === null) { setExprErr("Formula tushunarsiz. Masalan: x^2, 2x+1, sin(x), 1/x"); return; }
    if (msgs.length === 0) { setExprErr("Bu formulaning grafigi ko'rinadigan sohada yo'q."); return; }
    setExprErr("");
    if (bg !== "axes") onBg?.("axes");
    msgs.forEach((m) => store.apply(m));
    send(msgs);
    hist.record({ t: "add", ids: [...new Set(msgs.map((m) => (m as { id: number }).id))] });
    bumpH(); onChange(); setPop(null);
  }

  // Tezkor tugmalar (faqat chizish huquqi bor bo'lsa, matn yozilayotganda emas)
  React.useEffect(() => {
    if (!canDraw) return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable)) return;
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === "z") { e.preventDefault(); if (!isHost) return; if (e.shiftKey) redo(); else undo(); return; }
      if (mod && e.key.toLowerCase() === "y") { e.preventDefault(); if (isHost) redo(); return; }
      if (mod || e.altKey) return;
      if ((e.key === "Delete" || e.key === "Backspace") && isHost && selected !== null) { e.preventDefault(); removeSelected(); return; }
      if (e.key === "Escape") { setSelected(null); return; }
      const map: Record<string, Tool> = { V: "select", P: "pen", M: "hl", E: eraserTool, X: "oeraser", S: "shape", T: "text", K: "laser" };
      const k = map[e.key.toUpperCase()];
      if (k && (isHost || (k !== "select" && k !== "oeraser"))) setTool(k);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [canDraw, isHost, undo, redo, selected, removeSelected, eraserTool]);

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
  function toggleFs() {
    const f = frameRef.current;
    if (!f) return;
    if (document.fullscreenElement) void document.exitFullscreen?.(); else void f.requestFullscreen?.();
  }
  function openPop(id: NonNullable<Pop>["id"], el: HTMLElement) {
    if (pop?.id === id) { setPop(null); return; }
    const r = el.getBoundingClientRect(), f = frameRef.current!.getBoundingClientRect();
    setPop({ id, x: r.left - f.left, y: r.top - f.top, w: r.width, h: r.height });
  }

  // ---- Ko'rinish
  const multi = store.pages.length > 1;
  const bs = bgStyle(bg);
  const fontPx = `calc(${FONT_SIZES[width]} / ${W} * 100cqw)`;
  const selStroke = selected === null ? null : store.find(selected);
  const selBox = selStroke ? strokeBBox(selStroke) : null;
  const drawTools = canDraw;
  const showColors = tool === "pen" || tool === "hl" || tool === "shape" || tool === "text" || tool === "sticker" || tool === "tpl";
  const showWidth = tool !== "select" && tool !== "laser" && tool !== "oeraser" && tool !== "earea" && tool !== "elasso";
  const cursor = !canDraw ? "cursor-default" : tool === "text" ? "cursor-text" : tool === "laser" ? "cursor-none" : tool === "select" ? "cursor-default" : "cursor-crosshair";
  const toolName: Record<Tool, string> = { select: "Tanlash", pen: "Qalam", hl: "Marker", eraser: "Surtib o'chirg'ich", earea: "Hudud o'chirg'ich", elasso: "Erkin hudud o'chirg'ich", oeraser: "Chiziqni o'chirish", shape: SHAPES.find((s) => s.k === shapeKind)?.name ?? "Shakl", text: "Matn", sticker: "Stiker", laser: "Lazer", tpl: "Shablon" };
  const tb = (on: boolean, extra?: string) => cn("grid h-9 w-9 shrink-0 place-items-center rounded-xl transition-colors disabled:opacity-35", on ? "bg-white text-slate-900 shadow" : "text-white/90 hover:bg-white/15", extra);
  const pill = (on: boolean) => cn("inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg px-2 text-xs font-bold transition-colors disabled:opacity-35", on ? "bg-white text-slate-900" : "bg-white/10 text-white hover:bg-white/20");
  const sep = <span className="mx-0.5 h-5 w-px shrink-0 bg-white/25 md:mx-0 md:my-0.5 md:h-px md:w-7" aria-hidden />;

  const isEraser = tool === "eraser" || tool === "earea" || tool === "elasso" || tool === "oeraser";
  const toolList = (
    <>
      {isHost && <button type="button" className={tb(tool === "select")} onClick={() => setTool("select")} aria-label="Tanlash" aria-pressed={tool === "select"} title="Tanlash va ko'chirish (V)"><MousePointer2 className="h-[18px] w-[18px]" aria-hidden /></button>}
      <button type="button" className={tb(tool === "pen")} onClick={() => setTool("pen")} aria-label="Qalam" aria-pressed={tool === "pen"} title="Qalam (P)"><Pencil className="h-[18px] w-[18px]" aria-hidden /></button>
      <button type="button" className={tb(tool === "hl")} onClick={() => setTool("hl")} aria-label="Marker" aria-pressed={tool === "hl"} title="Marker (M)"><Highlighter className="h-[18px] w-[18px]" aria-hidden /></button>
      <button type="button" data-pop-anchor className={tb(isEraser || pop?.id === "eraser")} onClick={(e) => { setTool(eraserTool); openPop("eraser", e.currentTarget); }} aria-label="O'chirg'ich" aria-pressed={isEraser} aria-expanded={pop?.id === "eraser"} title="O'chirg'ich turlari: hudud, erkin hudud, surtib, chiziqni (E)">
        {eraserTool === "earea" ? <BoxSelect className="h-[18px] w-[18px]" aria-hidden /> : eraserTool === "elasso" ? <Lasso className="h-[18px] w-[18px]" aria-hidden /> : eraserTool === "oeraser" ? <Delete className="h-[18px] w-[18px]" aria-hidden /> : <Eraser className="h-[18px] w-[18px]" aria-hidden />}
      </button>
      {sep}
      <button type="button" data-pop-anchor className={tb(tool === "shape" || pop?.id === "shape")} onClick={(e) => { setTool("shape"); openPop("shape", e.currentTarget); }} aria-label="Shakllar" aria-pressed={tool === "shape"} aria-expanded={pop?.id === "shape"} title={`Shakllar: ${toolName.shape} (S)`}><ShapeIcon k={shapeKind} /></button>
      <button type="button" className={tb(tool === "text")} onClick={() => setTool("text")} aria-label="Matn" aria-pressed={tool === "text"} title="Matn (T)"><Type className="h-[18px] w-[18px]" aria-hidden /></button>
      <button type="button" data-pop-anchor className={tb(tool === "sticker" || pop?.id === "sticker")} onClick={(e) => { setTool("sticker"); openPop("sticker", e.currentTarget); }} aria-label="Stikerlar" aria-pressed={tool === "sticker"} aria-expanded={pop?.id === "sticker"} title="Stikerlar"><Smile className="h-[18px] w-[18px]" aria-hidden /></button>
      {isHost && <button type="button" data-pop-anchor className={tb(tool === "tpl" || pop?.id === "tpl")} onClick={(e) => { openPop("tpl", e.currentTarget); }} aria-label="Shablonlar" aria-pressed={tool === "tpl"} aria-expanded={pop?.id === "tpl"} title="Shablonlar: jadval, sonlar o'qi, koordinata, Venn"><LayoutTemplate className="h-[18px] w-[18px]" aria-hidden /></button>}
      {isHost && <button type="button" data-pop-anchor className={tb(pop?.id === "graph")} onClick={(e) => openPop("graph", e.currentTarget)} aria-label="Grafik chizish" aria-expanded={pop?.id === "graph"} title="Formula bo'yicha grafik chizish (y = x², sin x ...)"><LineChart className="h-[18px] w-[18px]" aria-hidden /></button>}
      {sep}
      <button type="button" className={tb(tool === "laser")} onClick={() => setTool("laser")} aria-label="Lazer ko'rsatkich" aria-pressed={tool === "laser"} title="Lazer ko'rsatkich (K)"><Crosshair className="h-[18px] w-[18px]" aria-hidden /></button>
    </>
  );
  const actionList = isHost ? (
    <>
      <button type="button" className={tb(false)} onClick={undo} disabled={!hist.canUndo} aria-label="Bekor qilish" title="Bekor qilish (Ctrl+Z)"><Undo2 className="h-[18px] w-[18px]" aria-hidden /></button>
      <button type="button" className={tb(false)} onClick={redo} disabled={!hist.canRedo} aria-label="Qaytarish" title="Qaytarish (Ctrl+Y)"><Redo2 className="h-[18px] w-[18px]" aria-hidden /></button>
      <button type="button" className={tb(false)} onClick={clearPage} aria-label="Sahifani tozalash" title="Sahifani tozalash"><Trash2 className="h-[18px] w-[18px]" aria-hidden /></button>
    </>
  ) : null;

  return (
    <div ref={frameRef} className={cn("relative flex w-full flex-col bg-slate-900 text-white shadow-soft ring-1 ring-black/10", fs ? "h-screen" : "rounded-2xl")}>
      {/* Yuqori qator: sahifalar, nom, amallar */}
      <div className={cn("flex flex-wrap items-center gap-x-2 gap-y-1 bg-gradient-to-r from-slate-900 to-slate-800 px-2 py-1.5", !fs && "rounded-t-2xl")}>
        <div className="flex items-center gap-1" role="group" aria-label="Sahifalar">
          {isHost && <button type="button" className={tb(false)} onClick={() => page({ t: "pg", i: store.cur - 1 })} disabled={store.cur === 0} aria-label="Oldingi sahifa"><ChevronLeft className="h-4 w-4" aria-hidden /></button>}
          <span className="min-w-12 rounded-lg bg-white/10 px-2 py-1 text-center text-xs font-extrabold tabular-nums" aria-live="polite" aria-label="Joriy sahifa">{store.cur + 1} / {store.pages.length}</span>
          {isHost && <button type="button" className={tb(false)} onClick={() => page({ t: "pg", i: store.cur + 1 })} disabled={store.cur >= store.pages.length - 1} aria-label="Keyingi sahifa"><ChevronRight className="h-4 w-4" aria-hidden /></button>}
          {isHost && <button type="button" className={pill(false)} onClick={() => page({ t: "pa" })} aria-label="Yangi sahifa qo'shish" title="Yangi sahifa"><Plus className="h-4 w-4" aria-hidden /><span className="hidden lg:inline">Sahifa</span></button>}
          {isHost && multi && <button type="button" className={tb(false)} onClick={() => { if (store.strokes.length === 0 || window.confirm("Bu sahifa o'chirilsinmi?")) page({ t: "pd" }); }} aria-label="Sahifani o'chirish" title="Sahifani o'chirish"><Trash2 className="h-4 w-4" aria-hidden /></button>}
        </div>
        <div className="hidden min-w-0 flex-1 items-center justify-center gap-2 text-xs font-bold text-white/80 sm:flex">
          <Brush className="h-4 w-4 text-cyan-300" aria-hidden />Doska{canDraw && <span className="rounded-full bg-white/10 px-2 py-0.5 font-semibold text-white/90">{toolName[tool]}</span>}
        </div>
        <div className="ml-auto flex items-center gap-1 sm:ml-0">
          {isHost && onBg && <button type="button" data-pop-anchor className={pill(pop?.id === "bg")} onClick={(e) => openPop("bg", e.currentTarget)} aria-label="Doska foni" aria-expanded={pop?.id === "bg"} title="Doska foni"><Palette className="h-4 w-4" aria-hidden /><span className="hidden lg:inline">Fon</span></button>}
          {isHost && onPickImage && (
            <>
              <button type="button" className={pill(!!imageUrl)} onClick={() => (imageUrl && onClearImage ? onClearImage() : fileRef.current?.click())} aria-label={imageUrl ? "Rasmni olib tashlash" : "Rasm qo'yish"} title={imageUrl ? "Rasmni olib tashlash" : "Rasm qo'yish (varaq, kitob sahifasi)"}>
                {imageUrl ? <X className="h-4 w-4" aria-hidden /> : <ImagePlus className="h-4 w-4" aria-hidden />}<span className="hidden lg:inline">{imageUrl ? "Rasmni olish" : "Rasm"}</span>
              </button>
              <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" aria-label="Rasm tanlash" tabIndex={-1} onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) onPickImage(f); }} />
            </>
          )}
          <button type="button" className={pill(false)} onClick={() => void savePng()} aria-label="Doskani rasmga saqlash" title="Rasmga saqlash (PNG)"><Download className="h-4 w-4" aria-hidden /><span className="hidden lg:inline">Saqlash</span></button>
          <button type="button" className={tb(false)} onClick={toggleFs} aria-label={fs ? "To'liq ekrandan chiqish" : "To'liq ekran"} title={fs ? "To'liq ekrandan chiqish" : "To'liq ekran"}>{fs ? <Minimize2 className="h-4 w-4" aria-hidden /> : <Maximize2 className="h-4 w-4" aria-hidden />}</button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1">
        {/* Chap qator: asboblar (kompyuterda) */}
        {drawTools && open && (
          <div className="hidden w-[3.25rem] shrink-0 flex-col items-center gap-1 overflow-y-auto bg-slate-900 px-1 py-2 md:flex" role="toolbar" aria-label="Doska asboblari" aria-orientation="vertical">
            {toolList}
            {actionList && <><span className="flex-1" />{sep}{actionList}</>}
          </div>
        )}

        {/* Doska maydoni (16:9) */}
        <div className="relative flex min-w-0 flex-1 items-center justify-center bg-slate-800 p-1.5 md:p-2.5">
          <div className="relative aspect-video overflow-hidden rounded-lg shadow-lg ring-1 ring-black/20" style={{ ...bs, containerType: "inline-size", width: fs ? "min(100%, calc((100vh - 9rem) * 16 / 9))" : "100%" }}>
            {imageUrl && /* eslint-disable-next-line @next/next/no-img-element */ <img src={imageUrl} alt="Doskadagi rasm" className="pointer-events-none absolute inset-0 h-full w-full object-contain" draggable={false} />}
            <canvas ref={ref} width={W} height={H} className={cn("absolute inset-0 h-full w-full touch-none", cursor)} aria-label="Doska"
              onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} onPointerLeave={leave} onLostPointerCapture={() => { if (st.current.tool !== "laser") finish(); }} />
            <canvas ref={laserRef} width={W} height={H} className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden />
            {(area || lasso) && (
              <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox={`0 0 ${BOARD_X} ${BOARD_Y}`} preserveAspectRatio="none" aria-hidden data-testid="erase-preview">
                {area && <rect x={Math.min(area.x0, area.x1)} y={Math.min(area.y0, area.y1)} width={Math.abs(area.x1 - area.x0)} height={Math.abs(area.y1 - area.y0)} fill="rgba(239,68,68,0.14)" stroke="#ef4444" strokeWidth={2} strokeDasharray="8 6" vectorEffect="non-scaling-stroke" />}
                {lasso && <polygon points={lasso.reduce((acc, v, i) => acc + (i % 2 === 0 ? `${i ? " " : ""}${v}` : `,${v}`), "")} fill="rgba(239,68,68,0.14)" stroke="#ef4444" strokeWidth={2} strokeDasharray="8 6" vectorEffect="non-scaling-stroke" />}
              </svg>
            )}
            {selBox && canDraw && tool === "select" && (
              <div className="pointer-events-none absolute rounded border-2 border-dashed border-sky-500 bg-sky-500/10" data-testid="selection"
                style={{ left: `${(selBox.x1 / BOARD_X) * 100 - 0.4}%`, top: `${(selBox.y1 / BOARD_Y) * 100 - 0.7}%`, width: `${((selBox.x2 - selBox.x1) / BOARD_X) * 100 + 0.8}%`, height: `${((selBox.y2 - selBox.y1) / BOARD_Y) * 100 + 1.4}%` }} />
            )}
            {!canDraw && store.strokes.length === 0 && !imageUrl && <p className={cn("pointer-events-none absolute inset-0 grid place-items-center px-4 text-center text-sm font-semibold", bg === "dark" ? "text-white/50" : "text-slate-400")}>Doska bo&apos;sh. Ustoz yozishni boshlaganda shu yerda ko&apos;rinadi.</p>}
            {hint && <p role="status" className="absolute left-1/2 top-2 -translate-x-1/2 rounded-lg bg-amber px-2.5 py-1 text-xs font-bold text-white">{hint}</p>}
            {text && (
              <div className="absolute z-10" style={{ left: `${(text.x / BOARD_X) * 100}%`, top: `${(text.y / BOARD_Y) * 100}%` }}>
                <textarea ref={taRef} autoFocus value={text.v} onChange={(e) => setText({ ...text, v: e.target.value })} onBlur={commitText} maxLength={MAX_TEXT} rows={2} aria-label="Doskaga matn"
                  onKeyDown={(e) => { if (e.key === "Escape") { e.preventDefault(); setText(null); } else if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); commitText(); } }}
                  placeholder="Matn yozing..." style={{ fontSize: fontPx, lineHeight: 1.2, color: COLORS[color] === "#ffffff" && bg !== "dark" ? "#111827" : COLORS[color] }}
                  className="min-w-48 resize-none rounded border-2 border-dashed border-primary bg-white/75 px-1 font-bold outline-none placeholder:text-slate-400" />
                <div className="mt-1 max-w-[22rem] rounded-lg bg-slate-900/90 p-1" role="group" aria-label="Belgilar">
                  <div className="mb-1 flex gap-1 overflow-x-auto" role="tablist" aria-label="Belgilar to'plami">
                    {SYMBOL_ORDER.map((g) => <button key={g} type="button" role="tab" aria-selected={symTab === g} onMouseDown={(e) => e.preventDefault()} onClick={() => setSymTab(g)} className={cn("shrink-0 rounded-md px-2 py-0.5 text-[11px] font-bold", symTab === g ? "bg-white text-slate-900" : "bg-white/10 text-white/80")}>{SYMBOL_TABS[g].name}</button>)}
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {SYMBOL_TABS[symTab].items.map((s) => <button key={s} type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => insertSymbol(s)} className="grid h-7 min-w-7 place-items-center rounded bg-white/10 px-1 text-sm font-bold text-white hover:bg-white/25" aria-label={`Belgi ${s}`}>{s}</button>)}
                  </div>
                </div>
                <div className="mt-1 flex gap-1.5 text-[11px] font-semibold text-slate-700">
                  <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={commitText} className="inline-flex items-center gap-1 rounded-md bg-primary px-2 py-1 text-white"><Check className="h-3.5 w-3.5" aria-hidden />Qo&apos;yish</button>
                  <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => setText(null)} className="inline-flex items-center gap-1 rounded-md bg-white/90 px-2 py-1"><X className="h-3.5 w-3.5" aria-hidden />Bekor</button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Pastki qator: telefonda asboblar, hamma joyda rang va qalinlik */}
      {drawTools && (
        <div className={cn("flex flex-col gap-1 bg-gradient-to-r from-slate-900 to-slate-800 px-2 py-1.5", !fs && "rounded-b-2xl")}>
          {open && (
            <div className="flex items-center gap-1 overflow-x-auto md:hidden" role="toolbar" aria-label="Doska asboblari (telefon)">
              {toolList}{actionList && <>{sep}{actionList}</>}
            </div>
          )}
          {open && (
            <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1.5 md:justify-start">
              {showColors && (
                <div className="flex max-w-full items-center gap-1 overflow-x-auto" role="group" aria-label="Rang">
                  {COLORS.map((c, i) => (
                    <button key={c} type="button" onClick={() => setColor(i)} aria-label={COLOR_NAMES[i]} aria-pressed={color === i} title={COLOR_NAMES[i]}
                      className={cn("h-6 w-6 shrink-0 rounded-full border-2 transition-transform sm:h-7 sm:w-7", color === i ? "scale-110 border-sky-300 ring-2 ring-white" : "border-white/40 hover:scale-105")} style={{ backgroundColor: c }} />
                  ))}
                </div>
              )}
              {showWidth && (
                <div className="flex items-center gap-1" role="group" aria-label="Qalinlik">
                  {WIDTHS.map((w, i) => (
                    <button key={w} type="button" className={tb((tool === "eraser" ? ew : width) === i, "h-8 w-8")} onClick={() => (tool === "eraser" ? setEw(i) : setWidth(i))} aria-label={tool === "text" || tool === "sticker" ? `${i === 0 ? "Kichik" : i === 1 ? "O'rta" : i === 2 ? "Katta" : "Juda katta"} o'lcham` : tool === "eraser" ? `O'chirg'ich: ${WIDTH_NAMES[i]}` : WIDTH_NAMES[i]} aria-pressed={(tool === "eraser" ? ew : width) === i}>
                      {tool === "text" || tool === "sticker" ? <span className="font-extrabold" style={{ fontSize: 9 + i * 3 }}>A</span> : <span className={cn("rounded-full", (tool === "eraser" ? ew : width) === i ? "bg-slate-900" : "bg-white")} style={{ width: 3 + i * 3 + (tool === "eraser" ? 4 : 0), height: 3 + i * 3 + (tool === "eraser" ? 4 : 0) }} />}
                    </button>
                  ))}
                </div>
              )}
              {tool === "shape" && (
                <div className="flex items-center gap-1" role="group" aria-label="Shakl uslubi">
                  {isClosed(shapeKind) && <button type="button" className={pill(fill)} onClick={() => setFill((v) => !v)} aria-pressed={fill}>To&apos;ldirish</button>}
                  <button type="button" className={pill(dash)} onClick={() => setDash((v) => !v)} aria-pressed={dash}>Punktir</button>
                </div>
              )}
              {tool === "select" && selStroke && isHost && <button type="button" className={pill(false)} onClick={removeSelected}><Trash2 className="h-4 w-4" aria-hidden />O&apos;chirish</button>}
              {(HINTS[tool] ?? subj?.tip) && <p className="hidden min-w-0 flex-1 truncate text-[11px] font-semibold text-white/60 md:block" title={HINTS[tool] ?? subj?.tip}>{HINTS[tool] ?? subj?.tip}</p>}
            </div>
          )}
          <button type="button" onClick={() => setOpen((v) => !v)} className="inline-flex items-center gap-1 self-center rounded-full bg-white/10 px-2.5 py-0.5 text-[11px] font-bold text-white/80 hover:bg-white/20 md:hidden" aria-expanded={open} aria-label={open ? "Asboblarni yig'ish" : "Asboblarni ochish"}>
            <Pencil className="h-3 w-3" aria-hidden />{open ? "Asboblarni yig'ish" : "Asboblar"}
          </button>
        </div>
      )}

      {/* Ochiladigan oynalar: shakllar, stikerlar, shablonlar, fon */}
      {pop && (
        <div ref={popRef} role="dialog" aria-label={pop.id === "shape" ? "Shakllar" : pop.id === "sticker" ? "Stikerlar" : pop.id === "tpl" ? "Shablonlar" : pop.id === "eraser" ? "O'chirg'ich turi" : pop.id === "graph" ? "Grafik" : "Doska foni"}
          className={cn("absolute z-30 max-h-[70%] overflow-y-auto rounded-2xl bg-slate-950/95 p-2 text-white shadow-2xl ring-1 ring-white/10 backdrop-blur", pop.id === "graph" || pop.id === "eraser" || pop.id === "tpl" ? "w-72" : "w-60")}
          style={pop.id === "bg"
            ? { right: 8, top: pop.y + pop.h + 6 }
            : typeof window !== "undefined" && window.innerWidth >= 768
              ? { left: pop.x + pop.w + 8, top: Math.max(8, pop.y - 6) }
              : { left: Math.max(8, Math.min(pop.x, (frameRef.current?.clientWidth ?? 320) - 248)), bottom: (frameRef.current?.clientHeight ?? 0) - pop.y + 8 }}>
          {pop.id === "shape" && (
            <div className="grid grid-cols-3 gap-1.5">
              {SHAPES.map((s) => (
                <button key={s.k} type="button" onClick={() => { setShapeKind(s.k); setTool("shape"); setPop(null); }} aria-label={s.name} aria-pressed={shapeKind === s.k} title={s.name}
                  className={cn("grid h-14 place-items-center rounded-xl transition-colors", shapeKind === s.k ? "bg-white text-slate-900" : "bg-white/10 hover:bg-white/20")}><ShapeIcon k={s.k} className="h-7 w-7" /></button>
              ))}
            </div>
          )}
          {pop.id === "sticker" && (
            <div className="grid grid-cols-6 gap-1">
              {STICKERS.map((s) => (
                <button key={s} type="button" onClick={() => { setSticker(s); setTool("sticker"); setPop(null); }} aria-label={`Stiker ${s}`} aria-pressed={sticker === s}
                  className={cn("grid h-9 place-items-center rounded-lg text-xl transition-colors", sticker === s ? "bg-white/30" : "hover:bg-white/15")}>{s}</button>
              ))}
            </div>
          )}
          {pop.id === "tpl" && (
            <div className="space-y-1">
              {(() => {
                const featured = subj ? subj.tpl.map((id) => TEMPLATES.find((t) => t.id === id)).filter((t): t is (typeof TEMPLATES)[number] => !!t) : [];
                const rest = TEMPLATES.filter((t) => !featured.includes(t));
                const groups = [...new Set(rest.map((t) => t.group))];
                const btn = (t: (typeof TEMPLATES)[number]) => (
                  <button key={t.id} type="button" onClick={() => { setTpl(t.id); setTool("tpl"); setPop(null); }} aria-label={`Shablon: ${t.name}`}
                    className={cn("flex w-full items-center rounded-xl px-3 py-1.5 text-left text-sm font-bold transition-colors", tpl === t.id && tool === "tpl" ? "bg-white text-slate-900" : "bg-white/10 hover:bg-white/20")}>{t.name}</button>
                );
                return (
                  <>
                    {featured.length > 0 && <><p className="px-1 pt-0.5 text-[11px] font-extrabold uppercase tracking-wider text-cyan-300">{subj!.label} uchun</p>{featured.map(btn)}</>}
                    {groups.map((g) => <React.Fragment key={g}><p className="px-1 pt-2 text-[11px] font-extrabold uppercase tracking-wider text-white/50">{g}</p>{rest.filter((t) => t.group === g).map(btn)}</React.Fragment>)}
                  </>
                );
              })()}
              <p className="px-1 pt-1 text-[11px] text-white/60">Tanlang, keyin doskada joyni bosing.</p>
            </div>
          )}
          {pop.id === "eraser" && (
            <div className="space-y-1" role="menu" aria-label="O'chirg'ich turi">
              {([
                ["earea", "Hudud o'chirg'ich", "To'rtburchak belgilang: ichidagi hammasi birdan o'chadi", BoxSelect],
                ["elasso", "Erkin hudud o'chirg'ich", "Istalgan shaklda aylantirib chizing: ichi o'chadi", Lasso],
                ["eraser", "Surtib o'chirg'ich", "Odatdagi o'chirg'ich (4 xil o'lcham)", Eraser],
                ...(isHost ? [["oeraser", "Chiziqni o'chirish", "Bosilgan chiziq yoki shakl butunlay o'chadi", Delete] as const] : []),
              ] as const).map(([id, name, desc, Icon]) => (
                <button key={id} type="button" role="menuitemradio" aria-checked={eraserTool === id} aria-label={name} onClick={() => { setEraserTool(id); setTool(id); setPop(null); }}
                  className={cn("flex w-full items-start gap-2.5 rounded-xl px-2.5 py-2 text-left transition-colors", eraserTool === id ? "bg-white text-slate-900" : "bg-white/10 hover:bg-white/20")}>
                  <Icon className="mt-0.5 h-5 w-5 shrink-0" aria-hidden /><span><span className="block text-sm font-bold">{name}</span><span className={cn("block text-[11px]", eraserTool === id ? "text-slate-600" : "text-white/60")}>{desc}</span></span>
                </button>
              ))}
            </div>
          )}
          {pop.id === "graph" && (
            <form className="space-y-2" onSubmit={(e) => { e.preventDefault(); plotGraph(); }}>
              <label className="block text-xs font-bold text-white/80" htmlFor="graph-expr">Formula: y =</label>
              <input id="graph-expr" autoFocus value={expr} onChange={(e) => { setExpr(e.target.value); setExprErr(""); }} aria-label="Formula" placeholder="x^2, 2x+1, sin(x)" maxLength={120} autoComplete="off" spellCheck={false}
                className="h-10 w-full rounded-lg border border-white/20 bg-white/10 px-3 text-sm font-semibold text-white outline-none placeholder:text-white/40 focus:border-cyan-300" />
              <div className="flex flex-wrap gap-1">
                {["x^2", "2x+1", "x^3-3x", "sin(x)", "cos(x)", "1/x", "sqrt(x)", "abs(x)", "ln(x)"].map((x) => <button key={x} type="button" onClick={() => { setExpr(x); setExprErr(""); }} className="rounded-md bg-white/10 px-2 py-0.5 text-xs font-bold hover:bg-white/20">{x}</button>)}
              </div>
              {exprErr && <p role="alert" className="text-xs font-semibold text-amber-300">{exprErr}</p>}
              <button type="submit" disabled={!expr.trim()} className="h-9 w-full rounded-lg bg-cyan-400 text-sm font-extrabold text-slate-900 disabled:opacity-40">Grafikni chizish</button>
              <p className="text-[11px] text-white/55">Koordinata fonida 1 birlik = 1 katak. Rang va qalinlik pastdagi tanlovdan olinadi. Bir nechta grafik chizish mumkin.</p>
            </form>
          )}
          {pop.id === "bg" && (
            <div role="menu" aria-label="Doska foni" className="space-y-0.5">
              {BGS.map((b) => (
                <button key={b} type="button" role="menuitemradio" aria-checked={bg === b} onClick={() => { onBg?.(b); setPop(null); }} className={cn("flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs font-semibold", bg === b ? "bg-white text-slate-900" : "text-white hover:bg-white/10")}>
                  <span className="h-5 w-8 shrink-0 rounded border border-white/30" style={{ ...bgStyle(b), backgroundSize: b === "grid" || b === "dots" || b === "axes" ? "25% 33%" : bgStyle(b).backgroundSize }} />{BG_NAMES[b]}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
