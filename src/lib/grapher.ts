import { BOARD_X, BOARD_Y, KIND, BoardStore, type BoardMsg, type Stroke } from "./board";

/**
 * Grafik chizish: o'qituvchi formula yozadi (x^2, sin(x), 2x+1, 1/x), grafik koordinata tekisligiga chiziladi.
 * Formula xavfsiz tahlilchi bilan o'qiladi (eval yo'q): faqat sonlar, x, π, e, amallar va ro'yxatdagi funksiyalar.
 * Masshtab: 1 birlik = 1 katak ("Koordinata" fonidagi katak bilan mos), x: -16..16, y: -9..9.
 */
export const GX = 16;
export const GY = 9;
const MAX_LEN = 120;

type Fn = (x: number) => number;
const FUNCS: Record<string, (v: number) => number> = {
  sin: Math.sin, cos: Math.cos, tan: Math.tan, asin: Math.asin, acos: Math.acos, atan: Math.atan, sqrt: Math.sqrt, abs: Math.abs,
  ln: Math.log, log: Math.log10, lg: Math.log10, exp: Math.exp, floor: Math.floor, ceil: Math.ceil, round: Math.round, sign: Math.sign, cbrt: Math.cbrt,
  sh: Math.sinh, ch: Math.cosh, tg: Math.tan, ctg: (v) => 1 / Math.tan(v), arctg: Math.atan, sinh: Math.sinh, cosh: Math.cosh, tanh: Math.tanh,
};
const CONSTS: Record<string, number> = { pi: Math.PI, "π": Math.PI, e: Math.E };

type Node = { t: "num"; v: number } | { t: "x" } | { t: "neg"; a: Node } | { t: "bin"; op: "+" | "-" | "*" | "/" | "^"; a: Node; b: Node } | { t: "fn"; f: string; a: Node };

