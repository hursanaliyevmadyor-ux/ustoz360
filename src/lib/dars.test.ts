import { describe, expect, it } from "vitest";
import {
  ROOM_ALPHABET, ROOM_CODE_LEN, addSavedRoom, cleanName, cleanTitle, connectionQuality, describeMediaError, fromLocalInput, inviteText, isRoomCode, isTelegramBrowser,
  jitsiHost, jitsiRoomName, jitsiUrl, joinUrl, lessonCountdown, lessonTimeLabel, newRoomCode, parseSavedRooms, parseStartsAt, telegramShareUrl, toLocalInput,
} from "./dars";

describe("dars xonasi kodi", () => {
  it("kod uzunligi va alifbosi to'g'ri", () => {
    for (let i = 0; i < 200; i++) {
      const c = newRoomCode();
      expect(c).toHaveLength(ROOM_CODE_LEN);
      expect(isRoomCode(c)).toBe(true);
    }
  });
  it("o'xshash belgilar yo'q (i, l, o, 0, 1)", () => {
    for (const ch of "il01o") expect(ROOM_ALPHABET.includes(ch)).toBe(false);
  });
  it("tasodifiy: 500 ta kod takrorlanmaydi", () => {
    expect(new Set(Array.from({ length: 500 }, () => newRoomCode())).size).toBe(500);
  });
  it("og'ishsiz: katta baytlar tashlanadi, kod baribir to'ladi", () => {
    let call = 0;
    const c = newRoomCode((n) => new Uint8Array(n).map(() => (call++ % 3 === 0 ? 255 : 5)));
    expect(isRoomCode(c)).toBe(true);
  });
  it("noto'g'ri kodlar rad etiladi", () => {
    for (const bad of ["", "abc", "ABCDEFGHJK", "abcdefghj0", "abcdefghjkm", "../../etc", undefined, 5, null]) expect(isRoomCode(bad)).toBe(false);
  });
});

describe("Jitsi manzili", () => {
  const code = "abcdefghjk";
  it("xona nomi prefiksli", () => expect(jitsiRoomName(code)).toBe("ustoz360-abcdefghjk"));
  it("ism va mavzu manzilda to'g'ri kodlanadi", () => {
    const u = jitsiUrl({ code, name: 'Ali "Valiyev"', title: "5-sinf: kasrlar", host: "meet.jit.si" });
    expect(u.startsWith("https://meet.jit.si/ustoz360-abcdefghjk#")).toBe(true);
    const hash = new URLSearchParams(u.split("#")[1]);
    expect(JSON.parse(hash.get("userInfo.displayName")!)).toBe('Ali "Valiyev"');
    expect(JSON.parse(hash.get("config.subject")!)).toBe("5-sinf: kasrlar");
  });
  it("ismsiz ham ishlaydi; telefonda ilovaga o'tkazmaydi", () => expect(jitsiUrl({ code, host: "meet.jit.si" })).toBe("https://meet.jit.si/ustoz360-abcdefghjk#config.disableDeepLinking=true"));
  it("mikrofon va kamera o'chiq holda kirish", () => {
    const h = new URLSearchParams(jitsiUrl({ code, host: "meet.jit.si", audioMuted: true, videoMuted: true }).split("#")[1]);
    expect(h.get("config.startWithAudioMuted")).toBe("true");
    expect(h.get("config.startWithVideoMuted")).toBe("true");
    const h2 = new URLSearchParams(jitsiUrl({ code, host: "meet.jit.si" }).split("#")[1]);
    expect(h2.has("config.startWithAudioMuted")).toBe(false);
  });
  it("xavfli server nomi rad etiladi", () => {
    expect(jitsiHost("evil.com/path")).toBe("meet.jit.si");
    expect(jitsiHost("javascript:alert(1)")).toBe("meet.jit.si");
    expect(jitsiHost("localhost")).toBe("meet.jit.si");
    expect(jitsiHost("")).toBe("meet.jit.si");
    expect(jitsiHost("Jitsi.Maktab.UZ")).toBe("jitsi.maktab.uz");
  });
});

