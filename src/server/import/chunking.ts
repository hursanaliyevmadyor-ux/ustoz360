import type { Page } from "./officetext";

/** Matnli hujjatni AI uchun bo'laklarga ajratish (toza funksiyalar). Bo'lak sahifa chegarasida tugaydi; juda uzun sahifa abzatslar bo'yicha bo'linadi. */
export type TextChunk = { text: string; labels: string[] };

export function buildTextChunks(pages: Page[], maxChars = 7000, maxChunks = 40): TextChunk[] {
  const chunks: TextChunk[] = [];
  let cur = "", labels: string[] = [];
  const flush = () => { if (cur.trim()) chunks.push({ text: cur.trim(), labels }); cur = ""; labels = []; };
  for (const p of pages) {
    const head = `[${p.label}]\n`;
    if (head.length + p.text.length > maxChars) {
      flush();
      // uzun sahifa: abzatslar bo'yicha
      let part = "";
      for (const para of p.text.split(/\n/)) {
        if (part.length + para.length + 1 > maxChars - head.length && part) { chunks.push({ text: head + part.trim(), labels: [p.label] }); part = ""; }
        part += para + "\n";
      }
      if (part.trim()) chunks.push({ text: head + part.trim(), labels: [p.label] });
      continue;
    }
    if (cur.length + head.length + p.text.length > maxChars) flush();
    cur += head + p.text + "\n\n"; labels.push(p.label);
  }
  flush();
  return chunks.slice(0, maxChunks);
}

/** PDF sahifalari sonini taxminan aniqlaydi (/Type /Page obyektlari). Siqilgan obyekt oqimlarida 0 qaytishi mumkin. */
export function pdfPageCountGuess(bytes: Uint8Array): number {
  const s = Buffer.from(bytes).toString("latin1");
  const m = s.match(/\/Type\s*\/Page(?![s\w])/g);
  const counts = s.match(/\/Count\s+(\d+)/g)?.map((x) => Number(x.replace(/\D/g, ""))) ?? [];
  return Math.max(m?.length ?? 0, counts.length ? Math.max(...counts) : 0);
}

/** PDF uchun sahifa oraliqlari (har bir chaqiruv uchun `size` sahifagacha). */
export function pageRanges(total: number, size = 8): { from: number; to: number }[] {
  const out: { from: number; to: number }[] = [];
  for (let from = 1; from <= total; from += size) out.push({ from, to: Math.min(total, from + size - 1) });
  return out;
}

export type ExtractRange = { from: number; to: number; kind?: "Q" | "K" };

/** «3-14, 20, 655-657» ko'rinishidagi sahifalar ro'yxatini oraliqlarga aylantiradi. Noto'g'ri yozuv: null. Oraliqlar tartiblanadi va birlashtiriladi. */
export function parsePageSpec(spec: string | null | undefined, maxPage = 5000): { from: number; to: number }[] | null {
  const raw = (spec ?? "").trim();
  if (!raw) return null;
  const out: { from: number; to: number }[] = [];
  for (const part of raw.split(/[,;\s]+/).filter(Boolean)) {
    const m = /^(\d{1,4})(?:\s*[-–—]\s*(\d{1,4}))?$/.exec(part);
    if (!m) return null;
    const a = Number(m[1]), b = m[2] ? Number(m[2]) : a;
    if (a < 1 || b < a || b > maxPage) return null;
    out.push({ from: a, to: b });
  }
  out.sort((x, y) => x.from - y.from);
  const merged: { from: number; to: number }[] = [];
  for (const r of out) { const l = merged[merged.length - 1]; if (l && r.from <= l.to + 1) l.to = Math.max(l.to, r.to); else merged.push({ ...r }); }
  return merged;
}

/**
 * AI chaqiruvlari uchun sahifa oraliqlari: savollar (Q, har biri 8 sahifagacha) va javoblar kaliti (K, 10 sahifagacha) sahifa tartibida.
 * `spec` (foydalanuvchi tanlagan sahifalar) bo'lsa, faqat shular olinadi; tur hujjat tuzilmasidan aniqlanadi (aniqlanmasa Q: kalit jadvallari ham `answerKey` ga tushadi).
 */
export function extractionRanges(sections: { kind: string; fromPage?: number | null; toPage?: number | null }[], total: number, spec?: { from: number; to: number }[] | null): ExtractRange[] {
  const typed = sections.filter((s) => s.fromPage && s.toPage && (s.toPage as number) >= (s.fromPage as number)).map((s) => ({ from: s.fromPage as number, to: s.toPage as number, k: /ANSWER_KEY/i.test(s.kind) ? "K" as const : /^QUESTIONS|EXERCISES$/i.test(s.kind) ? "Q" as const : null }));
  const useful = typed.filter((s) => s.k);
  const base: { from: number; to: number; k: "Q" | "K" }[] = spec?.length
    ? spec.map((r) => ({ from: r.from, to: r.to, k: (useful.find((s) => s.k === "K" && s.from <= r.from && s.to >= r.to) ? "K" : "Q") as "Q" | "K" }))
    : useful.length ? useful.map((s) => ({ from: s.from, to: s.to, k: s.k as "Q" | "K" })) : [{ from: 1, to: Math.max(1, total), k: "Q" as const }];
  const out: ExtractRange[] = [];
  for (const r of base.sort((a, b) => a.from - b.from)) {
    const hi = total ? Math.min(total, r.to) : r.to, size = r.k === "K" ? 10 : 8;
    for (let from = r.from; from <= hi; from += size) out.push({ from, to: Math.min(hi, from + size - 1), kind: r.k });
  }
  return out;
}

/** Mazmun turi oraliqlaridan faqat savol bo'limlarini oladi; oraliq yo'q bo'lsa butun hujjat. */
export function questionRanges(sections: { kind: string; fromPage?: number | null; toPage?: number | null }[], total: number): { from: number; to: number }[] {
  const q = sections.filter((s) => /^QUESTIONS|EXERCISES$/i.test(s.kind) && s.fromPage && s.toPage && s.toPage >= s.fromPage);
  const base = q.length ? q.map((s) => ({ from: Math.max(1, s.fromPage as number), to: Math.min(total || (s.toPage as number), s.toPage as number) })) : [{ from: 1, to: Math.max(1, total) }];
  return base.flatMap((r) => pageRanges(r.to, 8).filter((x) => x.to >= r.from).map((x) => ({ from: Math.max(x.from, r.from), to: x.to })));
}
