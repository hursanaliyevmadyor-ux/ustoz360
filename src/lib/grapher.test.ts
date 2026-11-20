import { describe, expect, it } from "vitest";
import { BOARD_X, BOARD_Y, BoardStore, parseBoard } from "./board";
import { GX, GY, compile, graphMsgs, parseExpr, plot } from "./grapher";

const val = (src: string, x = 0) => { const f = compile(src); return f ? f(x) : null; };

describe("formula tahlili", () => {
  it("amallar tartibi va qavs", () => {
    expect(val("2+3*4")).toBe(14);
    expect(val("(2+3)*4")).toBe(20);
    expect(val("2^3^2")).toBe(512); // o'ngdan chapga
    expect(val("-2^2")).toBe(-4);
    expect(val("10/4")).toBe(2.5);
    expect(val("2-3-4")).toBe(-5);
    expect(val("x^2", 3)).toBe(9);
    expect(val("2x+1", 4)).toBe(9);
  });
  it("yashirin ko'paytirish va yozish usullari", () => {
    expect(val("3(x+1)", 2)).toBe(9);
    expect(val("x(x-1)", 3)).toBe(6);
    expect(val("2sin(x)", Math.PI / 2)).toBeCloseTo(2);
    expect(val("2pi")).toBeCloseTo(2 * Math.PI);
    expect(val("y = x^2 - 4", 1)).toBe(-3);
    expect(val("f(x)=x+1", 1)).toBe(2);
    expect(val("x²", 5)).toBe(25);
    expect(val("1,5*2")).toBe(3);
    expect(val("x**2", 4)).toBe(16);
    expect(val("sin x", 0)).toBe(0);
    expect(val("sinx", Math.PI / 2)).toBeCloseTo(1);
    expect(val("|x|", -3)).toBe(3);
  });
  it("funksiyalar va doimiylar", () => {
    expect(val("sqrt(16)")).toBe(4);
    expect(val("abs(-5)")).toBe(5);
    expect(val("ln(e)")).toBeCloseTo(1);
    expect(val("log(100)")).toBeCloseTo(2);
    expect(val("cos(0)")).toBe(1);
    expect(val("tg(0)")).toBe(0);
    expect(val("pi")).toBeCloseTo(Math.PI);
    expect(val("e^0")).toBe(1);
  });
  it("xavfli yoki noto'g'ri yozuv rad etiladi, kod bajarilmaydi", () => {
    for (const bad of ["", "   ", "alert(1)", "constructor", "x;y", "process.exit()", "x+", "(x", "x)", "2**", "import('x')", "x=y", "[1,2]", "{}", "`x`", "x".repeat(200), "((((((((((((((((((((((((((((((((((((((((((((x))))))))))))))))))))))))))))))))))))))))))))", "foo(x)", "window"]) {
      expect(parseExpr(bad), JSON.stringify(bad)).toBeNull();
    }
  });
  it("x'ning uzun ketma-ketligi va ko'p kichik had ham muammo bermaydi", () => {
    expect(compile("x+".repeat(50) + "x")).not.toBeNull();
    expect(parseExpr("x".repeat(100))).not.toBeNull(); // x*x*x... yashirin ko'paytirish
  });
});

describe("grafik chizish", () => {
  it("parabola: bitta uzluksiz chiziq, markazdan o'tadi", () => {
    const lines = plot(compile("x^2")!);
    expect(lines).toHaveLength(1);
    const near0 = lines[0]!.reduce((m, p) => (Math.abs(p[0]) < Math.abs(m[0]) ? p : m));
    expect(Math.abs(near0[1])).toBeLessThan(0.01);
  });
  it("1/x va tan(x) uzilish joyida bo'linadi", () => {
    expect(plot(compile("1/x")!).length).toBeGreaterThanOrEqual(2);
    expect(plot(compile("tan(x)")!).length).toBeGreaterThan(5);
  });
  it("sqrt(x) faqat x >= 0 uchun, ln(x) faqat x > 0 uchun", () => {
    for (const src of ["sqrt(x)", "ln(x)"]) for (const l of plot(compile(src)!)) for (const [x] of l) expect(x, src).toBeGreaterThanOrEqual(0);
  });
  it("juda katta qiymatlar sohadan tashqarida kesiladi", () => {
    for (const l of plot(compile("x^5")!)) for (const [, y] of l) expect(Math.abs(y)).toBeLessThanOrEqual(GY + 1);
    expect(plot(compile("5")!)).toHaveLength(1);
    expect(plot(compile("100")!)).toHaveLength(0);
  });
  it("doska xabarlari yaroqli, hamma nuqta doska ichida, markaz (0,0) o'rtada", () => {
    let n = 1;
    const msgs = graphMsgs("x^2/4", 3, 1, () => n++)!;
    expect(msgs.length).toBeGreaterThan(0);
    const b = new BoardStore();
    for (const m of msgs) { expect(parseBoard(JSON.parse(JSON.stringify(m)))).not.toBeNull(); b.apply(m); }
    const pts = b.strokes.flatMap((s) => s.p);
    for (let i = 0; i < pts.length; i += 2) { expect(pts[i]).toBeGreaterThanOrEqual(0); expect(pts[i]).toBeLessThanOrEqual(BOARD_X); expect(pts[i + 1]).toBeLessThanOrEqual(BOARD_Y); }
    // eng pastki nuqta (x=0, y=0) markazda
    const lowest = b.strokes[0]!.p.reduce((best, _, i, a) => (i % 2 === 1 && a[i]! > a[best]! ? i : best), 1);
    expect(Math.abs(b.strokes[0]!.p[lowest - 1]! - BOARD_X / 2)).toBeLessThan(BOARD_X * 0.02);
    expect(Math.abs(b.strokes[0]!.p[lowest]! - BOARD_Y / 2)).toBeLessThan(BOARD_Y * 0.02);
    expect(GX * 2 / GY / 2).toBeCloseTo(16 / 9); // masshtab 16:9
  });
  it("yaroqsiz formula null, bo'sh grafik bo'sh ro'yxat", () => {
    expect(graphMsgs("alert(1)", 0, 1, () => 1)).toBeNull();
    expect(graphMsgs("100", 0, 1, () => 1)).toEqual([]);
  });
});
