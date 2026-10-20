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

/** Mazmun turi oraliqlaridan faqat savol bo'limlarini oladi; oraliq yo'q bo'lsa butun hujjat. */
export function questionRanges(sections: { kind: string; fromPage?: number | null; toPage?: number | null }[], total: number): { from: number; to: number }[] {
  const q = sections.filter((s) => /^QUESTIONS|EXERCISES$/i.test(s.kind) && s.fromPage && s.toPage && s.toPage >= s.fromPage);
  const base = q.length ? q.map((s) => ({ from: Math.max(1, s.fromPage as number), to: Math.min(total || (s.toPage as number), s.toPage as number) })) : [{ from: 1, to: Math.max(1, total) }];
  return base.flatMap((r) => pageRanges(r.to, 8).filter((x) => x.to >= r.from).map((x) => ({ from: Math.max(x.from, r.from), to: x.to })));
}
