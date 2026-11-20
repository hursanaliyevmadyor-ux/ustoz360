import { describe, expect, it } from "vitest";
import {
  ROOM_ALPHABET, ROOM_CODE_LEN, addSavedRoom, cleanName, cleanTitle, connectionQuality, describeMediaError, externalBrowserUrl, fromLocalInput, inviteText, isRoomCode, isTelegramBrowser,
  joinUrl, lessonCountdown, lessonTimeLabel, newRoomCode, parseSavedRooms, parseStartsAt, telegramShareUrl, toLocalInput,
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
  const voice = { mode: "s" as const, k: "K".repeat(22), h: "H".repeat(22) };
  const a = { code: "abcdefghjk", title: "A", at: 1, voice };
  const b = { code: "mnpqrstuvw", title: "B", at: 2, voice };
  it("yangisi tepada, takrori yo'q, 10 tadan oshmaydi", () => {
    expect(addSavedRoom([a], b).map((r) => r.code)).toEqual(["mnpqrstuvw", "abcdefghjk"]);
    expect(addSavedRoom([a, b], { ...a, at: 3 }).map((r) => r.code)).toEqual(["abcdefghjk", "mnpqrstuvw"]);
    const many = Array.from({ length: 10 }, () => ({ code: newRoomCode(), title: "", at: 0, voice }));
    expect(addSavedRoom(many, a)).toHaveLength(10);
  });
  it("buzilgan yoki begona ma'lumot e'tiborga olinmaydi", () => {
    expect(parseSavedRooms(null)).toEqual([]);
    expect(parseSavedRooms("{")).toEqual([]);
    expect(parseSavedRooms('{"a":1}')).toEqual([]);
    expect(parseSavedRooms(JSON.stringify([a, { code: "../x", title: "", at: 1, voice }, { code: b.code }]))).toEqual([a]);
  });
  it("eski (imzosiz, Jitsi) xonalar ro'yxatga olinmaydi", () => {
    expect(parseSavedRooms(JSON.stringify([{ code: "abcdefghjk", title: "Eski", at: 1 }]))).toEqual([]);
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
    expect(inviteText({ link: "https://x.uz/d/abc", mode: "s" })).toContain("Qo'l ko'tarish");
    expect(inviteText({ link: "https://x.uz/d/abc", mode: "e" })).toContain("Hamma gapira oladi");
  });
  it("ovozli chat taklifi: kamera kerak emasligi aytiladi", () => {
    const q = inviteText({ title: "Suhbat", link: "https://x.uz/d/abc", mode: "q" });
    expect(q).toContain("Ovozli chat: Suhbat");
    expect(q).toContain("kamera kerak emas");
    expect(q).toContain("Qo'l ko'tarish");
    expect(q).not.toContain("kamerangiz");
    const o = inviteText({ link: "https://x.uz/d/abc", mode: "o" });
    expect(o).toContain("Hamma gapira oladi");
    expect(o).toContain("kamera kerak emas");
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
    const voice = { mode: "s" as const, k: "K".repeat(22), h: "H".repeat(22) };
    const r = { code: "abcdefghjk", title: "A", at: 1, startsAt: 5, voice };
    expect(parseSavedRooms(JSON.stringify([r]))).toEqual([r]);
    expect(parseSavedRooms(JSON.stringify([{ ...r, startsAt: "x" }]))).toEqual([{ code: "abcdefghjk", title: "A", at: 1, voice }]);
  });
});

describe("ovozli xona havolalari", () => {
  const voice = { mode: "s" as const, k: "K".repeat(22), h: "H".repeat(22) };
  it("o'quvchi havolasida ustoz imzosi bo'lmaydi", () => {
    const u = new URL(joinUrl("https://x.uz", "abcdefghjk", "A", false, null, voice));
    expect(u.searchParams.get("r")).toBe("s"); expect(u.searchParams.get("k")).toBe(voice.k); expect(u.searchParams.has("h")).toBe(false); expect(u.searchParams.has("u")).toBe(false);
  });
  it("ustoz havolasida boshqaruv imzosi bor", () => {
    const u = new URL(joinUrl("https://x.uz", "abcdefghjk", "A", true, null, voice));
    expect(u.searchParams.get("h")).toBe(voice.h); expect(u.searchParams.get("u")).toBe("1");
  });
  it("imzosiz havolada rejim va imzo yo'q", () => {
    expect(joinUrl("https://x.uz", "abcdefghjk", "A")).not.toMatch(/[?&](r|k|h)=/);
  });
  it("saqlangan xona qayta o'qiladi, imzosi buzilgani tashlanadi", () => {
    const r = { code: "abcdefghjk", title: "A", at: 1, voice };
    expect(parseSavedRooms(JSON.stringify([r]))).toEqual([r]);
    expect(parseSavedRooms(JSON.stringify([{ ...r, voice: { mode: "x", k: "a", h: "b" } }]))).toEqual([]);
  });
});

describe("tashqi brauzerda ochish", () => {
  const link = "https://ustoz360.vercel.app/d/abcdefghjk?r=s&k=ABC";
  it("Android: Chrome intent havolasi, orqaga qaytish manzili bilan", () => {
    const u = externalBrowserUrl(link, "Mozilla/5.0 (Linux; Android 13) Telegram-Android/10.0")!;
    expect(u.startsWith("intent://ustoz360.vercel.app/d/abcdefghjk?r=s&k=ABC#Intent;scheme=https;package=com.android.chrome;")).toBe(true);
    expect(u).toContain("S.browser_fallback_url=" + encodeURIComponent(link));
    expect(u.endsWith(";end")).toBe(true);
  });
  it("iPhone: Safari havolasi", () => {
    expect(externalBrowserUrl(link, "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0) Telegram")).toBe(`x-safari-${link}`);
  });
  it("kompyuter yoki noto'g'ri havola uchun null", () => {
    expect(externalBrowserUrl(link, "Mozilla/5.0 (Windows NT 10.0)")).toBeNull();
    expect(externalBrowserUrl("javascript:alert(1)", "Android")).toBeNull();
    expect(externalBrowserUrl("salom", "Android")).toBeNull();
  });
  it("fan havolaga qo'shiladi va saqlangan xonada qoladi, noma'lum fan tashlanadi", () => {
    const voice = { mode: "s" as const, k: "K".repeat(22), h: "H".repeat(22) };
    expect(joinUrl("https://x.uz", "abcdefghjk", "A", true, null, voice, "math")).toContain("f=math");
    expect(joinUrl("https://x.uz", "abcdefghjk", "A", true, null, voice, "zzz")).not.toContain("f=");
    const r = { code: "abcdefghjk", title: "A", at: 1, subject: "chem", voice };
    expect(parseSavedRooms(JSON.stringify([r]))).toEqual([r]);
    expect(parseSavedRooms(JSON.stringify([{ ...r, subject: "zzz" }]))[0]).not.toHaveProperty("subject");
  });
});
