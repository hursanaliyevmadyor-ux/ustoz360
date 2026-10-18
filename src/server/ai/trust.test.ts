import { describe, expect, it } from "vitest";
import { OFFICIAL_DOMAINS, classifyUrl, hasOfficial, hostOf, rankHits } from "./trust";

describe("manba ishonchliligi", () => {
  it("rasmiy, ta'lim, ommaviy axborot, norasmiy va ijtimoiy tarmoq ajratiladi", () => {
    expect(classifyUrl("https://lex.uz/docs/123")).toBe("official");
    expect(classifyUrl("https://www.edu.uz/uz/news")).toBe("official");
    expect(classifyUrl("https://my.gov.uz/uz")).toBe("official");
    expect(classifyUrl("https://dtm.uz")).toBe("official");
    expect(classifyUrl("https://tdpu.edu.uz/page")).toBe("education");
    expect(classifyUrl("https://ziyonet.uz/uz/library")).toBe("education");
    expect(classifyUrl("https://kun.uz/news/1")).toBe("media");
    expect(classifyUrl("https://uz.wikipedia.org/wiki/X")).toBe("media");
    expect(classifyUrl("https://random-teacher-blog.uz/test")).toBe("general");
    expect(classifyUrl("https://t.me/someTests")).toBe("social");
    expect(classifyUrl("https://www.youtube.com/watch?v=1")).toBe("social");
  });

  it("soxta domenlar rasmiy deb hisoblanmaydi", () => {
    expect(classifyUrl("https://lex.uz.evil.com/x")).toBe("general");
    expect(classifyUrl("https://notlex.uz/x")).toBe("general");
    expect(classifyUrl("https://gov.uz.fake.ru")).toBe("general");
    expect(classifyUrl("https://evil.com/?u=https://lex.uz")).toBe("general");
  });

  it("noto'g'ri URL xavfsiz", () => {
    expect(classifyUrl("lex.uz")).toBe("general");
    expect(hostOf("noto'g'ri")).toBe("");
    expect(hostOf("https://www.Lex.uz/a")).toBe("lex.uz");
  });

  it("natijalar ishonchlilik bo'yicha tartiblanadi; takror, https bo'lmagan va matnsiz natijalar tashlanadi", () => {
    const r = rankHits([
      { title: "Blog", url: "https://blog.uz/a", content: "matn", score: 0.99 },
      { title: "Rasmiy", url: "https://lex.uz/docs/1", content: "rasmiy matn", score: 0.3 },
      { title: "Kun", url: "https://kun.uz/n", content: "yangilik", score: 0.5 },
      { title: "Takror", url: "https://lex.uz/docs/1", content: "boshqa", score: 0.9 },
      { title: "Http", url: "http://x.uz", content: "matn", score: 1 },
      { title: "Bo'sh", url: "https://a.uz", content: "  ", score: 1 },
    ]);
    expect(r.map((x) => x.url)).toEqual(["https://lex.uz/docs/1", "https://kun.uz/n", "https://blog.uz/a"]);
    expect(r.map((x) => x.trust)).toEqual(["official", "media", "general"]);
    expect(hasOfficial(r)).toBe(true);
  });

  it("ijtimoiy tarmoq faqat boshqa manba bo'lmaganda qoladi", () => {
    const mixed = rankHits([{ url: "https://t.me/x", content: "a", title: "TG" }, { url: "https://blog.uz/p", content: "b", title: "B" }]);
    expect(mixed.map((x) => x.trust)).toEqual(["general"]);
    const only = rankHits([{ url: "https://t.me/x", content: "a", title: "TG" }]);
    expect(only.map((x) => x.trust)).toEqual(["social"]);
  });

  it("qidiruv bahosi bir xil darajada hal qiladi; limit hurmat qilinadi", () => {
    const hits = Array.from({ length: 10 }, (_, i) => ({ title: `N${i}`, url: `https://s${i}.uz/p`, content: "matn", score: i / 10 }));
    const r = rankHits(hits, 3);
    expect(r).toHaveLength(3);
    expect(r[0].title).toBe("N9");
  });

  it("rasmiy domenlar ro'yxati kerakli saytlarni o'z ichiga oladi", () => {
    expect(OFFICIAL_DOMAINS).toEqual(expect.arrayContaining(["lex.uz", "gov.uz", "edu.uz", "dtm.uz"]));
  });
});
