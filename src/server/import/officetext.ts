import { decodeText, type ImportKind } from "./formats";
import { openZip, readText, type Zip } from "./zipx";

/**
 * Office va OpenDocument fayllaridan matn ajratish (kutubxonasiz: ZIP + XML). Jadvallar «katak | katak» qatorlariga aylanadi,
 * ro'yxat raqamlari (Word/LibreOffice avtoraqamlash) matnga qo'shiladi, sahifa/slayd/varaq chegaralari saqlanadi.
 * Natija: sahifalar ro'yxati — keyingi bosqichlarda savol manbasini («Slayd 3», «Varaq Sheet1») ko'rsatish uchun.
 */
export type Page = { label: string; text: string };
export type ParsedDoc = { pages: Page[]; images: number; note?: string };

const MAX_ROWS = 5000;
const MAX_SHEETS = 20;

// ---------- umumiy XML yordamchilari ----------
const ENT: Record<string, string> = { lt: "<", gt: ">", amp: "&", quot: '"', apos: "'" };
export const decodeXml = (s: string) => s.replace(/&(#x[0-9a-fA-F]+|#\d+|[a-z]+);/g, (m, e: string) => {
  if (e[0] === "#") { const n = e[1] === "x" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10); return Number.isFinite(n) && n > 0 && n < 0x110000 ? String.fromCodePoint(n) : ""; }
  return ENT[e] ?? m;
});
const escapeXml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

type Tok = { k: "open" | "close" | "self" | "text"; n: string; a: string; t: string };
function* xmlTokens(xmlRaw: string): Generator<Tok> {
  const xml = xmlRaw.replace(/<\?[\s\S]*?\?>/g, "").replace(/<!--[\s\S]*?-->/g, "").replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, (_, c: string) => escapeXml(c));
  const re = /<(\/?)([A-Za-z_][\w:.-]*)([^>]*?)(\/?)>|([^<]+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml))) {
    if (m[5] !== undefined) yield { k: "text", n: "", a: "", t: decodeXml(m[5]) };
    else if (m[1]) yield { k: "close", n: m[2], a: "", t: "" };
    else yield { k: m[4] ? "self" : "open", n: m[2], a: m[3], t: "" };
  }
}
const attr = (a: string, name: string): string | undefined => new RegExp(`(?:^|\\s)${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}="([^"]*)"`).exec(a)?.[1];