describe("havola va ulashish", () => {
  const code = "abcdefghjk";
  it("qisqa havola", () => {
    expect(joinUrl("https://x.uz/", code)).toBe("https://x.uz/d/abcdefghjk");
    expect(joinUrl("https://x.uz", code, "5-sinf matematika")).toBe("https://x.uz/d/abcdefghjk?t=5-sinf+matematika");
    expect(joinUrl("https://x.uz", code, "", true)).toBe("https://x.uz/d/abcdefghjk?u=1");
  });
  it("Telegram ulashish havolasi", () => {
    const t = telegramShareUrl("https://x.uz/d/abc?t=a b", "Dars: A&B");
    expect(t.startsWith("https://t.me/share/url?url=")).toBe(true);
    const p = new URL(t).searchParams;
    expect(p.get("url")).toBe("https://x.uz/d/abc?t=a b");
    expect(p.get("text")).toBe("Dars: A&B");
  });
  it("nom va ism tozalanadi", () => {
    expect(cleanTitle("  5-sinf   matematika \n")).toBe("5-sinf matematika");
    expect(cleanTitle("x".repeat(200))).toHaveLength(80);
    expect(cleanTitle(undefined)).toBe("");
    expect(cleanName("  Ali   Valiyev ")).toBe("Ali Valiyev");
    expect(cleanName("y".repeat(100))).toHaveLength(40);
  });
});

