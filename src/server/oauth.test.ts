import { createHash, createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { pkceChallenge, validateGoogleClaims, verifyTelegramAuth } from "./oauth";

const TOKEN = "123456:TEST-bot-token";
const sign = (data: Record<string, string>) => {
  const check = Object.keys(data).sort().map((k) => `${k}=${data[k]}`).join("\n");
  return createHmac("sha256", createHash("sha256").update(TOKEN).digest()).update(check).digest("hex");
};
const now = 1_800_000_000_000;
const tg = (over: Record<string, string> = {}) => { const d = { id: "777", first_name: "Dilnoza", username: "dilnoza", auth_date: String(now / 1000 - 30), ...over }; return { ...d, hash: sign(d) }; };

describe("verifyTelegramAuth", () => {
  it("to'g'ri imzo qabul qilinadi", () => {
    const r = verifyTelegramAuth(tg(), TOKEN, now);
    expect(r.ok).toBe(true);
  });
  it("o'zgartirilgan ma'lumot (id) rad etiladi", () => {
    const p = tg(); p.id = "888";
    expect(verifyTelegramAuth(p, TOKEN, now)).toMatchObject({ ok: false });
  });
  it("boshqa bot tokeni bilan imzolangan rad etiladi", () => {
    expect(verifyTelegramAuth(tg(), "999:BOSHQA", now)).toMatchObject({ ok: false });
  });
  it("hash yo'q yoki noto'g'ri formatda rad etiladi", () => {
    const { hash: _h, ...p } = tg();
    expect(verifyTelegramAuth(p, TOKEN, now)).toMatchObject({ ok: false });
    expect(verifyTelegramAuth({ ...p, hash: "xyz" }, TOKEN, now)).toMatchObject({ ok: false });
  });
  it("10 daqiqadan eski yoki kelajakdagi auth_date rad etiladi", () => {
    expect(verifyTelegramAuth(tg({ auth_date: String(now / 1000 - 3600) }), TOKEN, now)).toMatchObject({ ok: false, reason: "vaqti o'tgan" });
    expect(verifyTelegramAuth(tg({ auth_date: String(now / 1000 + 3600) }), TOKEN, now)).toMatchObject({ ok: false });
  });
});

describe("validateGoogleClaims", () => {
  const good = { iss: "https://accounts.google.com", aud: "cid", exp: 2_000_000_000, sub: "g-1", email: "Dil@Gmail.com", email_verified: true, name: "Dil", nonce: "n1" };
  it("to'g'ri da'volar qabul qilinadi, email kichik harfga keltiriladi", () => {
    expect(validateGoogleClaims(good, "cid", "n1", 1_900_000_000)).toEqual({ ok: true, sub: "g-1", email: "dil@gmail.com", name: "Dil" });
  });
  it.each([
    ["iss", { iss: "https://evil.com" }], ["aud", { aud: "boshqa" }], ["exp", { exp: 1 }], ["nonce", { nonce: "x" }],
    ["sub", { sub: undefined }], ["email", { email: undefined }], ["email_verified", { email_verified: false }],
  ])("%s noto'g'ri bo'lsa rad etiladi", (_n, over) => {
    expect(validateGoogleClaims({ ...good, ...over } as never, "cid", "n1", 1_900_000_000)).toMatchObject({ ok: false });
  });
  it("PKCE challenge RFC 7636 namunasiga mos", () => {
    expect(pkceChallenge("dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk")).toBe("E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM");
  });
});

import { validateYandexInfo } from "./oauth";
describe("validateYandexInfo", () => {
  it("to'g'ri javobni qabul qiladi", () => {
    expect(validateYandexInfo({ id: "1000034426", default_email: " Test@Yandex.ru ", real_name: "Ali Valiyev" })).toEqual({ ok: true, id: "1000034426", email: "test@yandex.ru", name: "Ali Valiyev" });
    expect(validateYandexInfo({ id: 42, default_email: "a@ya.ru", login: "ali" })).toMatchObject({ ok: true, id: "42", name: "ali" });
  });
  it("id yoki email yo'q/noto'g'ri bo'lsa rad etadi", () => {
    expect(validateYandexInfo(null).ok).toBe(false);
    expect(validateYandexInfo({ default_email: "a@ya.ru" }).ok).toBe(false);
    expect(validateYandexInfo({ id: "abc", default_email: "a@ya.ru" }).ok).toBe(false);
    expect(validateYandexInfo({ id: "1" }).ok).toBe(false);
    expect(validateYandexInfo({ id: "1", default_email: "yo'q" }).ok).toBe(false);
  });
});
