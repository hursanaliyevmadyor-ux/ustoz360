import { describe, expect, it } from "vitest";
import { bar, cbOk, clip, dayLabel, esc, fmtDate, fmtWhen, parseDate, parseScores, personName, safeUrl, splitAliases, splitText } from "./botlogic";

describe("matn yordamchilari", () => {
  it("esc: HTML belgilarini xavfsiz qiladi (AI va foydalanuvchi matni uchun)", () => {
    expect(esc("<b>5 & 3</b>")).toBe("&lt;b&gt;5 &amp; 3&lt;/b&gt;");
    expect(esc(null)).toBe("");
    expect(esc(12)).toBe("12");
  });
  it("clip: qisqa matnni o'zgartirmaydi, uzunini so'z chegarasida kesadi", () => {
    expect(clip("Salom dunyo", 30)).toBe("Salom dunyo");
    const c = clip("birinchi ikkinchi uchinchi to'rtinchi beshinchi", 25);
    expect(c.length).toBeLessThanOrEqual(25);
    expect(c.endsWith("…")).toBe(true);
    expect(c).not.toMatch(/\s…$/);
    expect(clip("a\n\n b", 10)).toBe("a b");
  });
  it("sana ko'rinishlari", () => {
    expect(fmtDate("2026-11-05")).toBe("05.11.2026");
    expect(fmtDate("2026-11-05T10:00:00.000Z")).toBe("05.11.2026");
    expect(dayLabel("2026-11-05")).toBe("5-noyabr, payshanba");
    // 2026-11-05T22:00Z Toshkentda 6-noyabr 03:00
    expect(fmtWhen("2026-11-05T22:00:00.000Z")).toBe("6-noyabr, juma, 03:00");
    expect(fmtWhen(new Date("2026-11-05T09:30:00Z"))).toBe("5-noyabr, payshanba, 14:30");
    expect(fmtWhen("nomalum")).toBe("");
  });
  it("bar: foizni chiziqqa aylantiradi va chegaradan chiqmaydi", () => {
    expect(bar(0)).toBe("░░░░░░░░░░");
    expect(bar(70)).toBe("▓▓▓▓▓▓▓░░░");
    expect(bar(100)).toBe("▓▓▓▓▓▓▓▓▓▓");
    expect(bar(250)).toHaveLength(10);
    expect(bar(-5)).toBe("░░░░░░░░░░");
  });
  it("splitText: 4096 chegarasidan oshmaydi, ma'no bo'lagi bo'yicha bo'linadi va hech narsa yo'qolmaydi", () => {
    const para = "Gap. ".repeat(300).trim();
    const text = [para, para, para].join("\n\n");
    const parts = splitText(text, 1600);
    expect(parts.length).toBeGreaterThan(1);
    for (const p of parts) expect(p.length).toBeLessThanOrEqual(1600);
    expect(parts.join(" ").replace(/\s+/g, " ")).toBe(text.replace(/\s+/g, " "));
    expect(splitText("qisqa")).toEqual(["qisqa"]);
    expect(splitText("x".repeat(5000), 2000).every((p) => p.length <= 2000)).toBe(true);
  });
  it("safeUrl faqat http(s) havolasini o'tkazadi", () => {
    expect(safeUrl("https://example.com/a")).toBe("https://example.com/a");
    expect(safeUrl("javascript:alert(1)")).toBeNull();
    expect(safeUrl("tg://resolve?domain=x")).toBeNull();
    expect(safeUrl(null)).toBeNull();
    expect(safeUrl("https://a b")).toBeNull();
  });
  it("cbOk: callback_data 64 bayt chegarasi", () => {
    expect(cbOk("s.sq." + "a".repeat(25) + "." + "b".repeat(25))).toBe(true);
    expect(cbOk("x".repeat(65))).toBe(false);
  });
});

