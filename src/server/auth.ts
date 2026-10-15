import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { db } from "./db";

const COOKIE = "u360_session";
const SESSION_DAYS = 30;

function secret() {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 32) throw new Error("AUTH_SECRET kamida 32 belgi bo'lishi kerak");
  return s;
}
const hmac = (v: string) => createHmac("sha256", secret()).update(v).digest("hex");

export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

const MAX_FAILED_LOGINS = 5;          // har email uchun 15 daqiqada
const LOGIN_WINDOW_MS = 15 * 60_000;

/** Parol: scrypt (Node'ning o'zida), har parol uchun tasodifiy tuz. Format: scrypt$<tuz>$<xesh> */
export function hashPassword(password: string) {
  const salt = randomBytes(16);
  return `scrypt$${salt.toString("base64url")}$${scryptSync(password, salt, 64).toString("base64url")}`;
}
export function verifyPassword(password: string, stored: string | null) {
  const [kind, salt, hash] = (stored ?? "").split("$");
  // Foydalanuvchi topilmasa ham xuddi shuncha ish qilinadi (vaqt orqali email aniqlanmasligi uchun).
  const saltBuf = kind === "scrypt" && salt ? Buffer.from(salt, "base64url") : Buffer.alloc(16);
  const actual = scryptSync(password, saltBuf, 64);
  const expected = kind === "scrypt" && hash ? Buffer.from(hash, "base64url") : Buffer.alloc(64);
  return kind === "scrypt" && expected.length === actual.length && timingSafeEqual(actual, expected);
}

export const normalizeEmail = (e: string) => e.trim().toLowerCase();

async function startSession(userId: string) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86_400_000);
  await db.authSession.create({ data: { tokenHash: hmac(token), userId, expiresAt } });
  (await cookies()).set(COOKIE, token, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", expires: expiresAt });
}

export async function register(rawEmail: string, password: string, name?: string) {
  const email = normalizeEmail(rawEmail);
  if (await db.user.findUnique({ where: { email } })) throw new ApiError(409, "Bu email allaqachon ro'yxatdan o'tgan. Kirish bo'limidan foydalaning.");
  let user;
  try {
    user = await db.user.create({ data: { email, passwordHash: hashPassword(password), name: name?.trim() || null, roles: { create: { role: "TEACHER" } }, profile: { create: {} } } });
  } catch (e) {
    if ((e as { code?: string }).code === "P2002") throw new ApiError(409, "Bu email allaqachon ro'yxatdan o'tgan. Kirish bo'limidan foydalaning.");
    throw e;
  }
  await startSession(user.id);
  await db.auditLog.create({ data: { userId: user.id, action: "auth.register" } });
  return user;
}

export async function login(rawEmail: string, password: string) {
  const email = normalizeEmail(rawEmail);
  const since = new Date(Date.now() - LOGIN_WINDOW_MS);
  const failed = await db.auditLog.count({ where: { action: "auth.login_failed", createdAt: { gt: since }, meta: { path: ["email"], equals: email } } });
  if (failed >= MAX_FAILED_LOGINS) throw new ApiError(429, "Juda ko'p noto'g'ri urinish. 15 daqiqadan keyin qayta urinib ko'ring.");

  const user = await db.user.findUnique({ where: { email } });
  const ok = verifyPassword(password, user?.passwordHash ?? null) && !!user && !user.deletedAt;
  if (!ok) {
    await db.auditLog.create({ data: { userId: user?.id ?? null, action: "auth.login_failed", meta: { email } } });
    throw new ApiError(401, "Email yoki parol noto'g'ri."); // qaysi biri xato ekani aytilmaydi
  }
  await startSession(user.id);
  await db.auditLog.create({ data: { userId: user.id, action: "auth.login" } });
  return user;
}

/**
 * Google orqali kirish. Email Google tomonidan tasdiqlangan.
 * Himoya: agar shu email bilan oldin parol orqali (tasdiqlanmagan) akkaunt ochilgan bo'lsa, u birovning emailini
 * oldindan egallab olgan bo'lishi mumkin. Shuning uchun parol bekor qilinadi va barcha eski sessiyalar o'chiriladi.
 */
export async function signInWithGoogle(g: { sub: string; email: string; name: string | null }) {
  const now = new Date();
  let user = await db.user.findUnique({ where: { googleSub: g.sub } });
  if (!user) {
    const byEmail = await db.user.findUnique({ where: { email: g.email } });
    if (byEmail) {
      const preHijackRisk = !byEmail.emailVerifiedAt && !!byEmail.passwordHash;
      if (preHijackRisk) await db.authSession.deleteMany({ where: { userId: byEmail.id } });
      user = await db.user.update({
        where: { id: byEmail.id },
        data: { googleSub: g.sub, emailVerifiedAt: byEmail.emailVerifiedAt ?? now, ...(preHijackRisk && { passwordHash: null }), name: byEmail.name ?? g.name },
      });
      await db.auditLog.create({ data: { userId: user.id, action: preHijackRisk ? "auth.google_link_reset_password" : "auth.google_link" } });
    } else {
      user = await db.user.create({ data: { email: g.email, googleSub: g.sub, emailVerifiedAt: now, name: g.name, roles: { create: { role: "TEACHER" } }, profile: { create: {} } } });
      await db.auditLog.create({ data: { userId: user.id, action: "auth.register_google" } });
    }
  }
  if (user.deletedAt) throw new ApiError(403, "Akkaunt o'chirilgan.");
  await startSession(user.id);
  await db.auditLog.create({ data: { userId: user.id, action: "auth.login_google" } });
  return user;
}

/** Telegram orqali kirish (imzo oldindan oauth.verifyTelegramAuth bilan tekshirilgan bo'lishi shart). */
export async function signInWithTelegram(t: { id: string; first_name?: string; last_name?: string; username?: string }) {
  let user = await db.user.findUnique({ where: { telegramId: t.id } });
  if (!user) {
    const name = [t.first_name, t.last_name].filter(Boolean).join(" ").trim() || t.username || null;
    user = await db.user.create({ data: { telegramId: t.id, telegramUsername: t.username ?? null, name, roles: { create: { role: "TEACHER" } }, profile: { create: {} } } });
    await db.auditLog.create({ data: { userId: user.id, action: "auth.register_telegram" } });
  } else if (t.username && user.telegramUsername !== t.username) {
    user = await db.user.update({ where: { id: user.id }, data: { telegramUsername: t.username } });
  }
  if (user.deletedAt) throw new ApiError(403, "Akkaunt o'chirilgan.");
  await startSession(user.id);
  await db.auditLog.create({ data: { userId: user.id, action: "auth.login_telegram" } });
  return user;
}

export async function currentUser() {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  const s = await db.authSession.findUnique({ where: { tokenHash: hmac(token) }, include: { user: { include: { roles: true } } } });
  if (!s || s.expiresAt < new Date() || s.user.deletedAt) return null;
  return s.user;
}

export async function requireUser() {
  const u = await currentUser();
  if (!u) throw new ApiError(401, "Avval tizimga kiring.");
  return u;
}

export async function logout() {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (token) await db.authSession.deleteMany({ where: { tokenHash: hmac(token) } });
  jar.delete(COOKIE);
}

/** Serverda rol tekshiruvi (frontendda yashirish xavfsizlik hisoblanmaydi). */
export function hasRole(user: { roles: { role: string }[] }, ...roles: string[]) {
  return user.roles.some((r) => roles.includes(r.role));
}