const ROMAN: [number, string][] = [[1000, "M"], [900, "CM"], [500, "D"], [400, "CD"], [100, "C"], [90, "XC"], [50, "L"], [40, "XL"], [10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"]];
const roman = (n: number) => { let s = ""; for (const [v, r] of ROMAN) while (n >= v) { s += r; n -= v; } return s; };
const letters = (n: number, alpha: string) => { let s = ""; let x = n; while (x > 0) { x--; s = alpha[x % alpha.length] + s; x = Math.floor(x / alpha.length); } return s; };
const RU = "АБВГДЕЖЗИКЛМНОПРСТУФХЦЧШЩЭЮЯ";
/** Raqamlash formatini matnga aylantiradi (Word numFmt / ODF num-format). */
export function formatNumber(n: number, fmt: string): string {
  switch (fmt) {
    case "upperLetter": case "A": return letters(n, "ABCDEFGHIJKLMNOPQRSTUVWXYZ");
    case "lowerLetter": case "a": return letters(n, "abcdefghijklmnopqrstuvwxyz");
    case "upperRoman": case "I": return roman(n);
    case "lowerRoman": case "i": return roman(n).toLowerCase();
    case "russianUpper": return letters(n, RU);
    case "russianLower": return letters(n, RU.toLowerCase());
    case "decimalZero": return String(n).padStart(2, "0");
    default: return String(n);
  }
}

// ---------- DOCX ----------
type NumLevel = { fmt: string; text: string; start: number };
function docxNumbering(z: Zip) {
  const abstracts = new Map<string, Map<number, NumLevel>>();
  const nums = new Map<string, string>();
  const xml = readText(z, "word/numbering.xml");
  if (!xml) return { abstracts, nums };
  let absId = "", lvl = -1, curNum = "";
  for (const t of xmlTokens(xml)) {
    if (t.k === "open" && t.n === "w:abstractNum") { absId = attr(t.a, "w:abstractNumId") ?? ""; abstracts.set(absId, new Map()); }
    else if (t.k === "open" && t.n === "w:lvl") { lvl = Number(attr(t.a, "w:ilvl") ?? 0); abstracts.get(absId)?.set(lvl, { fmt: "decimal", text: "%1.", start: 1 }); }
    else if ((t.k === "self" || t.k === "open") && t.n === "w:numFmt" && lvl >= 0) { const l = abstracts.get(absId)?.get(lvl); if (l) l.fmt = attr(t.a, "w:val") ?? "decimal"; }
    else if ((t.k === "self" || t.k === "open") && t.n === "w:lvlText" && lvl >= 0) { const l = abstracts.get(absId)?.get(lvl); if (l) l.text = attr(t.a, "w:val") ?? ""; }
    else if ((t.k === "self" || t.k === "open") && t.n === "w:start" && lvl >= 0) { const l = abstracts.get(absId)?.get(lvl); if (l) l.start = Number(attr(t.a, "w:val") ?? 1); }
    else if (t.k === "close" && t.n === "w:abstractNum") { absId = ""; lvl = -1; }
    else if (t.k === "open" && t.n === "w:num") curNum = attr(t.a, "w:numId") ?? "";
    else if ((t.k === "self" || t.k === "open") && t.n === "w:abstractNumId" && curNum) { nums.set(curNum, attr(t.a, "w:val") ?? ""); curNum = ""; }
  }
  return { abstracts, nums };
}

export function extractDocx(z: Zip): ParsedDoc | null {
  const xml = readText(z, "word/document.xml");
  if (!xml) return null;
  const { abstracts, nums } = docxNumbering(z);
  const counters = new Map<string, number[]>();
  const pages: Page[] = [];
  let lines: string[] = [];
  let images = 0;
  const pushPage = () => { const text = lines.join("\n").replace(/\n{3,}/g, "\n\n").trim(); if (text) pages.push({ label: `Sahifa ${pages.length + 1}`, text }); lines = []; };

  let inT = false, para = "", inPara = false, numId = "", ilvl = 0, inNumPr = false;
  let tblDepth = 0, rows: string[][] = [], row: string[] = [], cell = "", inCell = false;
  const label = (): string => {
    if (!numId || numId === "0") return "";
    const abs = abstracts.get(nums.get(numId) ?? "");
    const lv = abs?.get(ilvl);
    if (!abs || !lv) return "";
    if (lv.fmt === "bullet" || lv.fmt === "none") return "";
    const c = counters.get(numId) ?? [];
    for (let i = 0; i <= ilvl; i++) if (c[i] === undefined) c[i] = (abs.get(i)?.start ?? 1) - 1;
    c[ilvl] = (c[ilvl] ?? 0) + 1;
    for (let i = ilvl + 1; i < c.length; i++) c[i] = (abs.get(i)?.start ?? 1) - 1;
    counters.set(numId, c);
    return lv.text.replace(/%(\d)/g, (_, d: string) => { const i = Number(d) - 1; return formatNumber(c[i] ?? 1, abs.get(i)?.fmt ?? "decimal"); });
  };
  for (const t of xmlTokens(xml)) {
    if (t.k === "text") { if (inT) para += t.t; continue; }
    const n = t.n;
    if (t.k === "open" || t.k === "self") {
      if (n === "w:p") { inPara = true; para = ""; numId = ""; ilvl = 0; }
      else if (n === "w:numPr") inNumPr = t.k === "open";
      else if (n === "w:ilvl" && inNumPr) ilvl = Number(attr(t.a, "w:val") ?? 0);
      else if (n === "w:numId" && inNumPr) numId = attr(t.a, "w:val") ?? "";
      else if (n === "w:t" || n === "m:t") inT = t.k === "open";
      else if (n === "w:tab") para += "\t";
      else if (n === "w:br") { if (attr(t.a, "w:type") === "page") { if (tblDepth === 0) { if (para.trim()) lines.push(para); para = ""; pushPage(); } } else para += "\n"; }
      else if (n === "w:lastRenderedPageBreak") { /* Word hisoblagan taxminiy sahifa chegarasi: ishonchsiz, e'tiborga olinmaydi */ }
      else if (n === "w:drawing" || n === "w:pict") images++;
      else if (n === "w:tbl") { tblDepth++; if (tblDepth === 1) rows = []; }
      else if (n === "w:tr" && tblDepth === 1) row = [];
      else if (n === "w:tc" && tblDepth === 1) { cell = ""; inCell = true; }
    } else {
      if (n === "w:t" || n === "m:t") inT = false;
      else if (n === "w:numPr") inNumPr = false;
      else if (n === "w:p") {
        inPara = false;
        const text = para.replace(/[ \t]+$/g, "");
        const lab = text.trim() ? label() : "";
        const line = lab ? `${lab} ${text}` : text;
        if (tblDepth >= 1 && inCell) cell += (cell ? " " : "") + line.trim();
        else lines.push(line);
      }
      else if (n === "w:tc" && tblDepth === 1) { row.push(cell.trim()); inCell = false; }
      else if (n === "w:tr" && tblDepth === 1) { if (row.some((c) => c)) rows.push(row); }
      else if (n === "w:tbl") { tblDepth--; if (tblDepth === 0) { for (const r of rows) lines.push(r.join(" | ")); rows = []; } }
    }
  }
  void inPara;
  pushPage();
  const note = images > 0 ? `Hujjatda ${images} ta rasm/chizma bor: rasmdagi matn, formula yoki variantlar matnga aylantirilmadi.` : undefined;
  return pages.length ? { pages, images, note } : { pages: [], images, note: note ?? "Hujjatdan matn topilmadi." };
}

// ---------- XLSX ----------
const colIndex = (ref: string): number => { let n = 0; for (const ch of ref.replace(/[^A-Za-z]/g, "").toUpperCase()) n = n * 26 + (ch.charCodeAt(0) - 64); return Math.max(0, n - 1); };

export function extractXlsx(z: Zip): ParsedDoc | null {
  const wb = readText(z, "xl/workbook.xml");
  if (!wb) return null;
  const shared: string[] = [];
  const ss = readText(z, "xl/sharedStrings.xml");
  if (ss) { let cur = "", inSi = false, inT = false; for (const t of xmlTokens(ss)) {
    if (t.k === "open" && t.n === "si") { inSi = true; cur = ""; } else if (t.k === "close" && t.n === "si") { shared.push(cur); inSi = false; }
    else if (t.k === "open" && t.n === "t") inT = true; else if (t.k === "close" && t.n === "t") inT = false;
    else if (t.k === "text" && inSi && inT) cur += t.t;
  } }
  const rels = new Map<string, string>();
  const relXml = readText(z, "xl/_rels/workbook.xml.rels");
  if (relXml) for (const t of xmlTokens(relXml)) if ((t.k === "self" || t.k === "open") && t.n === "Relationship") { const id = attr(t.a, "Id"), tg = attr(t.a, "Target"); if (id && tg) rels.set(id, tg.startsWith("/") ? tg.slice(1) : `xl/${tg}`); }
  const sheets: { name: string; path: string }[] = [];
  for (const t of xmlTokens(wb)) if ((t.k === "self" || t.k === "open") && t.n === "sheet") { const name = attr(t.a, "name"), rid = attr(t.a, "r:id"); const path = rid ? rels.get(rid) : undefined; if (name && path) sheets.push({ name: decodeXml(name), path }); }
  const pages: Page[] = [];
  for (const sh of sheets.slice(0, MAX_SHEETS)) {
    const xml = readText(z, sh.path);
    if (!xml) continue;
    const out: string[] = [];
    let cells: string[] = [], cellType = "", cellRef = "", val = "", inV = false, inIs = false, inT = false, inRow = false;
    for (const t of xmlTokens(xml)) {
      if (t.k === "text") { if (inV || (inIs && inT)) val += t.t; continue; }
      if (t.k === "open" || t.k === "self") {
        if (t.n === "row") { inRow = true; cells = []; }
        else if (t.n === "c") { cellType = attr(t.a, "t") ?? ""; cellRef = attr(t.a, "r") ?? ""; val = ""; }
        else if (t.n === "v") inV = t.k === "open";
        else if (t.n === "is") inIs = t.k === "open";
        else if (t.n === "t" && inIs) inT = t.k === "open";
      } else if (t.k === "close") {
        if (t.n === "v") inV = false;
        else if (t.n === "t") inT = false;
        else if (t.n === "is") inIs = false;
        else if (t.n === "c") { const v = cellType === "s" ? shared[Number(val)] ?? "" : val; cells[colIndex(cellRef || String.fromCharCode(65 + cells.length))] = v.trim(); }
        else if (t.n === "row" && inRow) {
          inRow = false;
          const filled = Array.from(cells, (c) => c ?? "");
          while (filled.length && !filled[filled.length - 1]) filled.pop();
          if (filled.length) out.push(filled.join(" | "));
          if (out.length >= MAX_ROWS) break;
        }
      }
    }
    if (out.length) pages.push({ label: `Varaq «${sh.name}»`, text: out.join("\n") });
  }
  return { pages, images: 0, note: pages.length ? undefined : "Jadvalda matn topilmadi." };
}

// ---------- PPTX ----------
export function extractPptx(z: Zip): ParsedDoc | null {
  const names = [...z.entries.keys()].filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n)).sort((a, b) => Number(/(\d+)\.xml$/.exec(a)?.[1]) - Number(/(\d+)\.xml$/.exec(b)?.[1]));
  if (!names.length) return null;
  const pages: Page[] = [];
  let images = 0;
  names.forEach((nm, i) => {
    const xml = readText(z, nm) ?? "";
    let out = "", inT = false, cellOpen = false;
    for (const t of xmlTokens(xml)) {
      if (t.k === "text") { if (inT) out += t.t; continue; }
      if (t.k === "open" || t.k === "self") {
        if (t.n === "a:t") inT = t.k === "open";
        else if (t.n === "a:br") out += "\n";
        else if (t.n === "a:tc") cellOpen = true;
        else if (t.n === "p:pic") images++;
      } else {
        if (t.n === "a:t") inT = false;
        else if (t.n === "a:p") out += cellOpen ? " " : "\n";
        else if (t.n === "a:tc") { out += " | "; cellOpen = false; }
        else if (t.n === "a:tr") out = out.replace(/\s*\|\s*$/, "") + "\n";
      }
    }
    const text = out.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
    if (text) pages.push({ label: `Slayd ${i + 1}`, text });
  });
  return { pages, images, note: images ? `Slaydlarda ${images} ta rasm bor: rasmdagi matn matnga aylantirilmadi.` : undefined };
}

