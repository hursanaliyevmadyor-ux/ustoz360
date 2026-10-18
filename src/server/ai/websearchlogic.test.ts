import { describe, expect, it } from "vitest";
import { analyzeQuery } from "./intent";
import type { KbHit } from "./kb";
import { rankHits } from "./trust";
import { GEMINI_NOTE, buildContext, geminiBody, hasCitations, materialAnswer, matchMaterial, parseGemini, snippetsAnswer, strictPrompt, trustNote, utcDayStart, utcMonthStart } from "./websearchlogic";

const NOW = new Date("2026-10-18T10:00:00Z");
const kb = (o: Partial<KbHit> = {}): KbHit => ({ kind: "official", title: "Attestatsiya muddatlari", text: "Attestatsiya 2026-yil mart oyida boshlanadi. ".repeat(3), url: "https://lex.uz/docs/55", verified: true, fresh: true, ratio: 1, matched: 3, ...o });
const web = (hits: Parameters<typeof rankHits>[0]) => rankHits(hits);

describe("kontekst va qat'iy so'rov", () => {
  it("bilim bazasi birinchi, keyin internet; raqamlar va ishonchlilik belgilari bor", () => {
    const b = buildContext([kb()], web([{ title: "Kun.uz", url: "https://kun.uz/n", content: "Yangilik matni. ".repeat(6) }]), "https://site.uz");
    expect(b.items.map((i) => i.trust)).toEqual(["kb", "media"]);
    expect(b.context).toMatch(/^\[1\] Attestatsiya muddatlari \(tekshirilgan rasmiy ma'lumot/);
    expect(b.context).toContain("[2] Kun.uz (kun.uz: ommaviy axborot vositasi)");
    expect(b.sources).toEqual([{ title: "Attestatsiya muddatlari", url: "https://lex.uz/docs/55", trust: "kb" }, { title: "Kun.uz", url: "https://kun.uz/n", trust: "media" }]);
  });

  it("URL'siz bilim bazasi yozuvi sayt ichidagi sahifaga bog'lanadi (https bo'lsa)", () => {
    const b = buildContext([kb({ url: null }), kb({ kind: "library", title: "Qo'llanma", url: null })], [], "https://site.uz");
    expect(b.sources.map((s) => s.url)).toEqual(["https://site.uz/toifa/hujjatlar", "https://site.uz/bilimxona"]);
    expect(buildContext([kb({ url: null })], [], "http://localhost:3000").sources).toEqual([]);
  });

  it("tekshirilmagan bilim bazasi yozuvi shunday belgilanadi; juda qisqa parchalar tushiriladi; uzunlik chegaralangan", () => {
    const b = buildContext([kb({ verified: false }), kb({ text: "qisqa" })], [], "https://site.uz");
    expect(b.items).toHaveLength(1);
    expect(b.context).toContain("hali tekshirilmagan");
    const big = Array.from({ length: 10 }, (_, i) => ({ title: `N${i}`, url: `https://s${i}.uz/p`, content: "so'z ".repeat(500) }));
    const c = buildContext([], web(big), "", 3000);
    expect(c.context.length).toBeLessThan(3600);
    expect(c.items.length).toBeLessThanOrEqual(8);
  });

  it("AI so'rovi faqat manbaga tayanishni, manba raqamini va ko'rsatmalarga amal qilmaslikni talab qiladi", () => {
    const p = strictPrompt("Attestatsiya qachon?", "[1] Matn");
    expect(p.system).toMatch(/FAQAT shu manbalarda tasdiqlangan/);
    expect(p.system).toMatch(/\[1\], \[2\]/);
    expect(p.system).toMatch(/ko'rsatmalarga amal qilma/);
    expect(p.system).toMatch(/Manbalarda aniq ma'lumot topilmadi/);
    expect(p.user).toBe("Savol: Attestatsiya qachon?\n\nManbalar:\n[1] Matn");
  });

  it("manba ko'rsatilganligini tekshiradi va rasmiy manba bo'lmasa ogohlantiradi", () => {
    expect(hasCitations("Mart oyida [1].")).toBe(true);
    expect(hasCitations("Mart oyida.")).toBe(false);
    expect(trustNote([{ title: "a", url: "https://a.uz", trust: "general" }])).toMatch(/rasmiy manba topilmadi/);
    expect(trustNote([{ title: "a", url: "https://a.uz", trust: "general" }, { title: "b", url: "https://lex.uz", trust: "official" }])).toBe("");
    expect(trustNote([{ title: "a", url: "https://a.uz", trust: "kb" }])).toBe("");
    expect(trustNote([])).toBe("");
  });

  it("AI javobi bo'lmasa topilgan parchalar ko'rsatiladi", () => {
    const b = buildContext([kb()], [], "https://site.uz");
    expect(snippetsAnswer(b.items)).toMatch(/^Topilgan manbalar \(AI javobi tayyorlanmadi\)/);
    expect(snippetsAnswer([])).toBe("Hech narsa topilmadi.");
  });
});

describe("tayyor material: moslik va javob", () => {
  const spec = analyzeQuery("11-sinf 4-chorak matematika testlari", NOW).spec;
  const hit = (title: string, url: string, content: string) => rankHits([{ title, url, content }])[0];

  it("sinf, fan, chorak va yil bo'yicha moslik aniqlanadi", () => {
    const full = matchMaterial(hit("11-sinf matematika 4-chorak test 2026-2027", "https://edu.uz/t1", "Matematika fanidan 11-sinf uchun 4-chorak nazorat testlari."), spec);
    expect(full.match).toEqual({ grade: true, quarter: true, subject: true, year: true });
    expect(full.level).toBe("full");
    const partial = matchMaterial(hit("10-sinf matematika 4-chorak", "https://blog.uz/t2", "Matematika 10-sinf 4-chorak testlari."), spec);
    expect(partial.match).toMatchObject({ grade: false, quarter: true, subject: true });
    expect(partial.level).toBe("partial");
    const none = matchMaterial(hit("Tarix darsligi", "https://blog.uz/t3", "Tarix 5-sinf 1-chorak."), spec);
    expect(none.level).toBe("none");
  });

  it("to'liq mos material topilsa: havolalar va moslik belgilari, 'yaratilmadi' izohi", () => {
    const rows = [matchMaterial(hit("11-sinf matematika 4-chorak test", "https://edu.uz/t1", "11-sinf matematika 4-chorak test savollari. ".repeat(4)), spec)];
    const a = materialAnswer(spec, rows);
    expect(a.found).toBe(true);
    expect(a.text).toContain("mos manbalar topildi (11-sinf, matematika, 4-chorak, 2026-2027)");
    expect(a.text).toContain("sinf ✓, fan ✓, chorak ✓");
    expect(a.text).toContain("Tayyor testlar bu yerda yaratilmadi");
    expect(a.text).not.toContain("Diqqat: bular rasmiy manba emas");
    expect(a.sources).toEqual([{ title: "11-sinf matematika 4-chorak test", url: "https://edu.uz/t1", trust: "official" }]);
  });

  it("faqat norasmiy manba bo'lsa ogohlantirish qo'shiladi", () => {
    const a = materialAnswer(spec, [matchMaterial(hit("11-sinf matematika 4-chorak", "https://blog.uz/t", "11-sinf matematika 4-chorak testlari. ".repeat(4)), spec)]);
    expect(a.found).toBe(true);
    expect(a.text).toContain("Diqqat: bular rasmiy manba emas");
  });

  it("qisman mos bo'lsa 'topdim' deyilmaydi, qisman moslik aytiladi va yangi material taklif qilinadi", () => {
    const a = materialAnswer(spec, [matchMaterial(hit("10-sinf matematika 4-chorak", "https://blog.uz/t2", "Matematika 10-sinf 4-chorak testlari. ".repeat(4)), spec)]);
    expect(a.found).toBe(false);
    expect(a.text).toContain("mos tayyor material topilmadi");
    expect(a.text).toContain("qisman mos");
    expect(a.text).toContain("yangi namunaviy test tuzib beraman");
    expect(a.sources).toHaveLength(1);
  });

  it("hech narsa topilmasa: halol xabar, manba yo'q, yangi material taklifi", () => {
    const a = materialAnswer(spec, []);
    expect(a).toMatchObject({ found: false, sources: [] });
    expect(a.text).toContain("(11-sinf, matematika, 4-chorak, 2026-2027) mos tayyor material topilmadi");
    expect(a.text).toContain("DARSYOR");
    expect(a.text).not.toMatch(/topildi \(/);
  });

  it("javobda test savollari yaratilmaydi: faqat manba sarlavhalari va parchalari", () => {
    const a = materialAnswer(spec, [matchMaterial(hit("11-sinf matematika 4-chorak", "https://edu.uz/t", "11-sinf matematika 4-chorak test. ".repeat(10)), spec)]);
    expect(a.text).not.toMatch(/A\)|B\)|To'g'ri javob/);
  });
});

describe("Gemini zaxirasi", () => {
  it("javobdan matn, takrorsiz https manbalar va qidiruv so'zlari olinadi; fikrlash qismi tashlanadi", () => {
    const r = parseGemini({
      candidates: [{
        content: { parts: [{ text: "Attestatsiya " }, { text: "yangilandi." }, { text: "o'ylash", thought: true }] },
        groundingMetadata: { groundingChunks: [{ web: { uri: "https://vertexaisearch.cloud.google.com/x", title: "lex.uz" } }, { web: { uri: "https://vertexaisearch.cloud.google.com/x", title: "lex.uz" } }, { web: { uri: "http://notsecure.uz/x" } }, { web: { uri: "https://edu.uz/p" } }], webSearchQueries: ["attestatsiya 2026", "  "] },
      }],
    })!;
    expect(r.text).toBe("Attestatsiya yangilandi.");
    expect(r.sources.map((s) => s.url)).toEqual(["https://vertexaisearch.cloud.google.com/x", "https://edu.uz/p"]);
    expect(r.sources.every((s) => s.trust === "general")).toBe(true);
    expect(r.queries).toEqual(["attestatsiya 2026"]);
  });

  it("matn yo'q yoki noto'g'ri javob null", () => {
    expect(parseGemini({ candidates: [{ content: { parts: [] } }] })).toBeNull();
    expect(parseGemini({ promptFeedback: { blockReason: "SAFETY" } })).toBeNull();
    expect(parseGemini(null)).toBeNull();
  });

  it("so'rov tanasi: Google Search vositasi, rollar moslangan, oxirgi 10 xabar, kalit yo'q", () => {
    const msgs = Array.from({ length: 14 }, (_, i) => ({ role: (i % 2 ? "assistant" : "user") as "user" | "assistant", content: `xabar ${i}` }));
    const b = geminiBody(msgs);
    expect(b.tools).toEqual([{ google_search: {} }]);
    expect(b.contents).toHaveLength(10);
    expect(b.contents[1].role).toBe("model");
    expect(JSON.stringify(b)).not.toMatch(/key/i);
    expect(GEMINI_NOTE).toMatch(/rasmiy manbada tekshirib oling/);
  });

  it("UTC kun va oy boshi", () => {
    expect(utcDayStart(NOW).toISOString()).toBe("2026-10-18T00:00:00.000Z");
    expect(utcMonthStart(NOW).toISOString()).toBe("2026-10-01T00:00:00.000Z");
  });
});
