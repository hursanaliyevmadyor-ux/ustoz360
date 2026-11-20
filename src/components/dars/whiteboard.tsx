"use client";
import * as React from "react";
import { Eraser, Grid3x3, Pencil, Trash2, Undo2 } from "lucide-react";
import { BOARD_X, BOARD_Y, BoardStore, COLORS, COLOR_NAMES, WIDTHS, WIDTH_NAMES, type BoardMsg, type Stroke } from "@/lib/board";
import { cn } from "@/lib/utils";

const W = 1600;
const H = 900;

function draw(ctx: CanvasRenderingContext2D, strokes: readonly Stroke[]) {
  ctx.clearRect(0, 0, W, H);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  const px = (v: number) => (v / BOARD_X) * W;
  const py = (v: number) => (v / BOARD_Y) * H;
  for (const s of strokes) {
    const n = s.p.length / 2;
    if (n === 0) continue;
    ctx.globalCompositeOperation = s.e ? "destination-out" : "source-over";
    ctx.strokeStyle = s.e ? "#000" : COLORS[s.c] ?? COLORS[0];
    ctx.fillStyle = ctx.strokeStyle;
    const lw = (WIDTHS[s.w] ?? WIDTHS[1]) * (s.e ? 3 : 1);
    ctx.lineWidth = lw;
    if (n === 1) { ctx.beginPath(); ctx.arc(px(s.p[0]!), py(s.p[1]!), lw / 2, 0, Math.PI * 2); ctx.fill(); continue; }
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
}

/**
 * Doska: ustoz (canDraw) qalam, o'chirg'ich, bekor qilish va tozalash bilan chizadi; o'quvchilar ko'radi.
 * Chiziqlar `store` da turadi, `net` orqali hammaga yuboriladi (50 ms da bir marta bo'lak-bo'lak).
 */
export function Whiteboard({ store, version, grid, canDraw, net, onChange, onGrid }: {
  store: BoardStore; version: number; grid: boolean; canDraw: boolean; net: (m: BoardMsg) => void; onChange: () => void; onGrid?: (on: boolean) => void;
}) {
  const ref = React.useRef<HTMLCanvasElement>(null);
  const [color, setColor] = React.useState(0);
  const [width, setWidth] = React.useState(1);
  const [eraser, setEraser] = React.useState(false);
  const [hint, setHint] = React.useState("");
  const cur = React.useRef<{ id: number; buf: number[]; lx: number; ly: number; timer: number } | null>(null);
  const tool = React.useRef({ color, width, eraser });
  tool.current = { color, width, eraser };

  React.useEffect(() => {
    const ctx = ref.current?.getContext("2d");
    if (ctx) draw(ctx, store.strokes);
  }, [store, version]);

  const flush = React.useCallback(() => {
    const c = cur.current;
    if (!c || c.buf.length === 0) return;
    const t = tool.current;
    const buf = c.buf.splice(0, c.buf.length);
    for (let i = 0; i < buf.length; i += 400) net({ t: "b", id: c.id, c: t.color, w: t.width, ...(t.eraser && { e: 1 as const }), p: buf.slice(i, i + 400) });
  }, [net]);

  const end = React.useCallback(() => {
    const c = cur.current;
    if (!c) return;
    window.clearInterval(c.timer);
    flush();
    cur.current = null;
  }, [flush]);
  React.useEffect(() => end, [end]);

  function at(e: { clientX: number; clientY: number }) {
    const r = ref.current!.getBoundingClientRect();
    return [Math.max(0, Math.min(BOARD_X, Math.round(((e.clientX - r.left) / r.width) * BOARD_X))), Math.max(0, Math.min(BOARD_Y, Math.round(((e.clientY - r.top) / r.height) * BOARD_Y)))] as const;
  }
  function add(x: number, y: number) {
    const c = cur.current;
    if (!c) return;
    const t = tool.current;
    const msg: BoardMsg = { t: "b", id: c.id, c: t.color, w: t.width, ...(t.eraser && { e: 1 as const }), p: [x, y] };
    if (store.apply(msg)) { c.buf.push(x, y); onChange(); }
  }
  function down(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!canDraw || e.button > 0) return;
    if (store.full) { setHint("Doska to'ldi. Tozalab, davom eting."); return; }
    setHint("");
    e.currentTarget.setPointerCapture(e.pointerId);
    const [x, y] = at(e);
    cur.current = { id: Math.floor(Math.random() * 2 ** 31), buf: [], lx: x, ly: y, timer: window.setInterval(flush, 50) };
    add(x, y);
  }
  function move(e: React.PointerEvent<HTMLCanvasElement>) {
    const c = cur.current;
    if (!c) return;
    const evs = (e.nativeEvent as PointerEvent).getCoalescedEvents?.() ?? [];
    for (const ev of evs.length ? evs : [e.nativeEvent]) {
      const [x, y] = at(ev);
      if (Math.abs(x - c.lx) + Math.abs(y - c.ly) < 12) continue; // juda yaqin nuqtalar kerak emas
      c.lx = x; c.ly = y;
      add(x, y);
    }
  }
  function undo() { if (store.apply({ t: "u" })) { net({ t: "u" }); onChange(); } }
  function clear() {
    if (store.strokes.length === 0) return;
    if (!window.confirm("Doska tozalansinmi?")) return;
    store.apply({ t: "x" }); net({ t: "x" }); onChange();
  }

  return (
    <div className="relative h-full w-full select-none bg-white" style={grid ? { backgroundImage: "linear-gradient(to right, #cbd5e1 1px, transparent 1px), linear-gradient(to bottom, #cbd5e1 1px, transparent 1px)", backgroundSize: "3.125% 5.5556%" } : undefined}>
      <canvas ref={ref} width={W} height={H} className={cn("absolute inset-0 h-full w-full touch-none", canDraw ? "cursor-crosshair" : "cursor-default")} aria-label="Doska"
        onPointerDown={down} onPointerMove={move} onPointerUp={end} onPointerCancel={end} onLostPointerCapture={end} />
      {!canDraw && store.strokes.length === 0 && <p className="pointer-events-none absolute inset-0 grid place-items-center px-4 text-center text-sm font-semibold text-slate-400">Doska bo&apos;sh. Ustoz yozishni boshlaganda shu yerda ko&apos;rinadi.</p>}
      {hint && <p role="status" className="absolute left-2 top-2 rounded-lg bg-amber px-2.5 py-1 text-xs font-bold text-white">{hint}</p>}
      {canDraw && (
        <div className="absolute inset-x-0 bottom-0 flex flex-wrap items-center justify-center gap-1.5 bg-slate-900/80 p-1.5 text-white" role="toolbar" aria-label="Doska asboblari">
          {COLORS.map((c, i) => (
            <button key={c} type="button" onClick={() => { setColor(i); setEraser(false); }} aria-label={COLOR_NAMES[i]} aria-pressed={!eraser && color === i}
              className={cn("h-7 w-7 rounded-full border-2", !eraser && color === i ? "border-white" : "border-transparent")} style={{ backgroundColor: c }} />
          ))}
          <span className="mx-1 h-5 w-px bg-white/30" aria-hidden />
          {WIDTHS.map((w, i) => (
            <button key={w} type="button" onClick={() => setWidth(i)} aria-label={WIDTH_NAMES[i]} aria-pressed={width === i}
              className={cn("grid h-7 w-7 place-items-center rounded-lg", width === i ? "bg-white/25" : "bg-white/10")}>
              <span className="rounded-full bg-white" style={{ width: 4 + i * 4, height: 4 + i * 4 }} />
            </button>
          ))}
          <span className="mx-1 h-5 w-px bg-white/30" aria-hidden />
          <button type="button" onClick={() => setEraser(false)} aria-label="Qalam" aria-pressed={!eraser} className={cn("grid h-7 w-7 place-items-center rounded-lg", !eraser ? "bg-white/25" : "bg-white/10")}><Pencil className="h-4 w-4" aria-hidden /></button>
          <button type="button" onClick={() => setEraser(true)} aria-label="O'chirg'ich" aria-pressed={eraser} className={cn("grid h-7 w-7 place-items-center rounded-lg", eraser ? "bg-white/25" : "bg-white/10")}><Eraser className="h-4 w-4" aria-hidden /></button>
          <button type="button" onClick={undo} aria-label="Oxirgi chiziqni bekor qilish" className="grid h-7 w-7 place-items-center rounded-lg bg-white/10"><Undo2 className="h-4 w-4" aria-hidden /></button>
          <button type="button" onClick={clear} aria-label="Doskani tozalash" className="grid h-7 w-7 place-items-center rounded-lg bg-white/10"><Trash2 className="h-4 w-4" aria-hidden /></button>
          {onGrid && <button type="button" onClick={() => onGrid(!grid)} aria-label="Katak" aria-pressed={grid} className={cn("grid h-7 w-7 place-items-center rounded-lg", grid ? "bg-white/25" : "bg-white/10")}><Grid3x3 className="h-4 w-4" aria-hidden /></button>}
        </div>
      )}
    </div>
  );
}