// ---------- OpenDocument (ODT, ODS, ODP) ----------
type OdfLevel = { fmt: string; prefix: string; suffix: string; bullet: boolean; start: number };
export function extractOdf(z: Zip, kind: "odt" | "ods" | "odp"): ParsedDoc | null {
  const xml = readText(z, "content.xml");
  if (!xml) return null;
  const styles = new Map<string, Map<number, OdfLevel>>();
  const pages: Page[] = [];
  let lines: string[] = [];
  let pageLabel = kind === "odt" ? "Hujjat" : "";
  let slide = 0, images = 0;
  const flush = () => { const text = lines.join("\n").replace(/\n{3,}/g, "\n\n").trim(); if (text) pages.push({ label: pageLabel || `Bo'lim ${pages.length + 1}`, text }); lines = []; };

  let curStyle = "";
  type ListFrame = { style: string; counter: number };
  const listStack: ListFrame[] = [];
  let inP = 0, para = "", pendingLabel = "";
  let tblDepth = 0, row: string[] = [], cell = "", cellRepeat = 1, rowRepeat = 1, inCell = false, rowHasText = false;
  for (const t of xmlTokens(xml)) {
    if (t.k === "text") { if (inP > 0) para += t.t; continue; }
    const n = t.n;
    if (t.k === "open" || t.k === "self") {
      if (n === "text:list-style") { curStyle = attr(t.a, "style:name") ?? ""; styles.set(curStyle, new Map()); }
      else if (n === "text:list-level-style-number" || n === "text:list-level-style-bullet") {
        const lv = Number(attr(t.a, "text:level") ?? 1);
        styles.get(curStyle)?.set(lv, { fmt: attr(t.a, "style:num-format") ?? "1", prefix: attr(t.a, "style:num-prefix") ?? "", suffix: attr(t.a, "style:num-suffix") ?? ".", bullet: n.endsWith("bullet"), start: Number(attr(t.a, "text:start-value") ?? 1) });
      }
      else if (n === "text:list") { listStack.push({ style: attr(t.a, "text:style-name") ?? listStack[listStack.length - 1]?.style ?? "", counter: 0 }); if (t.k === "self") listStack.pop(); }
      else if (n === "text:list-item") { const f = listStack[listStack.length - 1]; if (f) { f.counter++; const lv = styles.get(f.style)?.get(listStack.length); pendingLabel = lv && !lv.bullet ? `${lv.prefix}${formatNumber(f.counter + lv.start - 1, lv.fmt)}${lv.suffix}` : ""; } }
      else if (n === "text:p" || n === "text:h") { if (t.k === "open") { inP++; if (inP === 1) { para = ""; } } }
      else if (n === "text:tab") para += "\t";
      else if (n === "text:line-break") para += "\n";
      else if (n === "text:s") para += " ".repeat(Math.min(20, Number(attr(t.a, "text:c") ?? 1)));
      else if (n === "draw:page" && kind === "odp") { flush(); slide++; pageLabel = `Slayd ${slide}`; }
      else if (n === "draw:image") images++;
      else if (n === "table:table") { if (kind === "ods") { flush(); pageLabel = `Varaq «${decodeXml(attr(t.a, "table:name") ?? String(pages.length + 1))}»`; } tblDepth++; }
      else if (n === "table:table-row") { row = []; rowRepeat = Math.min(3, Number(attr(t.a, "table:number-rows-repeated") ?? 1)); rowHasText = false; }
      else if (n === "table:table-cell" || n === "table:covered-table-cell") { cell = ""; cellRepeat = Math.min(3, Number(attr(t.a, "table:number-columns-repeated") ?? 1)); inCell = t.k === "open"; if (t.k === "self") { row.push(...Array(cellRepeat).fill("")); } }
    } else {
      if (n === "text:p" || n === "text:h") {
        inP = Math.max(0, inP - 1);
        if (inP === 0) {
          const text = para.replace(/[ \t]+$/g, "");
          const lab = text.trim() && pendingLabel ? pendingLabel : ""; if (text.trim()) pendingLabel = "";
          const line = lab ? `${lab} ${text}` : text;
          if (tblDepth > 0 && inCell) { if (line.trim()) { cell += (cell ? " " : "") + line.trim(); rowHasText = true; } } else lines.push(line);
        }
      }
      else if (n === "text:list") listStack.pop();
      else if (n === "table:table-cell" || n === "table:covered-table-cell") { for (let i = 0; i < (cell ? 1 : cellRepeat); i++) row.push(cell.trim()); inCell = false; }
      else if (n === "table:table-row") {
        const filled = [...row];
        while (filled.length && !filled[filled.length - 1]) filled.pop();
        if (filled.length && rowHasText) for (let i = 0; i < Math.min(rowRepeat, 1); i++) lines.push(filled.join(" | "));
        if (lines.length > MAX_ROWS) break;
      }
      else if (n === "table:table") { tblDepth = Math.max(0, tblDepth - 1); if (kind === "ods") flush(); }
    }
  }
  flush();
  return { pages, images, note: images ? `Hujjatda ${images} ta rasm bor: rasmdagi matn matnga aylantirilmadi.` : pages.length ? undefined : "Hujjatdan matn topilmadi." };
}

