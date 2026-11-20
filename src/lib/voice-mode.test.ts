import { describe, expect, it } from "vitest";
import { VOICE_MODES, hasVideo, isFree, isVoiceMode, modeLabel, modeOf } from "./voice-mode";

describe("xona rejimlari", () => {
  it("to'rtta rejim bor, boshqa qiymat rejim emas", () => {
    expect([...VOICE_MODES]).toEqual(["s", "e", "q", "o"]);
    expect(VOICE_MODES.every(isVoiceMode)).toBe(true);
    for (const bad of ["x", "", "S", 1, null, undefined, "se"]) expect(isVoiceMode(bad)).toBe(false);
  });
  it("video va erkinlik belgilari", () => {
    expect(VOICE_MODES.map(hasVideo)).toEqual([true, true, false, false]);
    expect(VOICE_MODES.map(isFree)).toEqual([false, true, false, true]);
  });
  it("modeOf ikki tanlovdan rejim hosil qiladi va belgilar bilan mos", () => {
    expect(modeOf(true, false)).toBe("s");
    expect(modeOf(true, true)).toBe("e");
    expect(modeOf(false, false)).toBe("q");
    expect(modeOf(false, true)).toBe("o");
    for (const v of [true, false]) for (const f of [true, false]) { const m = modeOf(v, f); expect(hasVideo(m)).toBe(v); expect(isFree(m)).toBe(f); }
  });
  it("har rejimning o'zbekcha nomi bor va hammasi har xil", () => {
    expect(new Set(VOICE_MODES.map(modeLabel)).size).toBe(4);
    expect(modeLabel("q")).toContain("Ovozli chat");
  });
});
