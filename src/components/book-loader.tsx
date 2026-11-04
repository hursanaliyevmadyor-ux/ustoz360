"use client";
import * as React from "react";
import { cn } from "@/lib/utils";
import { FLIP_V1, FLIP_V2, type FlipData } from "./book-loader-data";

/**
 * Yuklash belgisi: ochiq kitobda varaq o'ngdan chapga o'girilib turadi. Ikki variant (rasmdagi ikki 16 kadrli ketma-ketlik).
 * Kalit kadrlar `book-loader-data.ts`da; bu yerda ular orasida monoton PCHIP bilan silliq o'tiladi (to'xtash va sakrash yo'q),
 * so'ng har kadrda sahifa chiziqlari yasaladi. Sahifalar oqartirilgan (paper rangi) holda chap -> o'ng -> varaq tartibida
 * chiziladi, shuning uchun orqadagi chiziqlar o'zi yashirinadi. Rang `currentColor`dan, "qog'oz" `--bl-paper`dan olinadi.
 */
const SIZES = { sm: "w-14", md: "w-24", lg: "w-36" } as const;

const TIMES = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 11.5, 12, 12.5]; // kalit kadrlar vaqti (birlik); oxirgi 4 kadr tinch holat, tezroq o'tadi
const PERIOD = 13;
const NF = TIMES.length;
const NSTATIC = 24; // varaqdan (F) oldingi sonlar soni
const NPARAM = 36;

const TOP_K = [0.075, 0.21]; // sahifa ustki chizig'i egriligi (chiziq uzunligiga nisbatan)
const BOT_K = [[0.126, 0.098], [0.082, 0.07], [0.072, 0.006]]; // pastki chiziq: ichki, o'rta, tashqi sahifa

type Pt = [number, number];
type Track = { y: number[]; d: number[] };

/** Monoton kubik Hermite qiyaliklari (Fritsch-Carlson); `periodic` bo'lsa oxiri boshiga ulanadi, aks holda uchlarida tinch (0). */
function slopes(y: number[], periodic: boolean): number[] {
  const n = y.length;
  const t = periodic ? TIMES : [...TIMES, PERIOD];
  const h = (k: number) => (periodic ? (k + 1 >= n ? PERIOD : t[k + 1]) - t[k] : t[k + 1] - t[k]);
  const s = (k: number) => (y[(k + 1) % n] - y[k]) / h(k);
  const d = new Array<number>(n).fill(0);
  for (let k = 0; k < n; k++) {
    if (!periodic && (k === 0 || k === n - 1)) continue;
    const kp = (k + n - 1) % n;
    const s0 = s(kp), s1 = s(k), h0 = h(kp), h1 = h(k);
    if (s0 * s1 <= 0) continue;
    const w1 = 2 * h1 + h0, w2 = h1 + 2 * h0;
    d[k] = (w1 + w2) / (w1 / s0 + w2 / s1);
  }
  return d;
}

const cache = new Map<FlipData, Track[]>();
function tracksOf(data: FlipData): Track[] {
  let tr = cache.get(data);
  if (!tr) {
    tr = [];
    for (let j = 0; j < NPARAM; j++) {
      const y = data.frames.map((f) => f[j]);
      if (j >= NSTATIC) y.push(data.end[j - NSTATIC]);
      tr.push({ y, d: slopes(y, j < NSTATIC) });
    }
    cache.set(data, tr);
  }
  return tr;
}

/** `u` (0..PERIOD) vaqtdagi 36 ta parametr */
function paramsAt(tr: Track[], u: number): number[] {
  let k = 0;
  for (let i = 0; i < NF; i++) if (TIMES[i] <= u) k = i;
  const t0 = TIMES[k], h = (k + 1 >= NF ? PERIOD : TIMES[k + 1]) - t0;
  const x = (u - t0) / h, x2 = x * x, x3 = x2 * x;
  const a = 2 * x3 - 3 * x2 + 1, b = (x3 - 2 * x2 + x) * h, c = -2 * x3 + 3 * x2, e = (x3 - x2) * h;
  return tr.map((q, j) => {
    const k1 = j < NSTATIC ? (k + 1) % NF : k + 1;
    return a * q.y[k] + b * q.d[k] + c * q.y[k1] + e * q.d[k1];
  });
}

