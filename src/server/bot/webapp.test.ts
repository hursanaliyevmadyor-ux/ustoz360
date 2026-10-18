import { describe, expect, it } from "vitest";
import { signInitData, verifyInitData } from "./webapp";

const TOKEN = "123456:ABC-test-token";
const NOW = Date.parse("2026-11-05T10:00:00Z");
const sec = (ms: number) => String(Math.floor(ms / 1000));
const fields = (o: Record<string, string> = {}) => ({ auth_date: sec(NOW - 60_000), query_id: "AAH123", user: JSON.stringify({ id: 5551234, first_name: "Aziza", username: "aziza" }), ...o });

describe("Mini App initData tekshiruvi", () => {
  it("to'g'ri imzolangan ma'lumotdan foydalanuvchi olinadi", () => {
    const r = verifyInitData(signInitData(fields(), TOKEN), TOKEN, NOW);
    expect(r).toMatchObject({ ok: true, user: { id: 5551234, first_name: "Aziza" } });
  });

  it("boshqa bot tokeni bilan imzolangan ma'lumot rad etiladi", () => {
    expect(verifyInitData(signInitData(fields(), "999:boshqa"), TOKEN, NOW)).toEqual({ ok: false, reason: "hash" });
  });

  it("ma'lumot o'zgartirilsa (boshqa foydalanuvchi id) rad etiladi", () => {
    const signed = signInitData(fields(), TOKEN);
    const forged = signed.replace(encodeURIComponent('"id":5551234'), encodeURIComponent('"id":1'));
    expect(forged).not.toBe(signed);
    expect(verifyInitData(forged, TOKEN, NOW)).toEqual({ ok: false, reason: "hash" });
  });

  it("hash bo'lmasa yoki noto'g'ri formatda bo'lsa rad etiladi", () => {
    expect(verifyInitData("", TOKEN, NOW)).toEqual({ ok: false, reason: "format" });
    expect(verifyInitData("auth_date=1&user=%7B%7D", TOKEN, NOW)).toEqual({ ok: false, reason: "format" });
    expect(verifyInitData("hash=xyz&auth_date=1", TOKEN, NOW)).toEqual({ ok: false, reason: "format" });
    expect(verifyInitData("a=".padEnd(5000, "b"), TOKEN, NOW)).toEqual({ ok: false, reason: "format" });
    expect(verifyInitData(signInitData(fields(), TOKEN), "", NOW)).toEqual({ ok: false, reason: "format" });
  });

  it("eskirgan (24 soatdan oldingi) va kelajakdagi sana rad etiladi", () => {
    expect(verifyInitData(signInitData(fields({ auth_date: sec(NOW - 25 * 3_600_000) }), TOKEN), TOKEN, NOW)).toEqual({ ok: false, reason: "expired" });
    expect(verifyInitData(signInitData(fields({ auth_date: sec(NOW + 3_600_000) }), TOKEN), TOKEN, NOW)).toEqual({ ok: false, reason: "expired" });
    expect(verifyInitData(signInitData(fields({ auth_date: sec(NOW - 23 * 3_600_000) }), TOKEN), TOKEN, NOW).ok).toBe(true);
  });

  it("foydalanuvchi ma'lumoti yo'q yoki buzuq bo'lsa rad etiladi", () => {
    const { user: _u, ...noUser } = fields();
    expect(verifyInitData(signInitData(noUser, TOKEN), TOKEN, NOW)).toEqual({ ok: false, reason: "user" });
    expect(verifyInitData(signInitData(fields({ user: "{buzuq" }), TOKEN), TOKEN, NOW)).toEqual({ ok: false, reason: "user" });
    expect(verifyInitData(signInitData(fields({ user: JSON.stringify({ id: "5" }) }), TOKEN), TOKEN, NOW)).toEqual({ ok: false, reason: "user" });
    expect(verifyInitData(signInitData(fields({ user: JSON.stringify({ id: -3 }) }), TOKEN), TOKEN, NOW)).toEqual({ ok: false, reason: "user" });
  });

  it("maydonlar tartibi va qo'shimcha maydonlar (signature) hashga ta'sir qiladi, tartib mos bo'lsa o'tadi", () => {
    const f = fields({ signature: "abc_DEF-123", chat_type: "sender", start_param: "x y" });
    expect(verifyInitData(signInitData(f, TOKEN), TOKEN, NOW).ok).toBe(true);
    const reordered = new URLSearchParams(signInitData(f, TOKEN));
    const shuffled = new URLSearchParams([...reordered.entries()].reverse()).toString();
    expect(verifyInitData(shuffled, TOKEN, NOW).ok).toBe(true);
  });
});
