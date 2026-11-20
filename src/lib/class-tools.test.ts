import { describe, expect, it } from "vitest";
import { attendanceCsv, attendanceText, cleanUrl, emptyClass, fmtTimer, makePoll, parseAct, parseClass, pickRandom, pollCounts, type Seen } from "./class-tools";

describe("cleanUrl", () => {
  it("to'g'ri havolalar", () => {
    expect(cleanUrl("https://youtube.com/watch?v=abc")).toBe("https://youtube.com/watch?v=abc");
    expect(cleanUrl("  example.uz/dars  ")).toBe("https://example.uz/dars");
    expect(cleanUrl("http://a.uz")).toBe("http://a.uz/");
  });
  it("xavfli yoki yaroqsiz havolalar rad etiladi", () => {
    for (const bad of ["javascript:alert(1)", "data:text/html,<b>x</b>", "ftp://a.uz/x", "file:///etc/passwd", "https://user:pass@a.uz", "https://localhost", "salom", "", "a b.uz", "https://" + "a".repeat(400) + ".uz", 5, null, undefined]) expect(cleanUrl(bad), String(bad)).toBeNull();
  });
});

describe("makePoll", () => {
  it("savol va variantlarni tozalaydi", () => {
    const p = makePoll(1, "  2+2=?  ", ["3", " 4 ", "5"], 1)!;
    expect(p).toMatchObject({ id: 1, q: "2+2=?", opts: ["3", "4", "5"], open: true, show: false, correct: 1, counts: null });
  });
  it("bo'sh variantlar olib tashlanadi, to'g'ri javob o'z variantida qoladi", () => {
    const p = makePoll(1, "Q", ["", "A", "", "B", "C"], 3)!;
    expect(p.opts).toEqual(["A", "B", "C"]);
    expect(p.correct).toBe(1);
    expect(makePoll(1, "Q", ["A", "B", ""], 2)!.correct).toBeNull(); // to'g'ri javob bo'sh variant edi
    expect(makePoll(1, "Q", ["A", "B"], null)!.correct).toBeNull();
  });
  it("yaroqsizlari: savolsiz, 2 tadan kam yoki 5 tadan ko'p variant", () => {
    expect(makePoll(1, "  ", ["A", "B"], null)).toBeNull();
    expect(makePoll(1, "Q", ["A"], null)).toBeNull();
    expect(makePoll(1, "Q", ["A", " "], null)).toBeNull();
    expect(makePoll(1, "Q", ["A", "B", "C", "D", "E", "F"], null)).toBeNull();
    expect(makePoll(1, "Q", ["A", "B", "C", "D", "E"], 4)).not.toBeNull();
  });
  it("uzun matn qisqartiriladi", () => {
    const p = makePoll(1, "q".repeat(500), ["o".repeat(300), "b"], null)!;
    expect(p.q.length).toBe(200); expect(p.opts[0]!.length).toBe(80);
  });
});

describe("pollCounts", () => {
  it("oxirgi ovoz sanaladi, xonadan chiqqanlar sanalmaydi", () => {
    const votes = new Map([["a", 0], ["b", 1], ["c", 1], ["d", 2]]);
    expect(pollCounts(3, votes)).toEqual([1, 2, 1]);
    expect(pollCounts(3, votes, new Set(["a", "b"]))).toEqual([1, 1, 0]);
    expect(pollCounts(2, new Map([["a", 5], ["b", -1]]))).toEqual([0, 0]);
  });
});

describe("parseClass", () => {
  const good = { lock: true, stage: "board", note: "Vazifa: 12-bet", bg: "grid", draw: ["o-1", "o-2"], timer: { left: 60, total: 120 }, pick: { id: 3, name: "Ali", who: "o-1" }, mats: [{ id: 1, title: "Video", url: "https://youtu.be/x.y" }],
    poll: { id: 2, q: "Q?", opts: ["A", "B"], open: true, show: false, correct: 1, counts: null }, pulse: { id: 4 } };
  it("to'g'ri holat o'zgarmasdan o'tadi", () => {
    expect(parseClass(JSON.parse(JSON.stringify(good)))).toEqual({ ...good, mats: [{ id: 1, title: "Video", url: "https://youtu.be/x.y" }] });
  });
  it("buzilgan qismlari tashlanadi, hech qachon xato tashlamaydi", () => {
    for (const bad of [null, 5, "x", [], undefined]) expect(parseClass(bad)).toBeNull();
    expect(parseClass({})).toEqual(emptyClass());
    const c = parseClass({ ...good, stage: "x", timer: { left: -1, total: 5 }, pick: { id: "a", name: "A", who: "o-2" }, poll: { id: 1, q: "", opts: ["A", "B"] }, pulse: { id: "x" }, mats: [{ id: 1, title: "x", url: "javascript:alert(1)" }, 5, null] })!;
    expect(c.stage).toBe("auto"); expect(c.timer).toBeNull(); expect(c.pick).toBeNull(); expect(c.poll).toBeNull(); expect(c.pulse).toBeNull(); expect(c.mats).toEqual([]);
  });
  it("e'lon: tozalanadi va uzunligi cheklanadi", () => {
    expect(parseClass({ note: "  Muhim:   test\nertaga  " })!.note).toBe("Muhim: test ertaga");
    expect(parseClass({ note: "x".repeat(500) })!.note).toHaveLength(160);
    expect(parseClass({ note: 5 })!.note).toBe("");
    expect(emptyClass().note).toBe("");
  });
  it("doska foni va doskaga chaqirilganlar", () => {
    expect(parseClass({ bg: "axes" })!.bg).toBe("axes");
    expect(parseClass({ bg: "x" })!.bg).toBe("plain");
    expect(parseClass({ bg: 5 })!.bg).toBe("plain");
    expect(parseClass({ draw: ["a", "a", "", "b", 5, "c", "d", "e", "f"] })!.draw).toEqual(["a", "b", "c", "d"]); // takror, bo'sh va son emaslari yo'q, 4 tagacha
    expect(parseClass({ draw: "a" })!.draw).toEqual([]);
  });
  it("materiallar soni cheklangan, sarlavhasiz material havolani sarlavha qiladi", () => {
    const mats = Array.from({ length: 25 }, (_, i) => ({ id: i, title: "", url: `https://a.uz/${i}` }));
    const c = parseClass({ mats })!;
    expect(c.mats).toHaveLength(10);
    expect(c.mats[0]!.title).toBe("https://a.uz/0");
  });
  it("so'rovnomada noto'g'ri sonlar rad etiladi", () => {
    const base = { id: 1, q: "Q", opts: ["A", "B"] };
    expect(parseClass({ poll: { ...base, correct: 5 } })!.poll!.correct).toBeNull();
    expect(parseClass({ poll: { ...base, counts: [1] } })!.poll!.counts).toBeNull();
    expect(parseClass({ poll: { ...base, counts: [1, 2] } })!.poll!.counts).toEqual([1, 2]);
    expect(parseClass({ poll: { ...base, opts: ["A"] } })!.poll).toBeNull();
    expect(parseClass({ poll: { ...base, opts: ["A", ""] } })!.poll).toBeNull();
  });
});