const f2 = (p: Pt) => `${Math.round(p[0] * 100) / 100} ${Math.round(p[1] * 100) / 100}`;
/** a -> b chiziq bo'ylab ikki nuqtadan chiziqqa tik siljitilgan (b1, b2) kubik egri chiziq nuqtalari */
function ctrl(a: Pt, b: Pt, b1: number, b2: number): [Pt, Pt] {
  const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1e-9;
  const nx = dy / L, ny = -dx / L;
  return [[a[0] + dx / 3 + nx * b1, a[1] + dy / 3 + ny * b1], [a[0] + (2 * dx) / 3 + nx * b2, a[1] + (2 * dy) / 3 + ny * b2]];
}
/** P0 (umurtqa tepasi) -> T (tashqi tepa burchak) -> E (tashqi past burchak) -> P7 (umurtqa pasti), yopiq sahifa */
function pageD(P0: Pt, T: Pt, E: Pt, P7: Pt, bt: [number, number], bb: [number, number]): string {
  const [c1, c2] = ctrl(P0, T, bt[0], bt[1]);
  const [c3, c4] = ctrl(E, P7, bb[0], bb[1]);
  return `M${f2(P0)}C${f2(c1)} ${f2(c2)} ${f2(T)}L${f2(E)}C${f2(c3)} ${f2(c4)} ${f2(P7)}Z`;
}
function staticD(sx: number, at: number, ab: number, x: number, top: number, bot: number, rank: number): string {
  const st = x >= sx ? 1 : -1, Lt = Math.hypot(x - sx, top - at);
  const sb = sx >= x ? 1 : -1, Lb = Math.hypot(sx - x, ab - bot), k = BOT_K[Math.min(rank, 2)];
  return pageD([sx, at], [x, top], [x, bot], [sx, ab], [st * TOP_K[0] * Lt, st * TOP_K[1] * Lt], [sb * k[0] * Lb, sb * k[1] * Lb]);
}

const LEFT_RANK = [2, 1, 0, 0];
const RIGHT_RANK = [2, 1, 0];
/** Chizish tartibi: chap sahifalar (tashqaridan ichkariga), o'ng sahifalar, oxirida o'girilayotgan varaq */
function shapesOf(v: number[]): { d: string[]; sx: number } {
  const [sx, at, ab] = v;
  const d: string[] = [];
  for (let i = 0; i < 4; i++) d.push(staticD(sx, at, ab, v[3 + i * 3], v[4 + i * 3], v[5 + i * 3], LEFT_RANK[i]));
  for (let i = 0; i < 3; i++) d.push(staticD(sx, at, ab, v[15 + i * 3], v[16 + i * 3], v[17 + i * 3], RIGHT_RANK[i]));
  const P0: Pt = [v[24], v[25]], T: Pt = [v[26], v[27]], E: Pt = [v[28], v[29]], P7: Pt = [v[30], v[31]];
  const Lt = Math.hypot(T[0] - P0[0], T[1] - P0[1]), Lb = Math.hypot(P7[0] - E[0], P7[1] - E[1]);
  d.push(pageD(P0, T, E, P7, [v[32] * Lt, v[33] * Lt], [v[34] * Lb, v[35] * Lb]));
  return { d, sx };
}

export function BookLoader({ variant = 1, size = "md", label, className, duration = 3000 }: {
  variant?: 1 | 2; size?: keyof typeof SIZES; label?: string; className?: string; duration?: number;
}) {
  const data = variant === 2 ? FLIP_V2 : FLIP_V1;
  const paths = React.useRef<(SVGPathElement | null)[]>([]);
  const blob = React.useRef<SVGEllipseElement>(null);

  React.useEffect(() => {
    // Animatsiyani kamaytirish yoqilgan bo'lsa kitob qotib turadi (1-kadr).
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const tr = tracksOf(data);
    let raf = 0;
    const t0 = performance.now();
    const tick = (now: number) => {
      const { d, sx } = shapesOf(paramsAt(tr, (((now - t0) / duration) * PERIOD) % PERIOD));
      d.forEach((s, i) => paths.current[i]?.setAttribute("d", s));
      blob.current?.setAttribute("cx", String(sx));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [data, duration]);

  const first = shapesOf(paramsAt(tracksOf(data), 0));
  return (
    <div role="status" aria-live="polite" className={cn("inline-flex flex-col items-center gap-2 text-navy", className)}>
      <svg viewBox="4 -27 142 148" className={cn("h-auto overflow-visible", SIZES[size])} aria-hidden="true" focusable="false">
        <g fill="var(--bl-paper, hsl(var(--background)))" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round">
          {first.d.map((s, i) => (
            <path key={i} ref={(el) => { paths.current[i] = el; }} d={s} />
          ))}
          <ellipse ref={blob} cx={first.sx} cy="113.4" rx="6.8" ry="4.3" fill="currentColor" stroke="none" />
        </g>
      </svg>
      {label ? <span className="text-sm font-medium text-muted-foreground">{label}</span> : <span className="sr-only">Yuklanmoqda</span>}
    </div>
  );
}