// ---------- CSV / TXT ----------
export function parseCsv(text: string): string[][] {
  const delim = ((): string => { const first = text.split(/\r?\n/, 1)[0] ?? ""; const c = { ",": (first.match(/,/g) ?? []).length, ";": (first.match(/;/g) ?? []).length, "\t": (first.match(/\t/g) ?? []).length }; return Object.entries(c).sort((a, b) => b[1] - a[1])[0][0]; })();
  const rows: string[][] = [];
  let row: string[] = [], cur = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) { if (ch === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += ch; }
    else if (ch === '"') q = true;
    else if (ch === delim) { row.push(cur); cur = ""; }
    else if (ch === "\n" || ch === "\r") { if (ch === "\r" && text[i + 1] === "\n") i++; row.push(cur); cur = ""; if (row.some((c) => c.trim())) rows.push(row); row = []; if (rows.length >= MAX_ROWS) break; }
    else cur += ch;
  }
  if (cur || row.length) { row.push(cur); if (row.some((c) => c.trim())) rows.push(row); }
  return rows;
}

/** Fayl turiga qarab matn sahifalarini ajratadi. PDF va rasm bu yerda ishlanmaydi (null): ular multimodal AI orqali o'qiladi. */
export function extractOfficeText(kind: ImportKind, bytes: Uint8Array): ParsedDoc | null {
  if (kind === "txt") {
    const t = decodeText(bytes);
    if (t === null) return null;
    const pages = t.replace(/\r\n?/g, "\n").split("\f").map((p, i) => ({ label: `Sahifa ${i + 1}`, text: p.trim() })).filter((p) => p.text);
    return { pages, images: 0 };
  }
  if (kind === "csv") {
    const t = decodeText(bytes);
    if (t === null) return null;
    const text = parseCsv(t).map((r) => r.map((c) => c.trim()).join(" | ").replace(/(?: \| )+$/, "")).join("\n");
    return { pages: text ? [{ label: "Jadval", text }] : [], images: 0 };
  }
  if (kind === "docx" || kind === "xlsx" || kind === "pptx" || kind === "odt" || kind === "ods" || kind === "odp") {
    const z = openZip(bytes);
    if (!z) return null;
    if (kind === "docx") return extractDocx(z);
    if (kind === "xlsx") return extractXlsx(z);
    if (kind === "pptx") return extractPptx(z);
    return extractOdf(z, kind);
  }
  return null;
}
