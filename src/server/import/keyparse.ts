/**
 * Javoblar kalitini matndan ajratish (toza funksiyalar). Qo'llab-quvvatlanadigan ko'rinishlar:
 *   1-A  2-C  |  1.A  2.B  |  1) A  2) B  |  1 A  2 B  |  1:B  |  1=B  |  jadval: 1 | A | 2 | B
 *   1-10: ABCDABCDAB (oraliq)  |  3-AB (bir nechta to'g'ri)
 * Lotin (A B C D) va kirill (А Б В Г) harflari qo'llab-quvvatlanadi: ichki ko'rinish doim lotin (A, B, C ...).
 */
export type LabelStyle = "latin" | "ru";

const LATIN = "ABCDEFGHIJ";
const RU = "АБВГДЕЖЗИК"; // kirill tartibi: А Б В Г Д Е ...

export const LETTER_CLASS = "A-Ja-jАБВГДЕабвгде";

/** Harfni lotin yorlig'iga aylantiradi (A..J). Kirill harflar uslubga qarab: «ru» da А Б В Г = A B C D; «latin» da А В С Е ko'rinishi o'xshash lotin harflari. */
export function canonLabel(ch: string, style: LabelStyle = "latin"): string | null {
  const u = ch.toUpperCase();
  if (/^[A-J]$/.test(u)) return u;
  if (style === "ru") { const i = RU.indexOf(u); return i >= 0 ? LATIN[i] : null; }
  const look: Record<string, string> = { "А": "A", "В": "B", "С": "C", "Е": "E", "Б": "B", "Г": "D", "Д": "D" };
  return look[u] ?? null;
}

/** Hujjatdagi harf uslubini aniqlaydi: kirillning «Б» yoki «Г» harflari bo'lsa rus tartibi. */
export function detectLabelStyle(samples: string): LabelStyle {
  return /[БГбг]/.test(samples) ? "ru" : "latin";
}

/** group: kalit jadvali qaysi test/bo'limga tegishli (masalan «Diagnostika testi Kuzgi No: 1»); AI aniqlagan bo'lsa to'ldiriladi. explanation: kalitda javob yonida izoh/yechim berilgan bo'lsa, o'sha matn. */
export type KeyEntry = { number: number; answers: string[]; section: number; group?: string; explanation?: string };
export type KeyParse = { entries: KeyEntry[]; style: LabelStyle };

/** «Izoh», «Yechim», «Tushuntirish» kabi so'zlar: javobning izohi shu so'z bilan boshlanadi. */
export const NOTE_LABEL = "(?:izoh(?:i)?|yechim(?:i)?|tushuntirish(?:i)?|sharh|explanation|solution|пояснение|объяснение|решение|изох)";
const MAX_NOTE = 600;
export const cleanNote = (s: string) => s.replace(/\s+/g, " ").trim().slice(0, MAX_NOTE);
// «1-B. Izoh: matn», «1) B — matn», «12. AB: matn»: javobdan keyin kamida 6 belgili matn
const ENTRY_NOTE = new RegExp(`^\\s*(\\d{1,4})\\s*[-–—.):=]?\\s*([${LETTER_CLASS}]{1,4}(?:\\s*[,;&]\\s*[${LETTER_CLASS}])*)\\s*(?:[-–—:.)]\\s*|\\s+)(?:${NOTE_LABEL}\\s*[:\\-–—]\\s*)?(\\S.{5,})$`, "iu");
const NOTE_ONLY = new RegExp(`^\\s*${NOTE_LABEL}\\s*[:\\-–—]\\s*(\\S.*)$`, "iu");
/** «Izoh: matn» qatori (butun qator) va qator oxiridagi «... Izoh: matn». */
export const NOTE_LINE = NOTE_ONLY;
export const NOTE_INLINE = new RegExp(`${NOTE_LABEL}\\s*[:\\-–—]\\s*(\\S.*)$`, "iu");
const TABLE_LETTERS = new RegExp(`^[${LETTER_CLASS}](?:\\s*[,;&]?\\s*[${LETTER_CLASS}]){0,3}$`);

/** Kalit bo'limidagi qator javob + izoh ko'rinishidami («1-B. Izoh: ...»). Bunday qator savol emas, kalit yozuvi. */
export const isKeyNoteLine = (line: string): boolean => !isKeyLine(line) && ENTRY_NOTE.test(line.trim());

const SEP = "[\\s|]*";
const RANGE = new RegExp(`(\\d{1,4})\\s*[-–—]\\s*(\\d{1,4})\\s*[:.)=]\\s*([${LETTER_CLASS}](?:[\\s,;]*[${LETTER_CLASS}])+)`, "gu");
const TOKEN = new RegExp(`(?<![\\p{L}\\d])(\\d{1,4})\\s*[-–—.):=]?${SEP}([${LETTER_CLASS}]{1,4}(?:\\s*[,;&]\\s*[${LETTER_CLASS}])*)(?![\\p{L}\\d])`, "gu");

