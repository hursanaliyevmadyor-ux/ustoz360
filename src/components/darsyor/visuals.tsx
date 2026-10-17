"use client";
import * as React from "react";
import { Plus, Trash2 } from "lucide-react";
import type { z } from "zod";
import type { visualData } from "@/server/docsvalid";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/form";

export type Visual = z.infer<typeof visualData>;
export type Template = Visual["template"];

export const TEMPLATES: { key: Template; title: string; desc: string; svg: boolean }[] = [
  { key: "venn", title: "Venn diagrammasi", desc: "Ikki yoki uch tushunchaning umumiy va farqli tomonlari", svg: true },
  { key: "cluster", title: "Klaster", desc: "Markaziy tushuncha va uning tarmoqlari", svg: true },
  { key: "frayer", title: "Frayer modeli", desc: "Ta'rif, xususiyatlar, misol va misol emas", svg: false },
  { key: "compare", title: "Taqqoslash jadvali", desc: "Ikki-besh ustunli jadval", svg: false },
  { key: "fishbone", title: "Baliq skeleti", desc: "Muammo va uning sabablari", svg: true },
  { key: "cards", title: "Didaktik kartochkalar", desc: "Old va orqa tomonli, kesib ishlatiladigan kartochkalar", svg: false },
  { key: "handout", title: "Tarqatma / A4 material", desc: "Sarlavha va matn bloklari", svg: false },
];

export function starter(t: Template): Visual {
  switch (t) {
    case "venn": return { template: "venn", labels: ["A", "B"], items: [[], []], shared: [] };
    case "cluster": return { template: "cluster", center: "", branches: [{ label: "", items: [] }, { label: "", items: [] }, { label: "", items: [] }] };
    case "frayer": return { template: "frayer", term: "", definition: "", characteristics: "", examples: "", nonExamples: "" };
    case "compare": return { template: "compare", headers: ["", ""], rows: [["", ""], ["", ""], ["", ""]] };
    case "fishbone": return { template: "fishbone", problem: "", causes: [{ label: "", items: [] }, { label: "", items: [] }, { label: "", items: [] }, { label: "", items: [] }] };
    case "cards": return { template: "cards", cards: [{ front: "", back: "" }, { front: "", back: "" }] };
    case "handout": return { template: "handout", blocks: [{ heading: "", text: "" }] };
  }
}

const lines = (s: string) => s.split("\n").map((x) => x.trim()).filter(Boolean);
const wrap = (text: string, max: number): string[] => {
  const out: string[] = []; let cur = "";
  for (const w of text.split(/\s+/)) { if ((cur + " " + w).trim().length > max && cur) { out.push(cur); cur = w; } else cur = (cur + " " + w).trim(); }
  if (cur) out.push(cur);
  return out;
};
const T = ({ x, y, text, max = 18, size = 13, anchor = "middle", bold, gap = 16 }: { x: number; y: number; text: string; max?: number; size?: number; anchor?: "middle" | "start"; bold?: boolean; gap?: number }) => (
  <text x={x} y={y} textAnchor={anchor} fontSize={size} fontWeight={bold ? 700 : 400} fill="#111">{wrap(text, max).map((l, i) => <tspan key={i} x={x} dy={i === 0 ? 0 : gap}>{l}</tspan>)}</text>
);
const ListT = ({ x, y, items, max = 18, size = 12, anchor = "middle" }: { x: number; y: number; items: string[]; max?: number; size?: number; anchor?: "middle" | "start" }) => {
  let yy = y;
  return <>{items.map((it, i) => { const ls = wrap(it, max); const el = <T key={i} x={x} y={yy} text={it} max={max} size={size} anchor={anchor} gap={14} />; yy += ls.length * 14 + 3; return el; })}</>;
};

const COLORS = ["#3867F4", "#0D9E91", "#F59E0B", "#E11D48", "#7C3AED", "#059669", "#4F46E5", "#D97706"];