describe("parseAct", () => {
  it("ovoz va 'tushundimmi' javoblari", () => {
    expect(parseAct({ t: "vote", poll: 2, o: 1 })).toEqual({ t: "vote", poll: 2, o: 1 });
    expect(parseAct({ t: "pulse", id: 1, v: 2 })).toEqual({ t: "pulse", id: 1, v: 2 });
    for (const bad of [null, {}, { t: "vote" }, { t: "vote", poll: 1, o: 9 }, { t: "vote", poll: "1", o: 0 }, { t: "pulse", id: 1, v: 3 }, { t: "x" }, { t: "vote", poll: 1, o: -1 }]) expect(parseAct(bad)).toBeNull();
  });
});

describe("pickRandom", () => {
  const people = ["a", "b", "c"].map((identity) => ({ identity }));
  it("avval tanlanmaganlardan tanlaydi, hamma tugagach qayta boshlaydi", () => {
    expect(pickRandom([], new Set(), () => 0.5)).toBeNull();
    expect(pickRandom(people, new Set(["a", "b"]), () => 0)).toEqual({ pick: { identity: "c" }, reset: false });
    expect(pickRandom(people, new Set(["a", "b", "c"]), () => 0.99)).toEqual({ pick: { identity: "c" }, reset: true });
  });
  it("tasodifiy son chegarasida ham xato bermaydi", () => {
    expect(pickRandom(people, new Set(), () => 1)!.pick.identity).toBe("c");
    expect(pickRandom(people, new Set(), () => 0)!.pick.identity).toBe("a");
  });
  it("hamma tanlanmagunicha takrorlanmaydi", () => {
    const done = new Set<string>(); const got: string[] = [];
    for (let i = 0; i < 3; i++) { const r = pickRandom(people, done, Math.random)!; got.push(r.pick.identity); done.add(r.pick.identity); }
    expect(new Set(got).size).toBe(3);
  });
});

describe("taymer va davomat", () => {
  it("taymer matni", () => { expect(fmtTimer(0)).toBe("00:00"); expect(fmtTimer(65)).toBe("01:05"); expect(fmtTimer(59.2)).toBe("01:00"); expect(fmtTimer(-3)).toBe("00:00"); });
  const rows: Seen[] = [
    { identity: "1", name: "Ali", first: new Date(2026, 10, 20, 15, 2).getTime(), last: null },
    { identity: "2", name: "=HYPERLINK(\"x\")", first: new Date(2026, 10, 20, 15, 5).getTime(), last: new Date(2026, 10, 20, 15, 40).getTime() },
    { identity: "3", name: "Vali, 5-sinf", first: new Date(2026, 10, 20, 15, 6).getTime(), last: null },
  ];
  it("davomat matni Telegramga yuborishga tayyor", () => {
    const t = attendanceText("Informatika", rows, new Date(2026, 10, 20, 16, 0).getTime());
    expect(t).toContain("Davomat: Informatika");
    expect(t).toContain("20.11.2026");
    expect(t).toContain("Qatnashdi: 3");
    expect(t).toContain("1. Ali: kirdi 15:02");
    expect(t).toContain("chiqdi 15:40");
  });
  it("CSV: vergulli ism qo'shtirnoqda, formula bilan boshlangan ism zararsizlantiriladi", () => {
    const csv = attendanceCsv(rows).split("\n");
    expect(csv[0]).toBe("№,Ism,Kirdi,Chiqdi");
    expect(csv[1]).toBe("1,Ali,15:02,xonada");
    expect(csv[2]!.startsWith("2,\"'=HYPERLINK(\"\"x\"\")\"")).toBe(true);
    expect(csv[3]).toBe('3,"Vali, 5-sinf",15:06,xonada');
  });
});
