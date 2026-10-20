/**
 * Savol matnidagi rasm belgilari (server va brauzer uchun umumiy, toza funksiyalar).
 *  - `[[RASM:n]]` — import paytidagi joy belgisi (asl faylning qaysi joyida rasm/jadval borligi);
 *  - `[[rasm:<egasi>/<nom>]]` — saqlangan rasm (tayyor testda): `/api/figures/<egasi>/<nom>` orqali ko'rsatiladi.
 */
export type FigurePiece = { type: "text"; text: string } | { type: "image"; path: string } | { type: "slot"; n: number };

const ANY = /\[\[RASM:(\d{1,2})\]\]|\[\[rasm:([A-Za-z0-9_-]{1,64}\/[A-Za-z0-9_.-]{1,160})\]\]/g;

/** Matnni bo'laklarga ajratadi: oddiy matn, saqlangan rasm va hali kesilmagan rasm joyi. */
export function splitFigureText(text: string): FigurePiece[] {
  const out: FigurePiece[] = [];
  let last = 0;
  for (const m of text.matchAll(ANY)) {
    const at = m.index ?? 0;
    if (at > last) out.push({ type: "text", text: text.slice(last, at) });
    out.push(m[1] ? { type: "slot", n: Number(m[1]) } : { type: "image", path: m[2] });
    last = at + m[0].length;
  }
  if (last < text.length) out.push({ type: "text", text: text.slice(last) });
  return out;
}

/** Matndagi `[[RASM:n]]` belgilarining raqamlari (takrorlarsiz, tartib bo'yicha). */
export const slotNumbers = (text: string): number[] => [...new Set([...text.matchAll(/\[\[RASM:(\d{1,2})\]\]/g)].map((m) => Number(m[1])))];

/** Matndagi saqlangan rasm yo'llari (`egasi/nom`). */
export const imagePaths = (text: string): string[] => [...text.matchAll(/\[\[rasm:([A-Za-z0-9_-]{1,64}\/[A-Za-z0-9_.-]{1,160})\]\]/g)].map((m) => m[1]);

/** Qidiruv, ro'yxat va qisqa ko'rinishlar uchun: rasm belgilari «[rasm]» deb almashtiriladi. */
export const plainFigureText = (text: string): string => text.replace(ANY, "[rasm]").replace(/[ \t]+\n/g, "\n").trim();