export const Render = React.forwardRef<SVGSVGElement | HTMLDivElement, { v: Visual; title?: string }>(function Render({ v, title }, ref) {
  const head = title ? <h2 className="mb-3 text-xl font-extrabold">{title}</h2> : null;
  if (v.template === "venn") {
    const three = v.labels.length === 3;
    // Doira markazlari, sarlavha va "faqat shunga xos" bandlar joyi aniq belgilangan (kesishmada umumiy bandlar).
    const c = three
      ? [{ x: 250, y: 190, r: 135, lx: 150, ly: 38, ix: 185, iy: 150 }, { x: 410, y: 190, r: 135, lx: 510, ly: 38, ix: 475, iy: 150 }, { x: 330, y: 320, r: 135, lx: 330, ly: 492, ix: 330, iy: 380 }]
      : [{ x: 260, y: 230, r: 150, lx: 200, ly: 52, ix: 195, iy: 170 }, { x: 440, y: 230, r: 150, lx: 500, ly: 52, ix: 505, iy: 170 }];
    return (
      <div>{head}<svg ref={ref as React.Ref<SVGSVGElement>} viewBox="0 0 700 500" className="w-full" role="img" aria-label="Venn diagrammasi" xmlns="http://www.w3.org/2000/svg">
        <rect width="700" height="500" fill="#fff" />
        {c.map((k, i) => <circle key={i} cx={k.x} cy={k.y} r={k.r} fill={COLORS[i]} fillOpacity={0.18} stroke={COLORS[i]} strokeWidth={2.5} />)}
        {c.map((k, i) => <g key={i}><T x={k.lx} y={k.ly} text={v.labels[i] ?? ""} bold size={16} max={22} /><ListT x={k.ix} y={k.iy} items={v.items[i] ?? []} max={three ? 14 : 16} /></g>)}
        <ListT x={350} y={three ? 215 : 195} items={v.shared} max={14} />
      </svg></div>
    );
  }
  if (v.template === "cluster") {
    const n = Math.max(1, v.branches.length);
    return (
      <div>{head}<svg ref={ref as React.Ref<SVGSVGElement>} viewBox="0 0 700 560" className="w-full" role="img" aria-label="Klaster" xmlns="http://www.w3.org/2000/svg">
        <rect width="700" height="560" fill="#fff" />
        {v.branches.map((b, i) => {
          const a = (Math.PI * 2 * i) / n - Math.PI / 2; const x = 350 + Math.cos(a) * 215, y = 280 + Math.sin(a) * 195;
          return <g key={i}><line x1={350} y1={280} x2={x} y2={y} stroke={COLORS[i % 8]} strokeWidth={2.5} />
            <rect x={x - 70} y={y - 20} width={140} height={40 + b.items.length * 0} rx={12} fill="#fff" stroke={COLORS[i % 8]} strokeWidth={2.5} />
            <T x={x} y={y - 3} text={b.label} bold size={13} max={18} />
            <ListT x={x} y={y + 36} items={b.items} max={20} size={11} /></g>;
        })}
        <ellipse cx={350} cy={280} rx={95} ry={55} fill="#3867F4" fillOpacity={0.12} stroke="#3867F4" strokeWidth={3} />
        <T x={350} y={277} text={v.center} bold size={16} max={16} />
      </svg></div>
    );
  }
  if (v.template === "fishbone") {
    const n = Math.max(1, v.causes.length); const top = Math.ceil(n / 2);
    return (
      <div>{head}<svg ref={ref as React.Ref<SVGSVGElement>} viewBox="0 0 800 460" className="w-full" role="img" aria-label="Baliq skeleti" xmlns="http://www.w3.org/2000/svg">
        <rect width="800" height="460" fill="#fff" />
        <line x1={30} y1={230} x2={640} y2={230} stroke="#111" strokeWidth={4} />
        <rect x={640} y={190} width={140} height={80} rx={14} fill="#3867F4" fillOpacity={0.12} stroke="#3867F4" strokeWidth={3} />
        <T x={710} y={225} text={v.problem} bold size={14} max={14} />
        {v.causes.map((c, i) => {
          const isTop = i < top; const idx = isTop ? i : i - top; const cnt = isTop ? top : n - top;
          const x0 = 130 + idx * (480 / Math.max(1, cnt)); const y0 = isTop ? 70 : 390;
          return <g key={i}><line x1={x0} y1={y0} x2={x0 + 70} y2={230} stroke={COLORS[i % 8]} strokeWidth={3} />
            <T x={x0} y={isTop ? y0 - 14 : y0 + 22} text={c.label} bold size={13} max={16} />
            <ListT x={x0 + (isTop ? 30 : 30)} y={isTop ? y0 + 22 : y0 - 62} items={c.items} max={18} size={11} anchor="start" /></g>;
        })}
      </svg></div>
    );
  }
  const box = (key: string, label: string, text: string) => (
    <div key={key} className="min-h-24 rounded-lg border-2 border-neutral-700 p-3"><p className="text-xs font-bold uppercase">{label}</p><p className="mt-1 whitespace-pre-wrap text-sm">{text}</p></div>
  );
  if (v.template === "frayer") {
    return (
      <div ref={ref as React.Ref<HTMLDivElement>}>{head}<div className="relative grid grid-cols-2 gap-2">
        {box("d", "Ta'rif", v.definition)}{box("c", "Xususiyatlari", v.characteristics)}{box("e", "Misollar", v.examples)}{box("n", "Misol emas", v.nonExamples)}
        <div className="absolute left-1/2 top-1/2 w-40 -translate-x-1/2 -translate-y-1/2 rounded-xl border-2 border-neutral-700 bg-white p-2 text-center font-extrabold text-neutral-900">{v.term || "Tushuncha"}</div>
      </div></div>
    );
  }
  if (v.template === "compare") {
    return (
      <div ref={ref as React.Ref<HTMLDivElement>}>{head}<table className="w-full border-collapse text-sm"><thead><tr>{v.headers.map((h, i) => <th key={i} className="border border-neutral-700 bg-neutral-100 px-3 py-2 text-left text-neutral-900">{h}</th>)}</tr></thead>
        <tbody>{v.rows.map((r, i) => <tr key={i}>{v.headers.map((_, j) => <td key={j} className="h-9 border border-neutral-700 px-3 py-2 align-top">{r[j] ?? ""}</td>)}</tr>)}</tbody></table></div>
    );
  }
  if (v.template === "cards") {
    return (
      <div ref={ref as React.Ref<HTMLDivElement>}>{head}<p className="mb-2 text-xs text-muted-foreground print:hidden">Chop etgach chiziq bo'ylab kesing. Chap — old tomon, o'ng — orqa tomon.</p>
        <div className="grid grid-cols-2 gap-2">{v.cards.map((c, i) => (
          <div key={i} className="print-break grid grid-cols-2 border-2 border-dashed border-neutral-500">
            <div className="grid min-h-28 place-items-center border-r border-dashed border-neutral-500 p-3 text-center text-base font-bold">{c.front}</div>
            <div className="grid min-h-28 place-items-center p-3 text-center text-sm">{c.back}</div>
          </div>))}</div></div>
    );
  }
  return (
    <div ref={ref as React.Ref<HTMLDivElement>}>{head}<div className="space-y-4">{v.blocks.map((b, i) => <div key={i} className="print-break">{b.heading && <h3 className="text-lg font-bold">{b.heading}</h3>}<p className="whitespace-pre-wrap">{b.text}</p></div>)}</div></div>
  );
});

