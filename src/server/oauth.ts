/** Telegram va Google orqali kirish uchun sof tekshiruv funksiyalari (tarmoqsiz, bazasiz). */
import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

// ---------- Telegram Login Widget ----------
export type TelegramAuth = { id: string; first_name?: string; last_name?: string; username?: string; photo_url?: string; auth_date: string; hash: string };
const TELEGRAM_MAX_AGE_SEC = 10 * 60;

/**
 * Telegram ma'lumotini bot tokeni bilan tekshiradi: hash = HMAC-SHA256(data_check_string, SHA256(bot_token)).
 * auth_date eski bo'lsa (10 daqiqadan ortiq) yoki kelajakda bo'lsa rad etiladi.
 */
export function verifyTelegramAuth(params: Record<string, string>, botToken: string, nowMs = Date.now()): { ok: true; data: TelegramAuth } | { ok: false; reason: string } {
  const { hash, ...rest } = params;
  if (!hash || !/^[0-9a-f]{64}$/i.test(hash)) return { ok: false, reason: "hash yo'q yoki noto'g'ri" };
  if (!rest.id || !/^\d{1,20}$/.test(rest.id)) return { ok: false, reason: "id noto'g'ri" };
  const check = Object.keys(rest).sort().map((k) => `${k}=${rest[k]}`).join("\n");
  const secret = createHash("sha256").update(botToken).digest();
  const expected = createHmac("sha256", secret).update(check).digest();
  const given = Buffer.from(hash, "hex");
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return { ok: false, reason: "imzo noto'g'ri" };
  const age = nowMs / 1000 - Number(rest.auth_date);
  if (!Number.isFinite(age) || age > TELEGRAM_MAX_AGE_SEC || age < -60) return { ok: false, reason: "vaqti o'tgan" };
  return { ok: true, data: { ...(rest as Omit<TelegramAuth, "hash">), hash } as TelegramAuth };
}

// ---------- Google OAuth (Authorization Code + PKCE) ----------
export const b64url = (b: Buffer) => b.toString("base64url");
export const randomToken = (n = 32) => b64url(randomBytes(n));
export const pkceChallenge = (verifier: string) => b64url(createHash("sha256").update(verifier).digest());

export type GoogleClaims = { iss?: string; aud?: string; exp?: number; sub?: string; email?: string; email_verified?: boolean | string; name?: string; nonce?: string };

export function decodeJwtPayload(jwt: string): GoogleClaims | null {
  const parts = jwt.split(".");
  if (parts.length !== 3) return null;
  try { return JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8")); } catch { return null; }
}

/**
 * id_token Google'ning token endpointidan TLS orqali to'g'ridan-to'g'ri olingan, shuning uchun imzoni qayta tekshirish
 * shart emas (OpenID Connect Core 3.1.3.7). Lekin da'volar (claims) tekshiriladi.
 */
export function validateGoogleClaims(c: GoogleClaims | null, clientId: string, nonce: string, nowSec = Math.floor(Date.now() / 1000)): { ok: true; sub: string; email: string; name: string | null } | { ok: false; reason: string } {
  if (!c) return { ok: false, reason: "id_token o'qilmadi" };
  if (c.iss !== "https://accounts.google.com" && c.iss !== "accounts.google.com") return { ok: false, reason: "iss noto'g'ri" };
  if (c.aud !== clientId) return { ok: false, reason: "aud noto'g'ri" };
  if (!c.exp || c.exp < nowSec) return { ok: false, reason: "muddati o'tgan" };
  if (c.nonce !== nonce) return { ok: false, reason: "nonce mos emas" };
  if (!c.sub) return { ok: false, reason: "sub yo'q" };
  if (!c.email) return { ok: false, reason: "email yo'q" };
  if (c.email_verified !== true && c.email_verified !== "true") return { ok: false, reason: "email tasdiqlanmagan" };
  return { ok: true, sub: c.sub, email: c.email.trim().toLowerCase(), name: c.name?.trim() || null };
}

// ---------- Yandex OAuth (Authorization Code + PKCE) ----------
export type YandexInfo = { id?: string | number; login?: string; default_email?: string; display_name?: string; real_name?: string };

/** login.yandex.ru/info javobini tekshiradi. default_email Yandex tomonidan tasdiqlangan asosiy manzil. */
export function validateYandexInfo(i: YandexInfo | null): { ok: true; id: string; email: string; name: string | null } | { ok: false; reason: string } {
  if (!i || i.id === undefined || i.id === null || !/^\d{1,30}$/.test(String(i.id))) return { ok: false, reason: "id yo'q yoki noto'g'ri" };
  const email = i.default_email?.trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, reason: "email yo'q" };
  return { ok: true, id: String(i.id), email, name: (i.real_name || i.display_name || i.login || "").trim() || null };
}

export function appOrigin(req: Request) {
  const env = process.env.APP_URL?.replace(/\/$/, "");
  if (env) return env;
  const h = req.headers; const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? (host?.startsWith("localhost") ? "http" : "https");
  return host ? `${proto}://${host}` : new URL(req.url).origin;
}
