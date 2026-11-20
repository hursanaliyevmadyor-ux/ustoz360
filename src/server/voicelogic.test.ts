import { describe, expect, it } from "vitest";
import { VOICE_MODES } from "../lib/voice-mode";
import { controlInput, freeMetadata, grantFor, guestName, guestPermission, isVoiceMode, livekitRoomName, roomFree, roomInput, signRoom, speakSources, tokenInput, verifyRoom } from "./voicelogic";

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
    expect(new Set(VOICE_MODES.map((m) => signRoom(S, code, m).k)).size).toBe(4);
  });
});

describe("LiveKit ruxsatlari", () => {
  const S = { mic: 2, camera: 1, screen: 3 };
  it("ustoz: boshqaradi, gapiradi, kamera va ekranni ulaydi", () => {
    const g = grantFor("host", "s", "u360-x", S);
    expect(g).toMatchObject({ roomJoin: true, room: "u360-x", roomAdmin: true, canPublish: true, canSubscribe: true, canPublishSources: [2, 1, 3] });
  });
  it("sinf rejimida o'quvchi eshitadi, gapira olmaydi, boshqara olmaydi", () => {
    const g = grantFor("guest", "s", "u360-x", S);
    expect(g).toMatchObject({ canPublish: false, canSubscribe: true, canPublishData: true });
    expect((g as { roomAdmin?: boolean }).roomAdmin).toBeUndefined();
  });
  it("erkin suhbatda o'quvchi mikrofon va kamerani yoqa oladi, ekranni ulay olmaydi", () => {
    const g = grantFor("guest", "e", "u360-x", S);
    expect(g).toMatchObject({ canPublish: true, canPublishSources: [2, 1] });
    expect((g as { canPublishSources: number[] }).canPublishSources).not.toContain(3);
    expect((g as { roomAdmin?: boolean }).roomAdmin).toBeUndefined();
  });
  it("ovozli chatda (kamerasiz) ustoz ham faqat mikrofonni ulaydi: kamera va ekran yopiq", () => {
    for (const m of ["q", "o"] as const) {
      const g = grantFor("host", m, "u360-x", S);
      expect(g).toMatchObject({ roomAdmin: true, canPublish: true, canPublishSources: [2] });
    }
  });
  it("ovozli chat, ruxsat bilan (q): o'quvchi tinglaydi, gapira olmaydi", () => {
    expect(grantFor("guest", "q", "u360-x", S)).toMatchObject({ canPublish: false, canSubscribe: true, canPublishData: true });
  });
  it("ovozli chat, erkin (o): o'quvchi faqat mikrofonni yoqa oladi", () => {
    const g = grantFor("guest", "o", "u360-x", S) as { canPublish: boolean; canPublishSources: number[]; roomAdmin?: boolean };
    expect(g.canPublish).toBe(true);
    expect(g.canPublishSources).toEqual([2]);
    expect(g.roomAdmin).toBeUndefined();
  });
  it("gapirishga ruxsat berilganda: video rejimda mikrofon va kamera, ovozli chatda faqat mikrofon", () => {
    expect(speakSources("s", S)).toEqual([2, 1]);
    expect(speakSources("e", S)).toEqual([2, 1]);
    expect(speakSources("q", S)).toEqual([2]);
    expect(speakSources("o", S)).toEqual([2]);
  });
  it("hech kim o'z ma'lumotini o'zgartira olmaydi", () => {
    for (const m of VOICE_MODES) for (const r of ["host", "guest"] as const) expect(grantFor(r, m, "u360-x", S).canUpdateOwnMetadata).toBe(false);
  });
});

describe("jonli \"hamma gapira oladi\"", () => {
  const S = { mic: 2, camera: 1, screen: 3 };
  it("xona metadatasi yoziladi va o'qiladi, buzilgani yoqilmagan hisoblanadi", () => {
    expect(roomFree(freeMetadata(true))).toBe(true);
    expect(roomFree(freeMetadata(false))).toBe(false);
    for (const bad of [undefined, "", "xato", "[]", "null", '{"f":"1"}', '{"f":true}', '{"f":2}']) expect(roomFree(bad)).toBe(false);
  });
  it("ruxsat bilan rejimda yoqilsa, kirgan o'quvchi gapira oladi, lekin boshqaruv huquqi bo'lmaydi", () => {
    const g = grantFor("guest", "s", "u360-x", S, true) as { canPublish: boolean; canPublishSources: number[]; roomAdmin?: boolean };
    expect(g.canPublish).toBe(true);
    expect(g.canPublishSources).toEqual([2, 1]);
    expect(g.roomAdmin).toBeUndefined();
    expect((grantFor("guest", "q", "u360-x", S, true) as { canPublishSources: number[] }).canPublishSources).toEqual([2]);
    expect(grantFor("guest", "s", "u360-x", S, false)).toMatchObject({ canPublish: false });
  });
  it("ruxsat berish yoki olish: video rejimda mikrofon va kamera, ovozli chatda faqat mikrofon, olinganda hech narsa", () => {
    expect(guestPermission("s", true, S)).toEqual({ canPublish: true, canSubscribe: true, canPublishData: true, canPublishSources: [2, 1] });
    expect(guestPermission("q", true, S).canPublishSources).toEqual([2]);
    expect(guestPermission("s", false, S)).toEqual({ canPublish: false, canSubscribe: true, canPublishData: true, canPublishSources: [] });
  });
});

describe("kichik yordamchilar", () => {
  it("xona nomi, rejim, ism", () => {
    expect(livekitRoomName(code)).toBe("u360-abcdefghjk");
    expect(VOICE_MODES.every((m) => isVoiceMode(m)) && !isVoiceMode("x") && !isVoiceMode(5)).toBe(true);
    expect(guestName("  Ali   Valiyev ")).toBe("Ali Valiyev");
    expect(guestName("")).toBe("Mehmon");
    expect(guestName(undefined)).toBe("Mehmon");
  });
  it("so'rov shakllari", () => {
    const k = "a".repeat(22);
    expect(roomInput.safeParse({ mode: "s" }).success).toBe(true);
    expect(roomInput.safeParse({ mode: "q" }).success && roomInput.safeParse({ mode: "o" }).success).toBe(true);
    expect(roomInput.safeParse({ mode: "x" }).success).toBe(false);
    expect(tokenInput.safeParse({ code, mode: "s", k, name: "Ali" }).success).toBe(true);
    expect(tokenInput.safeParse({ code: "kalta", mode: "s", k }).success).toBe(false);
    expect(controlInput.safeParse({ action: "speak", code, mode: "s", k, h: k, identity: "o-abc", allow: true }).success).toBe(true);
    expect(controlInput.safeParse({ action: "speak", code, mode: "s", k, h: k, allow: true }).success).toBe(false);
    expect(controlInput.safeParse({ action: "close", code, mode: "s", k, h: k }).success).toBe(true);
    expect(controlInput.safeParse({ action: "free", code, mode: "s", k, h: k, on: true }).success).toBe(true);
    expect(controlInput.safeParse({ action: "free", code, mode: "s", k, h: k }).success).toBe(false);
    expect(controlInput.safeParse({ action: "free", code, mode: "s", k, h: k, on: "ha" }).success).toBe(false);
    expect(controlInput.safeParse({ action: "delete", code, mode: "s", k }).success).toBe(false);
  });
});
