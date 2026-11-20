import { describe, expect, it } from "vitest";
import { controlInput, grantFor, guestName, isVoiceMode, livekitRoomName, roomInput, signRoom, tokenInput, verifyRoom } from "./voicelogic";

const S = "s".repeat(40);
const code = "abcdefghjk";

describe("xona imzolari", () => {
  it("o'quvchi va ustoz imzosi farq qiladi, ikkalasi tekshiruvdan o'tadi", () => {
    const { k, h } = signRoom(S, code, "s");
    expect(k).not.toBe(h);
    expect(verifyRoom(S, { code, mode: "s", k })).toBe("guest");
    expect(verifyRoom(S, { code, mode: "s", k, h })).toBe("host");
  });
  it("o'quvchi ustoz imzosini o'zi yasay olmaydi", () => {
    const { k } = signRoom(S, code, "s");
    expect(verifyRoom(S, { code, mode: "s", k, h: k })).toBe("guest"); // k ni h o'rniga qo'ysa ham ustoz bo'lmaydi
    expect(verifyRoom(S, { code, mode: "s", k, h: "x".repeat(22) })).toBe("guest");
  });
  it("rejim yoki kod o'zgartirilsa imzo yaroqsiz", () => {
    const { k, h } = signRoom(S, code, "s");
    expect(verifyRoom(S, { code, mode: "e", k, h })).toBeNull();
    expect(verifyRoom(S, { code: "mnpqrstuvw", mode: "s", k, h })).toBeNull();
  });
  it("boshqa sir bilan imzolangan havola yaroqsiz", () => {
    const { k } = signRoom("t".repeat(40), code, "s");
    expect(verifyRoom(S, { code, mode: "s", k })).toBeNull();
  });
  it("noto'g'ri kirishlar rad etiladi", () => {
    for (const bad of [{ code: "x", mode: "s", k: "a" }, { code, mode: "z", k: "a" }, { code, mode: "s", k: 5 }, { code, mode: "s" }, { code: undefined, mode: "s", k: "a" }]) {
      expect(verifyRoom(S, bad as never)).toBeNull();
    }
  });
  it("imzolar barqaror va urinishlar orasida takrorlanadi", () => {
    expect(signRoom(S, code, "s")).toEqual(signRoom(S, code, "s"));
    expect(signRoom(S, code, "s").k).not.toBe(signRoom(S, code, "e").k);
  });
});

describe("LiveKit ruxsatlari", () => {
  const MIC = 2;
  it("ustoz: boshqaradi va gapiradi", () => {
    const g = grantFor("host", "s", "u360-x", MIC);
    expect(g).toMatchObject({ roomJoin: true, room: "u360-x", roomAdmin: true, canPublish: true, canSubscribe: true, canPublishSources: [MIC] });
  });
  it("sinf rejimida o'quvchi eshitadi, gapira olmaydi, boshqara olmaydi", () => {
    const g = grantFor("guest", "s", "u360-x", MIC);
    expect(g).toMatchObject({ canPublish: false, canSubscribe: true, canPublishData: true });
    expect((g as { roomAdmin?: boolean }).roomAdmin).toBeUndefined();
  });
  it("erkin suhbatda o'quvchi faqat mikrofonni yoqa oladi", () => {
    const g = grantFor("guest", "e", "u360-x", MIC);
    expect(g).toMatchObject({ canPublish: true, canPublishSources: [MIC] });
    expect((g as { roomAdmin?: boolean }).roomAdmin).toBeUndefined();
  });
  it("hech kim o'z ma'lumotini o'zgartira olmaydi", () => {
    for (const r of ["host", "guest"] as const) expect(grantFor(r, "s", "u360-x", MIC).canUpdateOwnMetadata).toBe(false);
  });
});

describe("kichik yordamchilar", () => {
  it("xona nomi, rejim, ism", () => {
    expect(livekitRoomName(code)).toBe("u360-abcdefghjk");
    expect(isVoiceMode("s") && isVoiceMode("e") && !isVoiceMode("x")).toBe(true);
    expect(guestName("  Ali   Valiyev ")).toBe("Ali Valiyev");
    expect(guestName("")).toBe("Mehmon");
    expect(guestName(undefined)).toBe("Mehmon");
  });
  it("so'rov shakllari", () => {
    const k = "a".repeat(22);
    expect(roomInput.safeParse({ mode: "s" }).success).toBe(true);
    expect(roomInput.safeParse({ mode: "x" }).success).toBe(false);
    expect(tokenInput.safeParse({ code, mode: "s", k, name: "Ali" }).success).toBe(true);
    expect(tokenInput.safeParse({ code: "kalta", mode: "s", k }).success).toBe(false);
    expect(controlInput.safeParse({ action: "speak", code, mode: "s", k, h: k, identity: "o-abc", allow: true }).success).toBe(true);
    expect(controlInput.safeParse({ action: "speak", code, mode: "s", k, h: k, allow: true }).success).toBe(false);
    expect(controlInput.safeParse({ action: "close", code, mode: "s", k, h: k }).success).toBe(true);
    expect(controlInput.safeParse({ action: "delete", code, mode: "s", k }).success).toBe(false);
  });
});
