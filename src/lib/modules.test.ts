import { describe, expect, it } from "vitest";
import { modules, resolveSub } from "./modules";

const ai = modules.find((m) => m.key === "ai")!;
const where = (path: string) => { const r = resolveSub(ai, path); return { tab: r.tab, sub: r.sub?.label, group: r.group?.label }; };

describe("modullar: o'xshash bo'limlar birlashtirilgan", () => {
  const tabs = (key: string) => modules.find((m) => m.key === key)!.subs.filter((s) => !s.hidden).map((s) => s.label);
  const pathOf = (key: string, path: string) => resolveSub(modules.find((m) => m.key === key)!, path);

  it("har modulda eng ko'pi bilan to'rtta tab", () => {
    for (const m of modules) expect(m.subs.filter((s) => !s.hidden).length, m.name).toBeLessThanOrEqual(4);
  });
  it("tablar", () => {
    expect(tabs("darsyor")).toEqual(["Umumiy", "Dars ishlanmasi", "Materiallar"]);
    expect(tabs("toifa")).toEqual(["Umumiy", "Reja", "Hujjatlar"]);
    expect(tabs("market")).toEqual(["Katalog", "Kurslarim va xaridlar", "Muallif kabineti"]);
    expect(tabs("sinf")).toEqual(["Sinflar", "Tahlil va natijalar"]);
    expect(tabs("bilimxona")).toEqual(["Kutubxona", "Hujjat bilan suhbat"]);
    expect(tabs("bepul")).toEqual(["Umumiy", "Mening AI obunalarim"]);
  });
  it("DARSYOR materiallari bitta tab ostida", () => {
    for (const p of ["/darsyor/materiallar", "/darsyor/test-generator", "/darsyor/korgazma", "/darsyor/baholash"]) expect(pathOf("darsyor", p).tab, p).toBe("/darsyor/materiallar");
    expect(pathOf("darsyor", "/darsyor/baholash").group?.label).toBe("Materiallar");
  });
  it("fayl yuklash Kutubxona tabi ostida", () => {
    expect(pathOf("bilimxona", "/bilimxona/yuklash")).toMatchObject({ tab: "/bilimxona" });
  });
  it("yashirin sahifalarning guruhi har doim mavjud tabga ishora qiladi", () => {
    for (const m of modules) {
      const shown = new Set(m.subs.filter((s) => !s.hidden).map((s) => s.href));
      for (const s of m.subs.filter((x) => x.hidden)) expect(shown.has(s.group!), `${m.name}: ${s.href}`).toBe(true);
    }
  });
  it("sahifalar bir necha modulda takrorlanmaydi", () => {
    const hrefs = modules.flatMap((m) => m.subs.map((s) => s.href));
    expect(new Set(hrefs).size).toBe(hrefs.length);
  });
});

describe("USTOZ AI: bitta umumiy bo'lim", () => {
  it("yuqorida faqat to'rtta tab ko'rinadi, o'xshash bo'limlar alohida tab emas", () => {
    expect(ai.subs.filter((s) => !s.hidden).map((s) => s.label)).toEqual(["Umumiy", "Testlar", "Natijalarim"]);
  });
  it("diagnostika umumiy bo'limda qoladi", () => {
    expect(where("/ustoz-ai/diagnostika")).toEqual({ tab: "/ustoz-ai", sub: "Diagnostika", group: "Umumiy" });
  });
  it("oddiy mashq va test sessiyalari Testlar tabi ostida", () => {
    expect(where("/ustoz-ai/mashq")).toMatchObject({ tab: "/ustoz-ai/testlar", sub: "Oddiy mashq" });
    expect(where("/ustoz-ai/mashq/sozlash")).toMatchObject({ tab: "/ustoz-ai/testlar", sub: "Oddiy mashq" });
    expect(where("/ustoz-ai/mashq/abc123")).toMatchObject({ tab: "/ustoz-ai/testlar" });
    expect(where("/ustoz-ai/testlar")).toMatchObject({ tab: "/ustoz-ai/testlar", sub: "Testlar" });
    expect(where("/ustoz-ai/testlar/sozlash")).toMatchObject({ tab: "/ustoz-ai/testlar", sub: "Testlar" });
    expect(where("/ustoz-ai/testlar/abc123")).toMatchObject({ tab: "/ustoz-ai/testlar" });
  });
  it("bilim xaritasi, xatolar daftari va tarix Natijalarim tabi ostida", () => {
    for (const p of ["/ustoz-ai/bilim-xaritasi", "/ustoz-ai/xatolar", "/ustoz-ai/testlar/tarix", "/ustoz-ai/mashq/tarix", "/ustoz-ai/natijalar"]) {
      expect(where(p).tab, p).toBe("/ustoz-ai/natijalar");
    }
    expect(where("/ustoz-ai/bilim-xaritasi").group).toBe("Natijalarim");
  });
  it("umumiy sahifa o'z tabida", () => {
    expect(where("/ustoz-ai").tab).toBe("/ustoz-ai");
  });
  it("har bir yashirin sahifaning guruhi mavjud tabga ishora qiladi", () => {
    const tabs = new Set(ai.subs.filter((s) => !s.hidden).map((s) => s.href));
    for (const s of ai.subs.filter((x) => x.hidden)) expect(tabs.has(s.group!), s.href).toBe(true);
  });
});
