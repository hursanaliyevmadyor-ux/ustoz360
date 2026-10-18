import { describe, expect, it } from "vitest";
import { analyzeQuery, needsWeb, refineQuery, schoolYearOf, subjectMentioned } from "./intent";

const NOW = new Date("2026-10-18T10:00:00Z");

describe("savol niyatini aniqlash", () => {
  it("tayyor material: sinf, chorak, fan va o'quv yili ajratiladi", () => {
    const i = analyzeQuery("11-sinf 4-chorak matematika testlari", NOW);
    expect(i.wantsMaterial).toBe(true);
    expect(i.spec).toMatchObject({ grade: 11, quarter: 4, subject: "matematika", schoolYear: "2026-2027" });
    expect(needsWeb(i)).toBe(true);
  });

  it("so'z bilan yozilgan chorak va o'quv yili sanasi", () => {
    expect(analyzeQuery("7 sinf fizika to'rtinchi chorak nazorat ishi", NOW).spec).toMatchObject({ grade: 7, quarter: 4, subject: "fizika" });
    expect(analyzeQuery("5-sinf ona tili 2 chorak test namunasi 2025", NOW).spec).toMatchObject({ grade: 5, quarter: 2, subject: "ona tili", year: 2025, schoolYear: "2024-2025" });
    expect(schoolYearOf(new Date("2026-03-01T00:00:00Z"))).toBe("2025-2026");
    expect(schoolYearOf(new Date("2026-09-01T00:00:00Z"))).toBe("2026-2027");
  });

  it("yangi va rasmiy ma'lumot internetga yo'naltiriladi", () => {
    for (const q of ["Attestatsiya qachon boshlanadi?", "O'qituvchilar ish haqi yangilandi mi?", "2026-yil o'quv yili qoidalari", "DTM imtihon sanasi qachon", "Vazirlikning yangi buyrug'i"]) {
      const i = analyzeQuery(q, NOW);
      expect(needsWeb(i), q).toBe(true);
    }
    expect(analyzeQuery("Attestatsiya qachon boshlanadi?", NOW).officialLike).toBe(true);
  });

  it("umumiy bilim va yaratish so'rovlari internetga chiqmaydi", () => {
    for (const q of ["Fotosintez nima?", "Kasrlarni qanday qo'shish kerak", "5-sinf matematika dars rejasi tuzib ber", "10 ta test savoli yozib ber fizika 7-sinf", "Ota-onaga xabar yoz"]) {
      expect(needsWeb(analyzeQuery(q, NOW)), q).toBe(false);
    }
  });

  it("'tuzib ber' deyilsa ham aniq 'internetdan' so'ralsa qidiriladi", () => {
    expect(needsWeb(analyzeQuery("internetdan 8-sinf algebra test namunalarini topib ber", NOW))).toBe(true);
  });

  it("test so'zi sinfsiz/fansiz bo'lsa tayyor material qidirilmaydi", () => {
    expect(analyzeQuery("test nima", NOW).wantsMaterial).toBe(false);
  });

  it("noto'g'ri sinf raqami e'tiborga olinmaydi", () => {
    expect(analyzeQuery("15-sinf matematika testlari", NOW).spec.grade).toBeUndefined();
  });

  it("qidiruv so'rovi: material uchun aniqlashtiriladi, qolganlari o'zgarmaydi", () => {
    const i = analyzeQuery("11-sinf 4-chorak matematika testlari", NOW);
    expect(refineQuery("11-sinf 4-chorak matematika testlari", i)).toBe("11-sinf matematika 4-chorak test namuna 2026-2027 O'zbekiston");
    expect(refineQuery("  Attestatsiya   qachon? ", analyzeQuery("Attestatsiya qachon?", NOW))).toBe("Attestatsiya qachon?");
    expect(refineQuery("x".repeat(500), analyzeQuery("x", NOW))).toHaveLength(380);
  });

  it("fan tilga olinganmi", () => {
    expect(subjectMentioned("Algebra va geometriya 9-sinf", "matematika")).toBe(true);
    expect(subjectMentioned("Tarix darsligi", "matematika")).toBe(false);
  });
});
