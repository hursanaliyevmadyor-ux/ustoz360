import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { AVATAR_PRESETS, PRESET_PREFIX, defaultPresetId, isPresetId, presetOfPath, presetUrl } from "./avatars";

describe("tayyor profil rasmlari", () => {
  it("10 ta rasm bor va har birining fayli mavjud, to'g'ri SVG", () => {
    expect(AVATAR_PRESETS).toHaveLength(10);
    expect(new Set(AVATAR_PRESETS.map((p) => p.id)).size).toBe(10);
    for (const p of AVATAR_PRESETS) {
      const file = join(process.cwd(), "public", presetUrl(p.id));
      expect(existsSync(file), `${p.id} fayli yo'q`).toBe(true);
      const svg = readFileSync(file, "utf8");
      expect(svg.startsWith("<svg")).toBe(true);
      expect(svg).not.toMatch(/<script|onload=|href=/i); // statik, xavfsiz rasm: skript yoki tashqi havola yo'q
    }
  });

  it("saqlangan yo'ldan tayyor rasm aniqlanadi; noma'lum yoki yuklangan rasm bo'lsa null", () => {
    expect(presetOfPath(`${PRESET_PREFIX}p3`)).toBe("p3");
    expect(presetOfPath("preset:p99")).toBeNull();
    expect(presetOfPath("preset:../../etc")).toBeNull();
    expect(presetOfPath("avatars/u1/abc.webp")).toBeNull();
    expect(presetOfPath(null)).toBeNull();
    expect(isPresetId("p10")).toBe(true);
    expect(isPresetId("p11")).toBe(false);
  });

  it("avtomatik rasm: bir foydalanuvchiga doim bir xil va hamma rasm ishlatiladi", () => {
    expect(defaultPresetId("user-1")).toBe(defaultPresetId("user-1"));
    const seen = new Set<string>();
    for (let i = 0; i < 400; i++) { const id = defaultPresetId(`cm${i}x${i * 7919}`); expect(isPresetId(id)).toBe(true); seen.add(id); }
    expect(seen.size).toBe(10);
  });
});