const splitLetters = (raw: string, style: LabelStyle): string[] => {
  const out: string[] = [];
  for (const ch of raw.replace(/[\s,;&]/g, "")) { const l = canonLabel(ch, style); if (l && !out.includes(l)) out.push(l); }
  return out.sort();
};

/** Qatorlar kalitga o'xshaydimi (zich «raqam-harf» juftliklari). */
export function isKeyLine(line: string): boolean {
  const t = line.trim();
  if (!t) return false;
  const tokens = [...t.matchAll(TOKEN)].length + [...t.matchAll(RANGE)].length;
  const rest = t.replace(RANGE, " ").replace(TOKEN, " ").replace(/[\s|,;.:\-–—)(]/g, "");
  return tokens >= 1 && rest.length <= Math.max(6, tokens * 2);
}

/** Kalit sarlavhasi: «Javoblar», «Kalit», «Answer key», «Ключ», «Ответы». */
export const KEY_HEADING = /^\s*(?:test\s+)?(?:javoblar(?:\s+kaliti)?|kalit(?:lar)?|to['’ʻ‘`]?g['’ʻ‘`]?ri\s+javoblar|answers?(?:\s+key)?|answer\s+key|ключ(?:и)?|ответы|жавоблар)\s*[:.]?\s*$/i;

export function parseAnswerKey(text: string, styleHint?: LabelStyle): KeyParse {
  const style = styleHint ?? detectLabelStyle(text);
  const entries: KeyEntry[] = [];
  let section = 0, last = 0, noteOpen = false;
  const push = (number: number, answers: string[], note?: string) => {
    if (!answers.length) return;
    if (number === 1 && last > 1) section++;
    entries.push({ number, answers, section, ...(note ? { explanation: cleanNote(note) } : {}) });
    last = number;
  };
  const addNote = (note: string) => { const e = entries[entries.length - 1]; if (e) e.explanation = cleanNote(`${e.explanation ?? ""} ${note}`); };
  for (const line of text.split(/\r?\n/)) {
    const t = line.trim();
    if (!t) { noteOpen = false; continue; }
    if (KEY_HEADING.test(t)) { noteOpen = false; continue; }
    // jadval qatori: «1 | B | izoh matni» (uchinchi katak raqam emas, matn)
    if (t.includes("|")) {
      const cells = t.split("|").map((c) => c.trim());
      if (cells.length >= 3 && /^\d{1,4}$/.test(cells[0]) && TABLE_LETTERS.test(cells[1]) && cells[2].length >= 3 && !/^\d{1,4}$/.test(cells[2]) && !TABLE_LETTERS.test(cells[2])) {
        push(Number(cells[0]), splitLetters(cells[1], style), cells.slice(2).filter(Boolean).join(" "));
        noteOpen = true; continue;
      }
    }
    if (!isKeyLine(t)) {
      // «Izoh: ...» qatori oldingi javobga tegishli
      const nm = NOTE_ONLY.exec(t);
      if (nm && entries.length) { addNote(nm[1]); noteOpen = true; continue; }
      // «1-B. Izoh: ...» — javob va izoh bir qatorda
      const em = ENTRY_NOTE.exec(t);
      if (em) { push(Number(em[1]), splitLetters(em[2], style), em[3]); noteOpen = true; continue; }
      // izohning davomi (o'ralgan matn)
      if (noteOpen && entries[entries.length - 1]?.explanation !== undefined) { addNote(t); continue; }
    }
    noteOpen = false;
    let rest = line;
    for (const m of line.matchAll(RANGE)) {
      const a = Number(m[1]), b = Number(m[2]);
      const ls = splitLetters(m[3], style);
      const letters = [...m[3].replace(/[\s,;]/g, "")].map((c) => canonLabel(c, style)).filter((x): x is string => !!x);
      if (b >= a && b - a + 1 === letters.length && ls.length) for (let i = 0; i < letters.length; i++) push(a + i, [letters[i]]);
      rest = rest.replace(m[0], " ");
    }
    for (const m of rest.matchAll(TOKEN)) push(Number(m[1]), splitLetters(m[2], style));
  }
  return { entries, style };
}

/** Kalit bo'limlari (raqamlash qayta boshlanishi bo'yicha) → raqam → yozuv (javoblar va izoh). */
export function keySectionEntries(entries: KeyEntry[]): Map<number, KeyEntry>[] {
  const out: Map<number, KeyEntry>[] = [];
  for (const e of entries) { (out[e.section] ??= new Map()).set(e.number, e); }
  return out.filter(Boolean);
}

/** Kalit bo'limlari (raqamlash qayta boshlanishi bo'yicha) → raqam → javoblar. */
export function keySections(entries: KeyEntry[]): Map<number, string[]>[] {
  return keySectionEntries(entries).map((m) => new Map([...m].map(([n, e]) => [n, e.answers] as const)));
}