// ---------- tahrirlash ----------
const join = (a: string[]) => a.join("\n");

export function Editor({ v, onChange }: { v: Visual; onChange: (v: Visual) => void }) {
  if (v.template === "venn") {
    const n = v.labels.length;
    const setN = (k: 2 | 3) => onChange({ ...v, labels: Array.from({ length: k }, (_, i) => v.labels[i] ?? String.fromCharCode(65 + i)), items: Array.from({ length: k }, (_, i) => v.items[i] ?? []) });
    return (
      <div className="space-y-4">
        <div className="flex gap-2" role="group" aria-label="Doiralar soni">{([2, 3] as const).map((k) => <Button key={k} size="sm" variant={n === k ? "primary" : "outline"} onClick={() => setN(k)}>{k} ta doira</Button>)}</div>
        <div className="grid gap-4 sm:grid-cols-2">{v.labels.map((l, i) => (
          <div key={i} className="space-y-2">
            <Field label={`${i + 1}-doira nomi`}><Input value={l} maxLength={60} onChange={(e) => onChange({ ...v, labels: v.labels.map((x, k) => (k === i ? e.target.value : x)) })} /></Field>
            <Field label="Faqat shunga xos (har qatorda bittadan)"><Textarea value={join(v.items[i] ?? [])} onChange={(e) => onChange({ ...v, items: v.items.map((x, k) => (k === i ? lines(e.target.value).slice(0, 12) : x)) })} /></Field>
          </div>))}</div>
        <Field label="Umumiy (kesishmada)"><Textarea value={join(v.shared)} onChange={(e) => onChange({ ...v, shared: lines(e.target.value).slice(0, 12) })} /></Field>
      </div>
    );
  }
  if (v.template === "cluster") return (
    <div className="space-y-4">
      <Field label="Markaziy tushuncha"><Input value={v.center} maxLength={80} onChange={(e) => onChange({ ...v, center: e.target.value })} /></Field>
      {v.branches.map((b, i) => (
        <div key={i} className="grid gap-2 rounded-xl border border-border p-3 sm:grid-cols-2">
          <Field label={`${i + 1}-tarmoq`}><Input value={b.label} maxLength={60} onChange={(e) => onChange({ ...v, branches: v.branches.map((x, k) => (k === i ? { ...x, label: e.target.value } : x)) })} /></Field>
          <Field label="Bandlar (har qatorda bittadan)"><Textarea className="min-h-16" value={join(b.items)} onChange={(e) => onChange({ ...v, branches: v.branches.map((x, k) => (k === i ? { ...x, items: lines(e.target.value).slice(0, 8) } : x)) })} /></Field>
          <Button size="sm" variant="ghost" className="w-fit" onClick={() => onChange({ ...v, branches: v.branches.filter((_, k) => k !== i) })}><Trash2 className="h-4 w-4 text-danger" />Tarmoqni olib tashlash</Button>
        </div>))}
      {v.branches.length < 8 && <Button size="sm" variant="outline" onClick={() => onChange({ ...v, branches: [...v.branches, { label: "", items: [] }] })}><Plus className="h-4 w-4" />Tarmoq</Button>}
    </div>
  );
  if (v.template === "fishbone") return (
    <div className="space-y-4">
      <Field label="Muammo (baliq boshi)"><Input value={v.problem} maxLength={120} onChange={(e) => onChange({ ...v, problem: e.target.value })} /></Field>
      {v.causes.map((c, i) => (
        <div key={i} className="grid gap-2 rounded-xl border border-border p-3 sm:grid-cols-2">
          <Field label={`${i + 1}-sabab guruhi`}><Input value={c.label} maxLength={60} onChange={(e) => onChange({ ...v, causes: v.causes.map((x, k) => (k === i ? { ...x, label: e.target.value } : x)) })} /></Field>
          <Field label="Sabablar (har qatorda bittadan)"><Textarea className="min-h-16" value={join(c.items)} onChange={(e) => onChange({ ...v, causes: v.causes.map((x, k) => (k === i ? { ...x, items: lines(e.target.value).slice(0, 6) } : x)) })} /></Field>
          <Button size="sm" variant="ghost" className="w-fit" onClick={() => onChange({ ...v, causes: v.causes.filter((_, k) => k !== i) })}><Trash2 className="h-4 w-4 text-danger" />Guruhni olib tashlash</Button>
        </div>))}
      {v.causes.length < 6 && <Button size="sm" variant="outline" onClick={() => onChange({ ...v, causes: [...v.causes, { label: "", items: [] }] })}><Plus className="h-4 w-4" />Sabab guruhi</Button>}
    </div>
  );
  if (v.template === "frayer") return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label="Tushuncha" className="sm:col-span-2"><Input value={v.term} maxLength={80} onChange={(e) => onChange({ ...v, term: e.target.value })} /></Field>
      {([["definition", "Ta'rif"], ["characteristics", "Xususiyatlari"], ["examples", "Misollar"], ["nonExamples", "Misol emas"]] as const).map(([k, l]) => (
        <Field key={k} label={l}><Textarea value={v[k]} maxLength={400} onChange={(e) => onChange({ ...v, [k]: e.target.value })} /></Field>))}
    </div>
  );
  if (v.template === "compare") return (
    <div className="space-y-3">
      <div className="overflow-x-auto"><table className="w-full min-w-[480px] border-separate border-spacing-1"><thead><tr>{v.headers.map((h, i) => (
        <th key={i}><Input value={h} placeholder={`${i + 1}-ustun sarlavhasi`} aria-label={`${i + 1}-ustun sarlavhasi`} maxLength={60} onChange={(e) => onChange({ ...v, headers: v.headers.map((x, k) => (k === i ? e.target.value : x)) })} /></th>))}<th /></tr></thead>
        <tbody>{v.rows.map((r, i) => (
          <tr key={i}>{v.headers.map((_, j) => <td key={j}><Input value={r[j] ?? ""} aria-label={`${i + 1}-qator, ${j + 1}-ustun`} maxLength={200} onChange={(e) => onChange({ ...v, rows: v.rows.map((row, k) => (k === i ? v.headers.map((__, c) => (c === j ? e.target.value : row[c] ?? "")) : row)) })} /></td>)}
            <td><Button variant="ghost" size="icon" aria-label="Qatorni o'chirish" onClick={() => onChange({ ...v, rows: v.rows.filter((_, k) => k !== i) })}><Trash2 className="h-4 w-4" /></Button></td></tr>))}</tbody></table></div>
      <div className="flex flex-wrap gap-2">
        {v.rows.length < 20 && <Button size="sm" variant="outline" onClick={() => onChange({ ...v, rows: [...v.rows, v.headers.map(() => "")] })}><Plus className="h-4 w-4" />Qator</Button>}
        {v.headers.length < 5 && <Button size="sm" variant="outline" onClick={() => onChange({ ...v, headers: [...v.headers, ""], rows: v.rows.map((r) => [...r, ""]) })}><Plus className="h-4 w-4" />Ustun</Button>}
        {v.headers.length > 2 && <Button size="sm" variant="ghost" onClick={() => onChange({ ...v, headers: v.headers.slice(0, -1), rows: v.rows.map((r) => r.slice(0, -1)) })}>Oxirgi ustunni olib tashlash</Button>}
      </div>
    </div>
  );
  if (v.template === "cards") return (
    <div className="space-y-3">
      {v.cards.map((c, i) => (
        <div key={i} className="grid gap-2 rounded-xl border border-border p-3 sm:grid-cols-[1fr_1fr_auto]">
          <Field label={`${i + 1}-kartochka: old`}><Input value={c.front} maxLength={200} onChange={(e) => onChange({ ...v, cards: v.cards.map((x, k) => (k === i ? { ...x, front: e.target.value } : x)) })} /></Field>
          <Field label="Orqa"><Input value={c.back} maxLength={300} onChange={(e) => onChange({ ...v, cards: v.cards.map((x, k) => (k === i ? { ...x, back: e.target.value } : x)) })} /></Field>
          <Button variant="ghost" size="icon" className="self-end" aria-label="Kartochkani o'chirish" onClick={() => onChange({ ...v, cards: v.cards.filter((_, k) => k !== i) })}><Trash2 className="h-4 w-4" /></Button>
        </div>))}
      {v.cards.length < 24 && <Button size="sm" variant="outline" onClick={() => onChange({ ...v, cards: [...v.cards, { front: "", back: "" }] })}><Plus className="h-4 w-4" />Kartochka</Button>}
    </div>
  );
  return (
    <div className="space-y-3">
      {v.blocks.map((b, i) => (
        <div key={i} className="space-y-2 rounded-xl border border-border p-3">
          <Field label={`${i + 1}-blok sarlavhasi (ixtiyoriy)`}><Input value={b.heading ?? ""} maxLength={120} onChange={(e) => onChange({ ...v, blocks: v.blocks.map((x, k) => (k === i ? { ...x, heading: e.target.value } : x)) })} /></Field>
          <Field label="Matn"><Textarea value={b.text} maxLength={3000} onChange={(e) => onChange({ ...v, blocks: v.blocks.map((x, k) => (k === i ? { ...x, text: e.target.value } : x)) })} /></Field>
          <Button size="sm" variant="ghost" onClick={() => onChange({ ...v, blocks: v.blocks.filter((_, k) => k !== i) })}><Trash2 className="h-4 w-4 text-danger" />Blokni o'chirish</Button>
        </div>))}
      {v.blocks.length < 20 && <Button size="sm" variant="outline" onClick={() => onChange({ ...v, blocks: [...v.blocks, { heading: "", text: "" }] })}><Plus className="h-4 w-4" />Blok</Button>}
    </div>
  );
}