describe("brauzer va xatolar", () => {
  it("Telegram brauzerini taniydi", () => {
    expect(isTelegramBrowser("Mozilla/5.0 (Linux; Android 13) Telegram-Android/10.0")).toBe(true);
    expect(isTelegramBrowser("Mozilla/5.0 (iPhone) Safari/605")).toBe(false);
  });
  it("xatolar o'zbekcha va tushunarli", () => {
    expect(describeMediaError({ name: "NotAllowedError" })).toMatch(/ruxsat berilmadi/i);
    expect(describeMediaError({ name: "NotFoundError" }, "mikrofon")).toMatch(/^Mikrofon topilmadi/);
    expect(describeMediaError({ name: "NotReadableError" }, "kamera")).toMatch(/boshqa dastur/);
    expect(describeMediaError({ name: "NoMediaDevices" })).toMatch(/https/);
    expect(describeMediaError(new Error("x"))).toMatch(/yoqib bo'lmadi/);
    expect(describeMediaError(null)).toMatch(/yoqib bo'lmadi/);
  });
});

describe("oxirgi xonalar (brauzerda)", () => {
  const a = { code: "abcdefghjk", title: "A", at: 1 };
  const b = { code: "mnpqrstuvw", title: "B", at: 2 };
  it("yangisi tepada, takrori yo'q, 10 tadan oshmaydi", () => {
    expect(addSavedRoom([a], b).map((r) => r.code)).toEqual(["mnpqrstuvw", "abcdefghjk"]);
    expect(addSavedRoom([a, b], { ...a, at: 3 }).map((r) => r.code)).toEqual(["abcdefghjk", "mnpqrstuvw"]);
    const many = Array.from({ length: 10 }, () => ({ code: newRoomCode(), title: "", at: 0 }));
    expect(addSavedRoom(many, a)).toHaveLength(10);
  });
  it("buzilgan yoki begona ma'lumot e'tiborga olinmaydi", () => {
    expect(parseSavedRooms(null)).toEqual([]);
    expect(parseSavedRooms("{")).toEqual([]);
    expect(parseSavedRooms('{"a":1}')).toEqual([]);
    expect(parseSavedRooms(JSON.stringify([a, { code: "../x", title: "", at: 1 }, { code: b.code }]))).toEqual([a]);
  });
});

describe("dars vaqti", () => {
  const now = new Date(2026, 10, 20, 12, 0, 0).getTime(); // 20-noyabr 12:00 (mahalliy)
  const at = (h: number, m = 0, d = 20) => new Date(2026, 10, d, h, m, 0).getTime();
  it("manzildagi vaqt", () => {
    expect(joinUrl("https://x.uz", "abcdefghjk", "A", false, at(15))).toBe(`https://x.uz/d/abcdefghjk?t=A&s=${at(15)}`);
    expect(joinUrl("https://x.uz", "abcdefghjk", "", true, null)).toBe("https://x.uz/d/abcdefghjk?u=1");
    expect(parseStartsAt(String(at(15)), now)).toBe(at(15));
    for (const bad of [undefined, "", "abc", "12", "99999999999999", String(at(15, 0, 20) + 3 * 365 * 24 * 3600 * 1000), "1e12"]) expect(parseStartsAt(bad as string, now)).toBeNull();
  });
  it("vaqt yorlig'i o'zbekcha", () => {
    expect(lessonTimeLabel(at(9, 5, 22))).toBe("22-noyabr, 09:05");
    expect(lessonTimeLabel(new Date(2026, 0, 1, 0, 0).getTime())).toBe("1-yanvar, 00:00");
  });
  it("sanoq: kelgusi, boshlangan, o'tgan", () => {
    expect(lessonCountdown(at(12, 1), now)).toEqual({ state: "future", text: "Dars bir daqiqadan keyin boshlanadi" });
    expect(lessonCountdown(at(12, 12), now)).toEqual({ state: "future", text: "Darsga 12 daqiqa qoldi" });
    expect(lessonCountdown(at(14, 15), now)).toEqual({ state: "future", text: "Darsga 2 soat 15 daqiqa qoldi" });
    expect(lessonCountdown(at(14), now)).toEqual({ state: "future", text: "Darsga 2 soat qoldi" });
    expect(lessonCountdown(at(12, 0, 23), now)).toEqual({ state: "future", text: "Darsga 3 kun qoldi" });
    expect(lessonCountdown(at(11, 30), now).state).toBe("live");
    expect(lessonCountdown(at(8, 0), now).state).toBe("past");
  });
  it("taklif matni havola va vaqtni o'z ichiga oladi", () => {
    const t = inviteText({ title: "5-sinf matematika", startsAt: at(15, 30, 22), link: "https://x.uz/d/abc" });
    expect(t).toContain("Onlayn dars: 5-sinf matematika");
    expect(t).toContain("Boshlanishi: 22-noyabr, 15:30");
    expect(t).toContain("https://x.uz/d/abc");
    expect(inviteText({ link: "https://x.uz/d/abc" })).not.toContain("Boshlanishi");
  });
  it("datetime-local qiymati ikki tomonga aylanadi", () => {
    const ts = at(15, 30, 22);
    expect(toLocalInput(ts)).toBe("2026-11-22T15:30");
    expect(fromLocalInput("2026-11-22T15:30")).toBe(ts);
    expect(fromLocalInput("")).toBeNull();
    expect(fromLocalInput("noto'g'ri")).toBeNull();
  });
});

describe("internet sifati", () => {
  it("darajalar", () => {
    expect(connectionQuality(80).level).toBe("good");
    expect(connectionQuality(300).level).toBe("ok");
    expect(connectionQuality(900).level).toBe("weak");
    expect(connectionQuality(null).level).toBe("ok");
    expect(connectionQuality(50, false).level).toBe("offline");
  });
});

describe("oxirgi xonalar: dars vaqti saqlanadi", () => {
  it("startsAt qayta o'qiladi", () => {
    const r = { code: "abcdefghjk", title: "A", at: 1, startsAt: 5 };
    expect(parseSavedRooms(JSON.stringify([r]))).toEqual([r]);
    expect(parseSavedRooms(JSON.stringify([{ ...r, startsAt: "x" }]))).toEqual([{ code: "abcdefghjk", title: "A", at: 1 }]);
  });
});
