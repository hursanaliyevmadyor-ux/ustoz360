/**
 * Oddiy arifmetik savollarni deterministik hisoblash (AI'siz). eval ishlatilmaydi: qo'lda yozilgan xavfsiz hisoblagich.
 * Faqat savol matni asosan ifodadan iborat bo'lganda ishlaydi («12*8+4 = ?», «Hisoblang: (15-3)/4»). Murakkab masalalar AI'ga qoladi.
 * Natija «tasdiqlangan» emas, faqat taxmin: foydalanuvchi ko'radi va qabul qiladi.
 */
type Tok = { t: "num"; v: number } | { t: "op"; v: string };

function tokenize(src: string): Tok[] | null {
  const s = src.replace(/[×·⋅x]/g, "*").replace(/[÷:]/g, "/").replace(/[−–—]/g, "-").replace(/\s+/g, "");
  const out: Tok[] = [];
  for (let i = 0; i < s.length;) {
    const ch = s[i];
    if (/[0-9.,]/.test(ch)) {
      let j = i; while (j < s.length && /[0-9.,]/.test(s[j])) j++;
      const raw = s.slice(i, j);
      const norm = /^\d{1,3}(,\d{3})+(\.\d+)?$/.test(raw) ? raw.replace(/,/g, "") : raw.replace(",", ".");
      const v = Number(norm);
      if (!Number.isFinite(v) || (norm.match(/\./g)?.length ?? 0) > 1) return null;
      out.push({ t: "num", v }); i = j;
    } else if ("+-*/^()%".includes(ch)) { out.push({ t: "op", v: ch }); i++; }
    else return null;
  }
  return out;
}

/** Ifodani hisoblaydi: + - * / ^ ( ) va foiz (50% = 0.5). Noto'g'ri ifoda yoki nolga bo'lish: null. */
export function evalArithmetic(expr: string): number | null {
  const toks = tokenize(expr);
  if (!toks || !toks.length || toks.length > 80) return null;
  let p = 0;
  const peek = () => toks[p];
  const isOp = (v: string) => { const t = peek(); return !!t && t.t === "op" && t.v === v; };
  let fail = false;
  const primary = (): number => {
    const t = toks[p];
    if (!t) { fail = true; return 0; }
    if (t.t === "num") { p++; let v = t.v; if (isOp("%")) { p++; v /= 100; } return v; }
    if (t.v === "(") { p++; const v = add(); if (isOp(")")) p++; else fail = true; return v; }
    if (t.v === "-") { p++; return -power(); }
    if (t.v === "+") { p++; return power(); }
    fail = true; return 0;
  };
  const power = (): number => { const b = primary(); if (isOp("^")) { p++; const e = power(); const r = Math.pow(b, e); if (!Number.isFinite(r) || Math.abs(e) > 64) fail = true; return r; } return b; };
  const mul = (): number => { let v = power(); while (isOp("*") || isOp("/")) { const op = (toks[p] as { v: string }).v; p++; const r = power(); if (op === "*") v *= r; else { if (r === 0) { fail = true; return 0; } v /= r; } } return v; };
  const add = (): number => { let v = mul(); while (isOp("+") || isOp("-")) { const op = (toks[p] as { v: string }).v; p++; const r = mul(); v = op === "+" ? v + r : v - r; } return v; };
  const v = add();
  if (fail || p !== toks.length || !Number.isFinite(v)) return null;
  return Math.round(v * 1e9) / 1e9;
}

const NUM_LIKE = /^[-+]?\s*\d[\d\s]*(?:[.,]\d+)?\s*%?$/;

/** Variant matnini songa aylantiradi («1 250», «3,5», «-4», «50%»). Raqam bo'lmasa null. */
export function optionNumber(text: string): number | null {
  const t = text.trim().replace(/\s*(?:ga teng|sm|m|kg|so['’ʻ‘`]?m|ta|dona)\.?$/i, "").trim();
  if (!NUM_LIKE.test(t)) return null;
  const pct = t.endsWith("%");
  const n = Number(t.replace(/[%\s]/g, "").replace(",", "."));
  return Number.isFinite(n) ? (pct ? n / 100 : n) : null;
}

/** Savol matnidan arifmetik ifodani ajratadi: faqat matnning asosiy qismi ifoda bo'lsa. */
export function findExpression(question: string): string | null {
  const q = question.replace(/\s+/g, " ").trim();
  const m = /(?:hisoblang|hisobla|toping|natijasi|qiymati|nimaga teng|чему равно|вычислите|найдите значение|calculate|evaluate)?[:\s]*([-+(]?\s*\d[\d\s.,+\-−–—*/×÷^()%:x·]*[\d)%])\s*(?:=\s*\??)?\s*\??\s*$/i.exec(q);
  if (!m) return null;
  const expr = m[1].trim();
  if (!/[+\-*/×÷^−–—·x:]/.test(expr.slice(1)) && !expr.includes("(")) return null; // oddiy raqam: hisob emas
  const prefix = q.slice(0, q.length - m[0].length).replace(/[^\p{L}]/gu, "");
  return prefix.length <= 40 ? expr : null;
}

export type MathCheck = { expression: string; value: number; match: number[] };

/** Variantlar orasida natijaga teng bo'lganini topadi. null: ifoda yo'q yoki hisoblab bo'lmadi. */
export function checkArithmetic(question: string, options: { label: string; text: string }[]): MathCheck | null {
  const expression = findExpression(question);
  if (!expression) return null;
  const value = evalArithmetic(expression);
  if (value === null) return null;
  const match: number[] = [];
  options.forEach((o, i) => { const n = optionNumber(o.text); if (n !== null && Math.abs(n - value) < 1e-9 * Math.max(1, Math.abs(value))) match.push(i); });
  return { expression, value, match };
}