/** Formulani daraxtga aylantiradi; xato bo'lsa null. */
export function parseExpr(src: string): Node | null {
  if (typeof src !== "string") return null;
  const s = src.toLowerCase().replace(/\s+/g, "").replace(/,/g, ".").replace(/\*\*/g, "^").replace(/×/g, "*").replace(/÷/g, "/").replace(/[−–]/g, "-").replace(/²/g, "^2").replace(/³/g, "^3");
  const body = s.replace(/^y=/, "").replace(/^f\(x\)=/, "");
  if (!body || body.length > MAX_LEN) return null;
  let i = 0, depth = 0, nodes = 0;
  const peek = () => body[i] ?? "";
  const fail = () => { throw new Error("x"); };
  const startsAtom = () => /[0-9.xπ(]/.test(peek()) || /[a-z]/.test(peek());
  function atom(): Node {
    if (++nodes > 400 || ++depth > 40) fail();
    const c = peek();
    let r: Node;
    if (c === "(") { i++; r = expr(); if (peek() !== ")") fail(); i++; }
    else if (c === "|") { i++; const a = expr(); if (peek() !== "|") fail(); i++; r = { t: "fn", f: "abs", a }; }
    else if (/[0-9.]/.test(c)) {
      const m = /^[0-9]*\.?[0-9]+(e[+-]?[0-9]+)?|^[0-9]+\.?/.exec(body.slice(i));
      if (!m) fail();
      i += m![0].length; r = { t: "num", v: parseFloat(m![0]) };
      if (!Number.isFinite((r as { v: number }).v)) fail();
    } else if (c === "π") { i++; r = { t: "num", v: Math.PI }; }
    else if (/[a-z]/.test(c)) {
      const m = /^[a-z]+/.exec(body.slice(i))![0];
      if (m === "x") { i++; r = { t: "x" }; }
      else if (Object.prototype.hasOwnProperty.call(CONSTS, m)) { i += m.length; r = { t: "num", v: CONSTS[m]! }; }
      else {
        // yopishgan yozuv: "sinx", "2xsin": eng uzun funksiya nomini topamiz
        const f = Object.keys(FUNCS).filter((k) => body.startsWith(k, i)).sort((a, b) => b.length - a.length)[0];
        if (!f) {
          // "xx" yoki "xpi" kabi: bitta harf (x, e) deb o'qiymiz
          if (body[i] === "x") { i++; r = { t: "x" }; } else if (body[i] === "e") { i++; r = { t: "num", v: Math.E }; } else fail();
          r = r! ;
        } else {
          i += f.length;
          if (peek() === "(") { i++; const a = expr(); if (peek() !== ")") fail(); i++; r = { t: "fn", f, a }; }
          else r = { t: "fn", f, a: power() }; // sin x, sinx, sin2x
        }
      }
    } else fail();
    depth--;
    return r!;
  }
  function power(): Node {
    const base = atom();
    if (peek() === "^") { i++; const e = unary(); return { t: "bin", op: "^", a: base, b: e }; }
    return base;
  }
  function unary(): Node {
    if (peek() === "-") { i++; return { t: "neg", a: unary() }; }
    if (peek() === "+") { i++; return unary(); }
    return power();
  }
  function term(): Node {
    let a = unary();
    for (;;) {
      const c = peek();
      if (c === "*" || c === "/") { i++; a = { t: "bin", op: c, a, b: unary() }; }
      else if (c && c !== ")" && c !== "+" && c !== "-" && c !== "|" && c !== "^" && startsAtom()) a = { t: "bin", op: "*", a, b: unary() }; // yashirin ko'paytirish: 2x, 3(x+1)
      else return a;
    }
  }
  function expr(): Node {
    let a = term();
    while (peek() === "+" || peek() === "-") { const op = peek() as "+" | "-"; i++; a = { t: "bin", op, a, b: term() }; }
    return a;
  }
  try {
    const n = expr();
    return i === body.length ? n : null;
  } catch {
    return null;
  }
}

function evalNode(n: Node, x: number): number {
  switch (n.t) {
    case "num": return n.v;
    case "x": return x;
    case "neg": return -evalNode(n.a, x);
    case "fn": return FUNCS[n.f]!(evalNode(n.a, x));
    case "bin": {
      const a = evalNode(n.a, x), b = evalNode(n.b, x);
      return n.op === "+" ? a + b : n.op === "-" ? a - b : n.op === "*" ? a * b : n.op === "/" ? a / b : Math.pow(a, b);
    }
  }
}

/** Formulani funksiyaga aylantiradi (xato bo'lsa null). */
export function compile(src: string): Fn | null {
  const n = parseExpr(src);
  return n ? (x) => evalNode(n, x) : null;
}

/** Grafik nuqtalari: uzilish joylarida (tan, 1/x), sohadan tashqarida va aniqlanmagan joylarda bir nechta alohida chiziqqa bo'linadi. Matematik koordinatada. */
export function plot(f: Fn, steps = 800): [number, number][][] {
  const out: [number, number][][] = [];
  let cur: [number, number][] = [];
  let prev: number | null = null;
  const flush = () => { if (cur.length > 1) out.push(cur); cur = []; prev = null; };
  for (let i = 0; i <= steps; i++) {
    const x = -GX + (2 * GX * i) / steps;
    const y = f(x);
    if (!Number.isFinite(y) || Math.abs(y) > GY * 3) { flush(); continue; }
    if (prev !== null && Math.abs(y - prev) > GY * 1.6) flush(); // keskin sakrash: uzilish
    if (y < -GY - 1 || y > GY + 1) { if (cur.length) { cur.push([x, Math.max(-GY - 1, Math.min(GY + 1, y))]); flush(); } else prev = null; continue; }
    cur.push([x, y]); prev = y;
  }
  flush();
  return out;
}

/** Matematik nuqtani doska birligiga o'tkazadi. */
const toBoard = (x: number, y: number): [number, number] => [Math.round(((x + GX) / (2 * GX)) * BOARD_X), Math.round(((GY - y) / (2 * GY)) * BOARD_Y)].map((v, k) => Math.max(0, Math.min(k ? BOARD_Y : BOARD_X, v))) as [number, number];

/** Formuladan doskaga chiziladigan xabarlar. Yaroqsiz formula bo'lsa null. `next` har bir chiziq uchun yangi raqam beradi. */
export function graphMsgs(src: string, c: number, w: number, next: () => number): BoardMsg[] | null {
  const f = compile(src);
  if (!f) return null;
  const lines = plot(f);
  if (lines.length === 0) return [];
  const msgs: BoardMsg[] = [];
  for (const line of lines) {
    const p: number[] = [];
    // juda zich nuqtalar kerak emas: har bir 2-nuqta
    line.forEach(([x, y], i) => { if (i % 2 === 0 || i === line.length - 1) p.push(...toBoard(x, y)); });
    const s: Stroke = { id: next(), k: KIND.pen, c, w, p };
    msgs.push(...BoardStore.strokeMsgs(s));
  }
  return msgs;
}
