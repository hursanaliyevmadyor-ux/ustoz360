/** Kichik, bog'liqliksiz SVG diagrammalar. */
import { cn } from "@/lib/utils";

export function LineChart({ data, labels, color = "#2563EB", height = 180 }: { data: number[]; labels: string[]; color?: string; height?: number }) {
  const w = 480, h = height, pad = 24;
  const max = Math.max(...data) * 1.1, min = Math.min(...data) * 0.8;
  const x = (i: number) => pad + (i * (w - pad * 2)) / (data.length - 1);
  const y = (v: number) => h - pad - ((v - min) / (max - min)) * (h - pad * 2);
  const pts = data.map((v, i) => `${x(i)},${y(v)}`).join(" ");
  const id = `g${color.replace("#", "")}`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full" role="img" aria-label="Chiziqli diagramma">
      <defs><linearGradient id={id} x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor={color} stopOpacity=".25" /><stop offset="1" stopColor={color} stopOpacity="0" /></linearGradient></defs>
      {[0, 1, 2, 3].map((i) => <line key={i} x1={pad} x2={w - pad} y1={pad + (i * (h - pad * 2)) / 3} y2={pad + (i * (h - pad * 2)) / 3} stroke="currentColor" className="text-border" />)}
      <polygon points={`${pad},${h - pad} ${pts} ${w - pad},${h - pad}`} fill={`url(#${id})`} />
      <polyline points={pts} fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      {data.map((v, i) => <circle key={i} cx={x(i)} cy={y(v)} r="4" fill="#fff" stroke={color} strokeWidth="2.5" />)}
      {labels.map((l, i) => <text key={l} x={x(i)} y={h - 6} textAnchor="middle" className="fill-muted-foreground text-[11px]">{l}</text>)}
    </svg>
  );
}

export function BarChart({ data, labels, colors = ["#2563EB", "#0D9488"], series = 1, height = 180 }: { data: number[][]; labels: string[]; colors?: string[]; series?: number; height?: number }) {
  const w = 480, h = height, pad = 24;
  const max = Math.max(...data.flat()) * 1.1;
  const gw = (w - pad * 2) / labels.length;
  const bw = Math.min(22, (gw - 10) / series);
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full" role="img" aria-label="Ustunli diagramma">
      {[0, 1, 2, 3].map((i) => <line key={i} x1={pad} x2={w - pad} y1={pad + (i * (h - pad * 2)) / 3} y2={pad + (i * (h - pad * 2)) / 3} stroke="currentColor" className="text-border" />)}
      {labels.map((l, i) => (
        <g key={l}>
          {Array.from({ length: series }).map((_, s) => {
            const v = data[s][i]; const bh = (v / max) * (h - pad * 2);
            return <rect key={s} x={pad + i * gw + (gw - bw * series) / 2 + s * bw} y={h - pad - bh} width={bw - 2} height={bh} rx="5" fill={colors[s]} />;
          })}
          <text x={pad + i * gw + gw / 2} y={h - 6} textAnchor="middle" className="fill-muted-foreground text-[11px]">{l}</text>
        </g>
      ))}
    </svg>
  );
}

export function Donut({ parts, center, sub }: { parts: { label: string; value: number; color: string }[]; center: string; sub: string }) {
  const total = parts.reduce((a, p) => a + p.value, 0);
  const r = 52, c = 2 * Math.PI * r;
  let off = 0;
  return (
    <div className="flex flex-wrap items-center gap-5">
      <svg viewBox="0 0 140 140" className="h-36 w-36 shrink-0 -rotate-90" role="img" aria-label="Doira diagramma">
        <circle cx="70" cy="70" r={r} fill="none" stroke="currentColor" className="text-muted" strokeWidth="18" />
        {parts.map((p) => {
          const len = (p.value / total) * c;
          const el = <circle key={p.label} cx="70" cy="70" r={r} fill="none" stroke={p.color} strokeWidth="18" strokeDasharray={`${len - 2} ${c - len + 2}`} strokeDashoffset={-off} />;
          off += len; return el;
        })}
        <g className="rotate-90 origin-center"><text x="70" y="68" textAnchor="middle" className="fill-foreground text-2xl font-bold">{center}</text><text x="70" y="86" textAnchor="middle" className="fill-muted-foreground text-[10px]">{sub}</text></g>
      </svg>
      <ul className="space-y-1.5 text-sm">
        {parts.map((p) => <li key={p.label} className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full" style={{ background: p.color }} />{p.label}<b className="ml-auto pl-4">{p.value}</b></li>)}
      </ul>
    </div>
  );
}

export function Radar({ items, color = "#2563EB" }: { items: { label: string; value: number }[]; color?: string }) {
  const cx = 150, cy = 140, R = 90, n = items.length;
  const pt = (i: number, v: number) => { const a = (Math.PI * 2 * i) / n - Math.PI / 2; return [cx + Math.cos(a) * R * v, cy + Math.sin(a) * R * v]; };
  const poly = items.map((it, i) => pt(i, it.value / 100).join(",")).join(" ");
  return (
    <svg viewBox="0 0 300 280" className="mx-auto w-full max-w-sm" role="img" aria-label="Bilim xaritasi radar diagrammasi">
      {[0.25, 0.5, 0.75, 1].map((k) => <polygon key={k} points={items.map((_, i) => pt(i, k).join(",")).join(" ")} fill="none" stroke="currentColor" className="text-border" />)}
      {items.map((_, i) => <line key={i} x1={cx} y1={cy} x2={pt(i, 1)[0]} y2={pt(i, 1)[1]} stroke="currentColor" className="text-border" />)}
      <polygon points={poly} fill={color} fillOpacity=".18" stroke={color} strokeWidth="2.5" />
      {items.map((it, i) => { const [x, y] = pt(i, 1.2); return <text key={it.label} x={x} y={y} textAnchor="middle" dominantBaseline="middle" className="fill-muted-foreground text-[10px]">{it.label}</text>; })}
    </svg>
  );
}

export function Spark({ data, color = "#2563EB", className }: { data: number[]; color?: string; className?: string }) {
  const max = Math.max(...data), min = Math.min(...data);
  const pts = data.map((v, i) => `${(i * 100) / (data.length - 1)},${28 - ((v - min) / (max - min || 1)) * 24}`).join(" ");
  return <svg viewBox="0 0 100 30" className={cn("h-8 w-24", className)} aria-hidden><polyline points={pts} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}