/** Word uchun HTML (SVG'siz turlar). */
export function toHtml(v: Visual, title: string): string {
  const e = (s: string) => s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]!);
  const nl = (s: string) => e(s).replace(/\n/g, "<br>");
  const h = `<h1>${e(title)}</h1>`;
  if (v.template === "frayer") return `${h}<table width="100%"><tr><td colspan="2" align="center"><b>${e(v.term)}</b></td></tr><tr><td><b>Ta'rif</b><br>${nl(v.definition)}</td><td><b>Xususiyatlari</b><br>${nl(v.characteristics)}</td></tr><tr><td><b>Misollar</b><br>${nl(v.examples)}</td><td><b>Misol emas</b><br>${nl(v.nonExamples)}</td></tr></table>`;
  if (v.template === "compare") return `${h}<table width="100%"><tr>${v.headers.map((x) => `<th>${e(x)}</th>`).join("")}</tr>${v.rows.map((r) => `<tr>${v.headers.map((_, j) => `<td>${e(r[j] ?? "")}</td>`).join("")}</tr>`).join("")}</table>`;
  if (v.template === "cards") return `${h}<table width="100%">${v.cards.map((c) => `<tr><td width="50%"><b>${e(c.front)}</b></td><td>${e(c.back)}</td></tr>`).join("")}</table>`;
  if (v.template === "handout") return h + v.blocks.map((b) => `${b.heading ? `<h2>${e(b.heading)}</h2>` : ""}<p>${nl(b.text)}</p>`).join("");
  return h;
}
