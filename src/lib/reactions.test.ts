import { describe, expect, it } from "vitest";
import { REACTIONS, ReactionLimiter, parseReaction } from "./reactions";

describe("parseReaction", () => {
  it("faqat ruxsat etilgan emoji", () => {
    for (const e of REACTIONS) expect(parseReaction({ e })).toBe(e);
    for (const bad of [null, undefined, 5, "👏", {}, { e: "😈" }, { e: "<b>x</b>" }, { e: ["👏"] }, { e: "👏👏" }, { e: "" }]) expect(parseReaction(bad), JSON.stringify(bad)).toBeNull();
  });
});

describe("ReactionLimiter", () => {
  it("tez-tez kelganini tashlaydi, kutgandan keyin o'tkazadi, yuboruvchilar alohida", () => {
    let t = 1000;
    const l = new ReactionLimiter(() => t, 1000);
    expect(l.allow("a")).toBe(true);
    expect(l.allow("a")).toBe(false);
    expect(l.allow("b")).toBe(true);
    t += 999; expect(l.allow("a")).toBe(false);
    t += 2; expect(l.allow("a")).toBe(true);
  });
  it("xotira cheklangan", () => {
    const l = new ReactionLimiter(() => 1, 1000);
    for (let i = 0; i < 500; i++) l.allow(`u${i}`);
    expect((l as unknown as { last: Map<string, number> }).last.size).toBeLessThanOrEqual(300);
  });
});
