import { describe, expect, it } from "vitest";
import { SETTING_DEFAULTS, settingSchemas } from "../settingsdef";

const base = settingSchemas.ranking.parse(SETTING_DEFAULTS.ranking);

describe("reyting sozlamalari", () => {
  it("standart qiymatlar: ikki yo'nalish, 70/30 vazn, 3 urinish", () => {
    expect(base.enabled).toBe(true);
    expect(base.directions.map((d) => d.key)).toEqual(["ATTESTATSIYA", "MILLIY_SERTIFIKAT"]);
    expect(base.examWeight + base.diagWeight).toBe(100);
    expect(base.maxAttempts).toBe(3);
    expect(base.minParticipants).toBeGreaterThanOrEqual(2);
  });

  it("noto'g'ri qiymatlar rad etiladi", () => {
    expect(settingSchemas.ranking.safeParse({ ...base, maxAttempts: 0 }).success).toBe(false);
    expect(settingSchemas.ranking.safeParse({ ...base, minParticipants: 1 }).success).toBe(false);
    expect(settingSchemas.ranking.safeParse({ ...base, directions: [] }).success).toBe(false);
    expect(settingSchemas.ranking.safeParse({ ...base, directions: [{ key: "kichik harf", label: "X" }] }).success).toBe(false);
  });
});
