import { describe, expect, it } from "vitest";
import { keyMark, matchKeys, numbersForKey, type KeyMarkInput } from "./verifylogic";

const base: KeyMarkInput = {
  reviewStatus: "NEEDS_REVIEW", ocrUncertain: false, options: [{ label: "A", text: "x" }, { label: "B", text: "y" }, { label: "C", text: "z" }],
  keyAnswer: ["B"], keyConflict: null, verificationStatus: "PROPOSED", proposedAnswer: null,
};

describe("kalit bo'yicha belgilash", () => {
  it("kalitda bitta aniq variant bo'lsa belgilanadi (mustaqil tasdiqsiz ham)", () => {
    expect(keyMark(base)).toEqual({ mark: true, label: "B", independent: false });
    expect(keyMark({ ...base, reviewStatus: "READY" })).toMatchObject({ mark: true, label: "B" });
  });

  it("kalitni mustaqil tekshiruv ham tasdiqlagan bo'lsa «independent»", () => {
    expect(keyMark({ ...base, reviewStatus: "READY", verificationStatus: "CONFIRMED", proposedAnswer: ["B"] })).toEqual({ mark: true, label: "B", independent: true });
    expect(keyMark({ ...base, verificationStatus: "CONFIRMED", proposedAnswer: ["C"] })).toMatchObject({ mark: true, independent: false });
  });

  it("ziddiyat, noaniq matn, to'liq bo'lmagan va qo'llab-quvvatlanmaydigan savollar o'tkazib yuboriladi", () => {
    expect(keyMark({ ...base, reviewStatus: "CONFLICT" })).toEqual({ mark: false, reason: "conflict" });
    expect(keyMark({ ...base, keyConflict: "Savol yonidagi javob va kalit farq qiladi." })).toEqual({ mark: false, reason: "conflict" });
    expect(keyMark({ ...base, ocrUncertain: true })).toEqual({ mark: false, reason: "uncertain" });
    expect(keyMark({ ...base, reviewStatus: "INCOMPLETE" })).toEqual({ mark: false, reason: "unsupported" });
    expect(keyMark({ ...base, reviewStatus: "UNSUPPORTED" })).toEqual({ mark: false, reason: "unsupported" });
    expect(keyMark({ ...base, reviewStatus: "PENDING" })).toEqual({ mark: false, reason: "notready" });
  });

  it("kalitda bir nechta javob yoki savolda yo'q variant bo'lsa belgilanmaydi", () => {
    expect(keyMark({ ...base, keyAnswer: ["A", "B"] })).toEqual({ mark: false, reason: "nokey" });
    expect(keyMark({ ...base, keyAnswer: ["D"] })).toEqual({ mark: false, reason: "nokey" });
    expect(keyMark({ ...base, keyAnswer: null })).toEqual({ mark: false, reason: "nokey" });
  });
});

describe("kalit raqam bo'yicha moslashadi", () => {
  it("raqamli savollar o'z raqami bilan, raqamsiz bo'lim tartib raqami bilan", () => {
    expect(numbersForKey([{ number: 3, section: 0 }, { number: 4, section: 0 }])).toEqual([3, 4]);
    expect(numbersForKey([{ number: null, section: 0 }, { number: null, section: 0 }, { number: null, section: 1 }])).toEqual([1, 2, 1]);
    // bo'limda bir nechta raqam bor bo'lsa, raqamsiz savolga taxminiy raqam berilmaydi
    expect(numbersForKey([{ number: 1, section: 0 }, { number: null, section: 0 }])).toEqual([1, null]);
  });

  it("tartib raqami bilan kalit savolga to'g'ri biriktiriladi", () => {
    const nums = numbersForKey([{ number: null, section: 0 }, { number: null, section: 0 }, { number: null, section: 0 }]);
    const m = matchKeys(nums.map((n) => ({ number: n, section: 0, inlineAnswer: null })), [{ number: 1, answers: ["C"], section: 0 }, { number: 2, answers: ["A"], section: 0 }, { number: 3, answers: ["D"], section: 0 }]);
    expect(m.map((x) => x.key)).toEqual([["C"], ["A"], ["D"]]);
  });
});
