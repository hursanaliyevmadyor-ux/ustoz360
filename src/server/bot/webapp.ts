import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Telegram Mini App (WebApp) kirish ma'lumotini (initData) tekshirish. Telegram uni bot tokeni bilan imzolaydi:
 * secret = HMAC_SHA256("WebAppData", token); hash = HMAC_SHA256(secret, "kalit=qiymat" qatorlari alifbo tartibida, \n bilan).
 * Tekshiruvdan o'tmagan yoki eskirgan ma'lumot bilan hech kim kirmaydi.
 */
export type WebAppUser = { id: number; first_name?: string; last_name?: string; username?: string };
export type InitResult = { ok: true; user: WebAppUser; authDate: number } | { ok: false; reason: "format" | "hash" | "expired" | "user" };

const MAX_LEN = 4096;

export function verifyInitData(initData: string, botToken: string, nowMs = Date.now(), maxAgeSec = 86_400): InitResult {
  if (!initData || initData.length > MAX_LEN || !botToken) return { ok: false, reason: "format" };
  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  if (!hash || !/^[0-9a-f]{64}$/i.test(hash)) return { ok: false, reason: "format" };
  params.delete("hash");
  const check = [...params.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)).map(([k, v]) => `${k}=${v}`).join("\n");
  const secret = createHmac("sha256", "WebAppData").update(botToken).digest();
  const calc = createHmac("sha256", secret).update(check).digest();
  const given = Buffer.from(hash, "hex");
  if (given.length !== calc.length || !timingSafeEqual(calc, given)) return { ok: false, reason: "hash" };

  const authDate = Number(params.get("auth_date"));
  if (!Number.isFinite(authDate) || authDate <= 0) return { ok: false, reason: "format" };
  const age = nowMs / 1000 - authDate;
  if (age > maxAgeSec || age < -300) return { ok: false, reason: "expired" };

  try {
    const u = JSON.parse(params.get("user") ?? "") as WebAppUser;
    if (!u || typeof u.id !== "number" || !Number.isSafeInteger(u.id) || u.id <= 0) return { ok: false, reason: "user" };
    return { ok: true, user: u, authDate };
  } catch { return { ok: false, reason: "user" }; }
}

/** Sinov va E2E uchun: berilgan token bilan to'g'ri imzolangan initData yasaydi (ishlab chiqarishda ishlatilmaydi). */
export function signInitData(fields: Record<string, string>, botToken: string): string {
  const check = Object.entries(fields).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)).map(([k, v]) => `${k}=${v}`).join("\n");
  const secret = createHmac("sha256", "WebAppData").update(botToken).digest();
  const hash = createHmac("sha256", secret).update(check).digest("hex");
  return new URLSearchParams({ ...fields, hash }).toString();
}
