import { describe, expect, it } from "vitest";
import { MAX_CHAT, decodeMsg, encodeMsg, roleOf, sortPeople } from "./voice-msg";

describe("ovozli xona xabarlari", () => {
  it("chat va qo'l ko'tarish aylanib qaytadi", () => {
    expect(decodeMsg(encodeMsg({ t: "chat", text: "Salom" }), "chat")).toEqual({ t: "chat", text: "Salom" });
    expect(decodeMsg(encodeMsg({ t: "hand", up: true }), "hand")).toEqual({ t: "hand", up: true });
  });
  it("mavzu va tur mos kelmasa rad etiladi", () => {
    expect(decodeMsg(encodeMsg({ t: "chat", text: "x" }), "hand")).toBeNull();
    expect(decodeMsg(encodeMsg({ t: "hand", up: true }), "chat")).toBeNull();
    expect(decodeMsg(encodeMsg({ t: "chat", text: "x" }), undefined)).toBeNull();
  });
  it("buzilgan yoki zararli ma'lumot hech qachon xato bermaydi", () => {
    for (const bad of ["", "{", "null", "5", "[]", '{"t":"chat"}', '{"t":"chat","text":5}', '{"t":"hand","up":"ha"}']) expect(decodeMsg(bad, "chat")).toBeNull();
    expect(decodeMsg(new Uint8Array([255, 254, 0]), "chat")).toBeNull();
  });
  it("matn tozalanadi va qisqartiriladi", () => {
    expect(decodeMsg(JSON.stringify({ t: "chat", text: "  salom\u0000\u0007 dunyo  " }), "chat")).toEqual({ t: "chat", text: "salom dunyo" });
    expect(decodeMsg(JSON.stringify({ t: "chat", text: "   " }), "chat")).toBeNull();
    expect((decodeMsg(JSON.stringify({ t: "chat", text: "a".repeat(2000) }), "chat") as { text: string }).text).toHaveLength(MAX_CHAT);
  });
  it("HTML matn sifatida qoladi (ekranda xavfsiz chiqariladi)", () => {
    expect(decodeMsg(JSON.stringify({ t: "chat", text: "<img src=x onerror=alert(1)>" }), "chat")).toEqual({ t: "chat", text: "<img src=x onerror=alert(1)>" });
  });
});

describe("rol va tartib", () => {
  it("metadata", () => {
    expect(roleOf('{"r":"host"}')).toBe("host");
    expect(roleOf('{"r":"guest"}')).toBe("guest");
    for (const bad of [undefined, "", "{", '{"r":5}']) expect(roleOf(bad)).toBe("guest");
  });
  it("ustoz, men, qo'l ko'targanlar, qolganlar", () => {
    const L = [
      { identity: "o-1", name: "Zafar", host: false, me: false },
      { identity: "o-2", name: "Ali", host: false, me: false },
      { identity: "o-3", name: "Vali", host: false, me: true },
      { identity: "t-1", name: "Ustoz", host: true, me: false },
      { identity: "o-4", name: "Bobur", host: false, me: false },
    ];
    expect(sortPeople(L, new Set(["o-4"])).map((p) => p.identity)).toEqual(["t-1", "o-3", "o-4", "o-2", "o-1"]);
  });
});