describe("parseDate", () => {
  const today = "2026-11-05";
  it("so'zlar va turli formatlar", () => {
    expect(parseDate("bugun", today)).toBe("2026-11-05");
    expect(parseDate(" Ertaga ", today)).toBe("2026-11-06");
    expect(parseDate("indinga", today)).toBe("2026-11-07");
    expect(parseDate("2027-03-15", today)).toBe("2027-03-15");
    expect(parseDate("15.03.2027", today)).toBe("2027-03-15");
    expect(parseDate("5.3.27", today)).toBe("2027-03-05");
    expect(parseDate("15/03/2027", today)).toBe("2027-03-15");
    expect(parseDate("15-03-2027", today)).toBe("2027-03-15");
  });
  it("mavjud bo'lmagan yoki tushunarsiz sana rad etiladi", () => {
    expect(parseDate("31.02.2027", today)).toBeNull();
    expect(parseDate("32.01.2027", today)).toBeNull();
    expect(parseDate("keyinroq", today)).toBeNull();
    expect(parseDate("", today)).toBeNull();
    expect(parseDate("2027-13-01", today)).toBeNull();
  });
});

describe("parseScores", () => {
  const pupils = [{ id: "a", alias: "Oybek" }, { id: "b", alias: "O-2" }, { id: "c", alias: "Madina" }];
  it("tartib raqami, taxallus va ajratuvchilar", () => {
    const r = parseScores("1 18\nO-2: 15,5\nmadina=20", pupils, 20);
    expect(r.scores).toEqual({ a: 18, b: 15.5, c: 20 });
    expect(r.bad).toEqual([]);
  });
  it("faqat raqamli qatorlar soni o'quvchilar soniga teng bo'lsa, tartib bilan taqsimlanadi", () => {
    expect(parseScores("10\n12\n7", pupils, 20).scores).toEqual({ a: 10, b: 12, c: 7 });
    // Soni mos kelmasa, tartib bo'yicha taxmin qilinmaydi
    const r = parseScores("10\n12", pupils, 20);
    expect(r.scores).toEqual({});
    expect(r.bad).toEqual(["10", "12"]);
  });
  it("eng yuqori balldan oshgan, noma'lum o'quvchi va buzuq qatorlar xato sifatida qaytadi", () => {
    const r = parseScores("1 25\n7 10\nOybek\nAziz 5\n2 -1\n3 19", pupils, 20);
    expect(r.scores).toEqual({ c: 19 });
    expect(r.bad).toHaveLength(5);
  });
  it("taxallusning boshlanishi bitta o'quvchiga mos kelsa qabul qilinadi, ikkiga mos kelsa yo'q", () => {
    expect(parseScores("Oy 10", pupils, 20).scores).toEqual({ a: 10 });
    expect(parseScores("O 10", pupils, 20).scores).toEqual({});
  });
  it("nuqta bilan raqamlangan qator", () => {
    expect(parseScores("1. 17", pupils, 20).scores).toEqual({ a: 17 });
  });
});

describe("personName", () => {
  it("ism-familiya: ikki so'z, harflar va ' - .", () => {
    expect(personName("Aziza Karimova")).toBe("Aziza Karimova");
    expect(personName("  Gulnora   O'ralova ")).toBe("Gulnora O'ralova");
    expect(personName("Aziza-Mohira Karimova")).toBe("Aziza-Mohira Karimova");
    expect(personName("Ўткир Ҳамидов")).toBe("Ўткир Ҳамидов");
  });
  it("menyu tugmasi, emoji, raqam, bitta so'z va juda uzun matn rad etiladi", () => {
    expect(personName("📚 Testlar")).toBeNull();
    expect(personName("Aziza")).toBeNull();
    expect(personName("Ali 123")).toBeNull();
    expect(personName("@aziza karimova")).toBeNull();
    expect(personName("a ".repeat(60))).toBeNull();
    expect(personName("")).toBeNull();
  });
});

describe("splitAliases", () => {
  it("vergul, nuqtali vergul va qator bilan ajratadi, takrorlarni olib tashlaydi", () => {
    expect(splitAliases("O-1, O-2;\nOybek,, O-1 ")).toEqual(["O-1", "O-2", "Oybek"]);
    expect(splitAliases("   ")).toEqual([]);
  });
});
