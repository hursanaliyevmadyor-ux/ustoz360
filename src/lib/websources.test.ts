import { describe, expect, it } from "vitest";
import { encodeSources, httpsUrl, splitSources, sourcesPlain, SOURCES_MARK } from "./websources";

describe("javob manbalari", () => {
  it("manbalar va qidiruv so'zlari javobga qo'shiladi va qaytarib ajratiladi", () => {
    const enc = encodeSources("Javob matni.", [{ title: "Lex.uz | Qonun", url: "https://lex.uz/docs/1" }, { title: "edu.uz", url: "https://edu.uz/a" }], ["attestatsiya 2026"]);
    expect(enc.startsWith("Javob matni." + SOURCES_MARK)).toBe(true);
    const r = splitSources(enc);
    expect(r.text).toBe("Javob matni.");
    expect(r.sources).toEqual([{ title: "Lex.uz Qonun", url: "https://lex.uz/docs/1" }, { title: "edu.uz", url: "https://edu.uz/a" }]);
    expect(r.queries).toEqual(["attestatsiya 2026"]);
  });

  it("manbasiz javob o'zgarmaydi", () => {
    expect(encodeSources("Oddiy javob", [])).toBe("Oddiy javob");
    expect(splitSources("Oddiy javob")).toEqual({ text: "Oddiy javob", sources: [], queries: [] });
  });

  it("faqat https havola o'tadi (javascript:, http:, data: tashlanadi)", () => {
    const enc = encodeSources("x", [{ title: "a", url: "javascript:alert(1)" }, { title: "b", url: "http://insecure.uz" }, { title: "c", url: "data:text/html,x" }, { title: "d", url: "https://ok.uz/p?a=1" }]);
    expect(splitSources(enc).sources).toEqual([{ title: "d", url: "https://ok.uz/p?a=1" }]);
    expect(httpsUrl("https://a b")).toBeNull();
    expect(httpsUrl(42)).toBeNull();
  });

  it("chat tarixidan o'qilganda buzilgan yoki yaroqsiz qatorlar tashlanadi", () => {
    const content = `Matn${SOURCES_MARK}S|Yaxshi|https://a.uz\nS|Yomon|ftp://b.uz\nbuzuq qator\nQ|\nQ|so'z`;
    const r = splitSources(content);
    expect(r.sources).toEqual([{ title: "Yaxshi", url: "https://a.uz" }]);
    expect(r.queries).toEqual(["so'z"]);
  });

  it("ishonchlilik belgisi saqlanadi va qaytadan o'qiladi; noma'lum belgi tashlanadi; eski (belgisiz) yozuv ishlaydi", () => {
    const enc = encodeSources("x", [{ title: "a", url: "https://lex.uz/1", trust: "official" }, { title: "b", url: "https://b.uz", trust: "yolg'on" }, { title: "c", url: "https://c.uz" }]);
    expect(splitSources(enc).sources).toEqual([{ title: "a", url: "https://lex.uz/1", trust: "official" }, { title: "b", url: "https://b.uz" }, { title: "c", url: "https://c.uz" }]);
    expect(splitSources(`m${SOURCES_MARK}S|Eski|https://old.uz`).sources).toEqual([{ title: "Eski", url: "https://old.uz" }]);
  });

  it("oddiy matnli manbalar ro'yxati (bot uchun)", () => {
    expect(sourcesPlain([{ title: "Qonun", url: "https://lex.uz/1", trust: "official" }, { title: "Zararli", url: "javascript:x" }])).toBe("Manbalar:\n1. Qonun (Rasmiy manba)\n   https://lex.uz/1");
    expect(sourcesPlain([])).toBe("");
  });

  it("ko'p manba 8 tagacha, nomlardagi qator ajratgichlar tozalanadi", () => {
    const many = Array.from({ length: 12 }, (_, i) => ({ title: `Nom\n${i}`, url: `https://s${i}.uz` }));
    const r = splitSources(encodeSources("x", many));
    expect(r.sources).toHaveLength(8);
    expect(r.sources[0].title).toBe("Nom 0");
  });
});
